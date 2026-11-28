// src/ui/screens/backup.js
// بکاپ/بازگردانی و تنظیمات — فاز 12 PRD

import { repo } from '../../core/repository.js';
import { state } from '../../core/state.js';
import { navigate } from '../../core/router.js';
import { db } from '../../core/db.js';
import { storage } from '../../core/storage.js';
import { reports } from '../../domain/reports.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/sheet.js';
import { Avatar, Input } from '../components/ui.js';
import { AVATAR_COLORS } from '../../domain/validators.js';
import { formatJalaliWithTime, toPersianDigits } from '../../utils/date.js';
import { runIntegrityChecks } from '../../domain/integrity.js';

const COLOR_GRADIENTS = {
  brand: 'from-brand to-brand-dark', cta: 'from-cta to-cta-dark',
  purple: 'from-purple-500 to-pink-500', cyan: 'from-cyan-500 to-blue-500',
  pink: 'from-pink-500 to-rose-500', success: 'from-success to-emerald-700',
  warning: 'from-warning to-cta', info: 'from-info to-purple-500'
};

const APP_VERSION = '1.0.0';
const BUILD_DATE = '۱۴۰۴';

const SHORTCUT_OPTIONS = [
  { value: 'add_receipt',  label: 'افزودن تراکنش',  path: '/transaction/add' },
  { value: 'add_expense',  label: 'افزودن هزینه',   path: '/expense/add' },
  { value: 'add_activity', label: 'افزودن فعالیت',  path: '/activity/add' },
  { value: 'add_project',  label: 'افزودن پروژه',   path: '/projects' },
  { value: 'reports',      label: 'گزارش‌ها',         path: '/reports' },
  { value: 'export_json',  label: 'خروجی JSON',      path: '/backup' },
  { value: 'backup',       label: 'بکاپ',             path: '/backup' }
];

const BACKUP_STORE_KEYS = ['employers', 'partners', 'projects', 'projectShares', 'receipts', 'receiptAllocations', 'employerCredits', 'expenses', 'partnerTransfers', 'dailyActivities', 'equipment', 'tags'];

let profileColorPicked = 'brand';
let personalizationState = null;

// =========== BACKUP PAGE ===========
export function renderBackupPage() {
  const main = document.getElementById('page-content');
  const settings = state.data.settings || {};
  main.innerHTML = `
    <div class="px-4 pt-4 pb-28 space-y-4">
      ${renderExportCard()}
      ${renderImportCard()}
      ${renderIntegrityCard()}
      ${renderAutoBackupCard(settings)}
      ${renderDangerZone()}
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  window.__exportJSON = exportJSON;
  window.__importJSON = importJSON;
  window.__runIntegrityChecks = runIntegrityChecksFromUI;
  window.__toggleAutoBackup = toggleAutoBackup;
  window.__clearAllData = clearAllData;
  window.__navigate = (path) => navigate(path);
}

function renderExportCard() {
  return `
    <div class="glass rounded-2xl p-4">
      <div class="flex items-start gap-3 mb-3">
        <div class="w-11 h-11 rounded-xl bg-brand/15 text-brand flex items-center justify-center shrink-0"><i data-lucide="download" class="w-5 h-5"></i></div>
        <div class="flex-1"><h3 class="text-sm font-bold mb-1">خروجی JSON</h3><p class="text-xs text-fg-muted">دریافت کل داده‌های اپ به‌صورت یک فایل JSON</p></div>
      </div>
      <button onclick="window.__exportJSON()" class="w-full h-11 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-brand/30">
        <i data-lucide="download" class="w-4 h-4"></i> دانلود فایل بکاپ
      </button>
    </div>
  `;
}

function renderImportCard() {
  return `
    <div class="glass rounded-2xl p-4">
      <div class="flex items-start gap-3 mb-3">
        <div class="w-11 h-11 rounded-xl bg-cta/15 text-cta flex items-center justify-center shrink-0"><i data-lucide="upload" class="w-5 h-5"></i></div>
        <div class="flex-1"><h3 class="text-sm font-bold mb-1">بازگردانی از JSON</h3><p class="text-xs text-fg-muted">بازگردانی داده‌ها از یک فایل بکاپ قبلی</p></div>
      </div>
      <div class="rounded-xl bg-warning-soft p-3 text-xs text-warning flex items-center gap-2 mb-3">
        <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i><span>این عملیات همه داده‌های فعلی را جایگزین می‌کند</span>
      </div>
      <label class="block">
        <input type="file" id="backup-file-input" accept=".json,application/json" class="hidden" onchange="window.__importJSON(this.files[0]); this.value='';" />
        <span class="w-full h-11 rounded-xl glass-strong text-sm font-medium hover:bg-white/10 transition flex items-center justify-center gap-2 cursor-pointer">
          <i data-lucide="file-up" class="w-4 h-4"></i> انتخاب فایل
        </span>
      </label>
    </div>
  `;
}

function renderIntegrityCard() {
  return `
    <div class="glass rounded-2xl p-4">
      <div class="flex items-start gap-3 mb-3">
        <div class="w-11 h-11 rounded-xl bg-info-soft text-info flex items-center justify-center shrink-0"><i data-lucide="shield-check" class="w-5 h-5"></i></div>
        <div class="flex-1">
          <h3 class="text-sm font-bold mb-1">بررسی سلامت اطلاعات</h3>
          <p class="text-xs text-fg-muted">شناسایی ارجاع‌های ناقص و مغایرت‌های مالی؛ بدون تغییر در اطلاعات</p>
        </div>
      </div>
      <button onclick="window.__runIntegrityChecks()" class="w-full h-11 rounded-xl glass-strong text-sm font-medium hover:bg-white/10 transition flex items-center justify-center gap-2">
        <i data-lucide="scan-search" class="w-4 h-4"></i> اجرای بررسی
      </button>
      <div id="integrity-results" class="mt-3 space-y-2" aria-live="polite"></div>
    </div>
  `;
}

function runIntegrityChecksFromUI() {
  const container = document.getElementById('integrity-results');
  if (!container) return;

  const result = runIntegrityChecks(state.data);
  container.replaceChildren();

  const summary = document.createElement('p');
  summary.className = 'text-xs font-semibold';
  summary.textContent = `بررسی ${toPersianDigits(result.checkedRecords)} رکورد: ${toPersianDigits(result.summary.errors)} خطا و ${toPersianDigits(result.summary.warnings)} هشدار`;
  container.appendChild(summary);

  if (!result.findings.length) {
    const clean = document.createElement('p');
    clean.className = 'rounded-xl bg-success-soft text-success p-3 text-xs';
    clean.textContent = 'مغایرتی در موارد بررسی‌شده پیدا نشد.';
    container.appendChild(clean);
    return;
  }

  for (const finding of result.findings) {
    const item = document.createElement('div');
    item.className = finding.severity === 'error'
      ? 'rounded-xl bg-danger-soft p-3'
      : 'rounded-xl bg-warning-soft p-3';

    const title = document.createElement('p');
    title.className = finding.severity === 'error'
      ? 'text-xs font-bold text-danger'
      : 'text-xs font-bold text-warning';
    title.textContent = finding.title;

    const detail = document.createElement('p');
    detail.className = 'text-[11px] text-fg-muted mt-1';
    detail.textContent = finding.detail;

    item.append(title, detail);
    container.appendChild(item);
  }
}

function renderAutoBackupCard(settings) {
  const enabled = settings.autoBackup || false;
  const lastBackup = settings.lastBackup;
  return `
    <div class="glass rounded-2xl p-4">
      <div class="flex items-start gap-3 mb-2">
        <div class="w-11 h-11 rounded-xl bg-success-soft text-success flex items-center justify-center shrink-0"><i data-lucide="refresh-cw" class="w-5 h-5"></i></div>
        <div class="flex-1"><h3 class="text-sm font-bold mb-1">بکاپ خودکار</h3><p class="text-xs text-fg-muted">فعال‌سازی بکاپ خودکار در localStorage</p></div>
        <button onclick="window.__toggleAutoBackup()" class="relative w-12 h-7 rounded-full transition ${enabled ? 'bg-success' : 'bg-white/15'}" aria-label="تغییر وضعیت بکاپ خودکار">
          <span class="absolute top-0.5 ${enabled ? 'left-0.5' : 'right-0.5'} w-6 h-6 rounded-full bg-white shadow-md transition-all"></span>
        </button>
      </div>
      ${lastBackup ? `<p class="text-[10px] text-fg-muted mt-2">آخرین بکاپ: ${formatJalaliWithTime(lastBackup)}</p>` : '<p class="text-[10px] text-fg-muted mt-2">هنوز بکاپی گرفته نشده</p>'}
    </div>
  `;
}

function renderDangerZone() {
  return `
    <div class="glass rounded-2xl p-4 border border-danger/30">
      <div class="flex items-start gap-3 mb-3">
        <div class="w-11 h-11 rounded-xl bg-danger-soft text-danger flex items-center justify-center shrink-0"><i data-lucide="alert-triangle" class="w-5 h-5"></i></div>
        <div class="flex-1"><h3 class="text-sm font-bold text-danger mb-1">منطقه خطر</h3><p class="text-xs text-fg-muted">پاک‌سازی همه داده‌ها به‌صورت دائمی</p></div>
      </div>
      <button onclick="window.__clearAllData()" class="w-full h-11 rounded-xl bg-danger hover:bg-danger/90 text-white text-sm font-medium transition flex items-center justify-center gap-2">
        <i data-lucide="trash-2" class="w-4 h-4"></i> پاک‌سازی همه داده‌ها
      </button>
    </div>
  `;
}

async function exportJSON() {
  try {
    const data = await reports.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const todayIso = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `pfm-backup-${todayIso}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    state.updateSettings({ lastBackup: new Date().toISOString() });
    showToast('بکاپ با موفقیت ایجاد شد', 'success');
  } catch (e) {
    console.error('Export failed:', e);
    showToast('خطا در ایجاد بکاپ', 'error');
  }
}

function importJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target.result;
      const data = JSON.parse(text);
      const validation = validateBackupFile(data);
      if (!validation.valid) {
        showToast(validation.message, 'error');
        return;
      }

      const preview = BACKUP_STORE_KEYS.map(key => {
        const labels = {
          projects: 'پروژه', employers: 'کارفرما', partners: 'شریک',
          receipts: 'دریافتی', expenses: 'هزینه', partnerTransfers: 'انتقال'
        };
        return labels[key] ? `${labels[key]}: ${(data.data[key] || []).length}` : null;
      }).filter(Boolean).join(' · ');

      confirmDialog({
        title: 'بازگردانی داده',
        message: `اطلاعات فایل: ${preview}. پیش از جایگزینی، از اطلاعات فعلی نسخه پشتیبان دانلود می‌شود. ادامه می‌دهید؟`,
        confirmText: 'بله، بازگردانی کن', danger: true,
        onConfirm: async () => {
          let previousData = null;
          try {
            previousData = await reports.exportAll();
            downloadBackupFile(previousData, 'before-restore');
            const importedCount = await applyBackupData(data);
            await state.hydrate();
            showToast(`بازگردانی ${toPersianDigits(importedCount)} رکورد با موفقیت انجام شد`, 'success');
            navigate('/dashboard');
          } catch (err) {
            console.error('Restore failed:', err);
            if (previousData) {
              try {
                await applyBackupData(previousData);
                await state.hydrate();
                showToast('بازگردانی ناموفق بود؛ اطلاعات قبلی بازیابی شدند', 'warning');
              } catch (rollbackError) {
                console.error('Restore rollback failed:', rollbackError);
                showToast('خطا در بازگردانی و بازیابی نسخه قبلی؛ فایل پشتیبان دانلودشده را نگه دارید', 'error');
              }
            } else {
              showToast('خطا در تهیه نسخه پشتیبان؛ هیچ تغییری اعمال نشد', 'error');
            }
          }
        }
      });
    } catch (err) {
      console.error('Parse failed:', err);
      showToast('فایل بکاپ نامعتبر است', 'error');
    }
  };
  reader.onerror = () => showToast('خطا در خواندن فایل', 'error');
  reader.readAsText(file);
}

function validateBackupFile(backup) {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup) || backup.version !== 1 || !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
    return { valid: false, message: 'ساختار یا نسخه فایل بکاپ پشتیبانی نمی‌شود' };
  }

  for (const storeName of BACKUP_STORE_KEYS) {
    if (backup.data[storeName] !== undefined && !Array.isArray(backup.data[storeName])) {
      return { valid: false, message: `ساختار بخش ${storeName} در فایل بکاپ نامعتبر است` };
    }
  }
  if (backup.data.settings !== undefined && (!backup.data.settings || typeof backup.data.settings !== 'object' || Array.isArray(backup.data.settings))) {
    return { valid: false, message: 'ساختار تنظیمات در فایل بکاپ نامعتبر است' };
  }
  if (backup.data.customOrders !== undefined && (!backup.data.customOrders || typeof backup.data.customOrders !== 'object' || Array.isArray(backup.data.customOrders))) {
    return { valid: false, message: 'ساختار ترتیب‌های سفارشی در فایل بکاپ نامعتبر است' };
  }
  if (backup.data.dashboardShortcuts !== undefined && !Array.isArray(backup.data.dashboardShortcuts)) {
    return { valid: false, message: 'ساختار میان‌برهای داشبورد در فایل بکاپ نامعتبر است' };
  }
  if (backup.data.autoBackup !== undefined && (!backup.data.autoBackup || typeof backup.data.autoBackup !== 'object' || Array.isArray(backup.data.autoBackup))) {
    return { valid: false, message: 'ساختار اطلاعات بکاپ خودکار نامعتبر است' };
  }
  return { valid: true };
}

function downloadBackupFile(data, suffix = 'backup') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const todayIso = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `pfm-${suffix}-${todayIso}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function applyBackupData(backup) {
  await db.clearAll();
  for (const storeName of BACKUP_STORE_KEYS) {
    const items = backup.data[storeName];
    if (Array.isArray(items) && items.length > 0) {
      await repo[storeName].bulkInsert(items);
    }
  }

  storage.clearAll();
  if (backup.data.settings) storage.saveSettings(backup.data.settings);
  if (backup.data.customOrders && typeof backup.data.customOrders === 'object') {
    for (const [key, value] of Object.entries(backup.data.customOrders)) {
      if (Array.isArray(value)) storage.saveCustomOrder(key, value);
    }
  }
  if (Array.isArray(backup.data.dashboardShortcuts)) {
    storage.saveDashboardShortcuts(backup.data.dashboardShortcuts);
  }
  if (backup.data.autoBackup && typeof backup.data.autoBackup === 'object') {
    storage.saveAutoBackup(backup.data.autoBackup);
  }
  return BACKUP_STORE_KEYS.reduce((count, key) => count + (Array.isArray(backup.data[key]) ? backup.data[key].length : 0), 0);
}

function toggleAutoBackup() {
  const current = state.data.settings?.autoBackup || false;
  state.updateSettings({ autoBackup: !current });
  renderBackupPage();
}

function clearAllData() {
  confirmDialog({
    title: 'پاک‌سازی همه داده‌ها',
    message: 'آیا از پاک‌سازی همه داده‌ها مطمئن هستید؟ این عمل قابل بازگشت نیست.',
    confirmText: 'بله، پاک کن', danger: true,
    onConfirm: () => {
      confirmDialog({
        title: 'تأیید نهایی',
        message: 'برای اطمینان نهایی، دوباره تأیید کنید. تمام داده‌ها حذف خواهند شد.',
        confirmText: 'حذف قطعی', danger: true,
        onConfirm: async () => {
          try {
            await db.clearAll();
            storage.clearAll();
            await state.hydrate();
            showToast('همه داده‌ها پاک شد', 'success');
            navigate('/onboarding');
          } catch (e) {
            console.error('Clear failed:', e);
            showToast('خطا در پاک‌سازی', 'error');
          }
        }
      });
    }
  });
}

// =========== SETTINGS PAGE ===========
export function renderSettingsPage() {
  const main = document.getElementById('page-content');
  main.innerHTML = `
    <div class="px-4 pt-4 pb-28 space-y-4">
      <div class="glass rounded-2xl">
        <button onclick="window.__navigate('/backup')" class="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition text-right">
          <div class="w-9 h-9 rounded-xl glass flex items-center justify-center"><i data-lucide="database" class="w-4 h-4"></i></div>
          <span class="flex-1 text-right text-sm font-medium">بکاپ و بازگردانی</span>
          <i data-lucide="chevron-left" class="w-4 h-4 text-fg-muted"></i>
        </button>
      </div>
      ${renderAboutCard()}
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  window.__navigate = path => navigate(path);
}
function renderAboutCard() {
  return `
    <div class="glass rounded-2xl p-5">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-11 h-11 rounded-xl bg-brand/15 text-brand flex items-center justify-center"><i data-lucide="info" class="w-5 h-5"></i></div>
        <div><p class="text-sm font-bold">درباره اپ</p><p class="text-[10px] text-fg-muted">مدیریت مالی پروژه‌های شخصی</p></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-lg bg-white/5 p-2.5 text-center"><p class="text-[10px] text-fg-muted mb-0.5">نسخه</p><p class="text-xs font-bold">${toPersianDigits(APP_VERSION)}</p></div>
        <div class="rounded-lg bg-white/5 p-2.5 text-center"><p class="text-[10px] text-fg-muted mb-0.5">تاریخ ساخت</p><p class="text-xs font-bold">${BUILD_DATE}</p></div>
      </div>
    </div>
  `;
}

// =========== PERSONALIZATION PAGE ===========
export function renderPersonalizationPage() {
  const main = document.getElementById('page-content');
  const projects = (state.data.projects || []).filter(p => !p.deletedAt && p.status === 'active');
  const order = state.data.customOrders?.projects_active || [];
  const sortedProjects = [...projects].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    if (ia === -1 && ib === -1) return new Date(b.createdAt) - new Date(a.createdAt);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  const shortcuts = state.data.dashboardShortcuts || ['add_receipt', 'add_expense', 'add_activity', 'export_json'];
  personalizationState = { projectOrder: sortedProjects.map(p => p.id), shortcuts: [...shortcuts] };

  main.innerHTML = `
    <div class="px-4 pt-4 pb-28 space-y-4">
      ${renderProjectOrdering(sortedProjects)}
      ${renderShortcutsSelector(personalizationState.shortcuts)}
      <button onclick="window.__savePersonalization()" class="w-full h-11 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-brand/30">
        <i data-lucide="check" class="w-4 h-4"></i> ذخیره
      </button>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  window.__moveProject = moveProject;
  window.__setShortcut = setShortcut;
  window.__savePersonalization = savePersonalization;
}

function renderProjectOrdering(projects) {
  return `
    <div class="glass rounded-2xl p-4">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="grip-vertical" class="w-4 h-4 text-fg-muted"></i>
        <h3 class="text-sm font-bold">مرتب‌سازی پروژه‌های فعال</h3>
      </div>
      ${projects.length === 0 ? `<p class="text-xs text-fg-muted text-center py-4">پروژه فعالی موجود نیست</p>` : `
        <div class="space-y-1.5">
          ${projects.map((p, idx) => `
            <div class="flex items-center gap-2 p-2.5 rounded-xl glass">
              <i data-lucide="grip-vertical" class="w-4 h-4 text-fg-muted shrink-0"></i>
              <div class="flex-1 min-w-0"><p class="text-xs font-bold truncate">${p.title}</p></div>
              <button onclick="window.__moveProject('${p.id}', -1)" ${idx === 0 ? 'disabled' : ''} class="w-7 h-7 rounded-lg glass flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed" aria-label="بالا">
                <i data-lucide="chevron-up" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="window.__moveProject('${p.id}', 1)" ${idx === projects.length - 1 ? 'disabled' : ''} class="w-7 h-7 rounded-lg glass flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed" aria-label="پایین">
                <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function moveProject(projectId, direction) {
  if (!personalizationState) return;
  const order = personalizationState.projectOrder;
  const idx = order.indexOf(projectId);
  if (idx === -1) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= order.length) return;
  [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
  renderPersonalizationPage();
}

function renderShortcutsSelector(selected) {
  return `
    <div class="glass rounded-2xl p-4">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="layout-grid" class="w-4 h-4 text-fg-muted"></i>
        <h3 class="text-sm font-bold">میان‌برهای داشبورد</h3>
      </div>
      <div class="space-y-2">
        ${[0, 1, 2, 3].map(i => {
          const currentValue = selected[i] || '';
          return `
            <div>
              <label class="text-[10px] text-fg-muted block mb-1">جایگاه ${toPersianDigits(i + 1)}</label>
              <select onchange="window.__setShortcut(${i}, this.value)" class="w-full h-10 px-3 rounded-xl bg-ink-soft border border-line focus:border-brand outline-none text-sm transition appearance-none">
                <option value="" ${!currentValue ? 'selected' : ''} style="background: #0f1d32;">— انتخاب —</option>
                ${SHORTCUT_OPTIONS.map(opt => `<option value="${opt.value}" ${currentValue === opt.value ? 'selected' : ''} style="background: #0f1d32;">${opt.label}</option>`).join('')}
              </select>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function setShortcut(index, value) {
  if (!personalizationState) return;
  personalizationState.shortcuts[index] = value;
}

function savePersonalization() {
  if (!personalizationState) return;
  if (personalizationState.projectOrder) state.updateCustomOrder('projects_active', personalizationState.projectOrder);
  if (personalizationState.shortcuts) {
    storage.saveDashboardShortcuts(personalizationState.shortcuts);
    state.data.dashboardShortcuts = personalizationState.shortcuts;
  }
  showToast('تنظیمات ذخیره شد', 'success');
  navigate('/dashboard');
}
