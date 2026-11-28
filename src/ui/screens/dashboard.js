// src/ui/screens/dashboard.js
// داشبورد اصلی — فاز 10 PRD

import { state } from '../../core/state.js';
import { navigate } from '../../core/router.js';
import { Avatar, EmptyState, ProgressBar, SectionHeader } from '../components/ui.js';
import { openSheet, closeSheet } from '../components/sheet.js';
import { formatToman, formatTomanShort } from '../../utils/number.js';
import { formatJalali, toPersianDigits, getWeekday, today } from '../../utils/date.js';
import { getDashboardSummary, getProjectProgressPercent, getProjectReceived, getProjectRemaining, getEmployerBalance } from '../../domain/calculations.js';

const COLOR_HEX = {
  brand: '#0080ff', cta: '#ff7f00', purple: '#8b5cf6', cyan: '#22d3ee',
  pink: '#ec4899', success: '#36b37e', warning: '#ffab00', info: '#6554c0'
};

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h <= 11) return 'صبح بخیر';
  if (h >= 12 && h <= 16) return 'ظهر بخیر';
  if (h >= 17 && h <= 20) return 'عصر بخیر';
  return 'شب بخیر';
}

export function renderDashboardPage() {
  const settings = state.data.settings || {};
  const main = document.getElementById('page-content');

  if (!settings.onboardingCompleted) {
    main.innerHTML = `<div class="px-4 pt-10">${renderWelcomeState()}</div>`;
    if (window.lucide) window.lucide.createIcons();
    window.__navigate = (path) => navigate(path);
    return;
  }

  const summary = getDashboardSummary(state.data);
  const userName = settings.userName || 'کاربر';
  const greeting = getGreeting();
  const firstLetter = userName ? userName.charAt(0) : 'ک';

  const activeProjects = (state.data.projects || []).filter(p => !p.deletedAt && p.status === 'active').slice(0, 3);
  const recentItems = getRecentTransactions(5);
  const topDebtors = (summary.debtors || []).slice(0, 3);

  const progressPercent = summary.totalExpected > 0 ? Math.round((summary.totalReceived / summary.totalExpected) * 100) : 0;

  main.innerHTML = `
    <div class="px-4 pt-4 pb-28 space-y-5">
      ${renderGreetingHeader(firstLetter, greeting, userName, settings.avatarColor, settings.avatarIcon || '')}
      ${renderBalanceCard(summary, progressPercent)}
      ${summary.partnerDebtTotal > 0 ? renderPartnerDebtSummary(summary) : ''}
      ${renderQuickActions()}
      ${activeProjects.length > 0 ? renderActiveProjects(activeProjects) : ''}
      ${recentItems.length > 0 ? renderRecentTransactions(recentItems) : ''}
      ${topDebtors.length > 0 ? renderTopDebtors(topDebtors) : ''}
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  window.__navigate = (path) => navigate(path);
  window.__openDashboardReminders = openDashboardReminders;
}

function renderWelcomeState() {
  return `
    <div class="flex flex-col items-center justify-center text-center py-10 px-4">
      <div class="w-24 h-24 rounded-3xl bg-gradient-to-br from-brand to-cta flex items-center justify-center mb-6 shadow-2xl shadow-brand/40">
        <i data-lucide="wallet" class="w-12 h-12 text-white"></i>
      </div>
      <h2 class="text-xl font-bold mb-2">به مدیریت مالی خوش آمدی</h2>
      <p class="text-sm text-fg-muted mb-8 max-w-[280px]">برای شروع، اپ را در چند قدم ساده آماده استفاده کن.</p>
      <button onclick="window.__navigate('/onboarding')" class="h-12 px-6 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium shadow-lg shadow-cta/30 transition flex items-center gap-2">
        <i data-lucide="sparkles" class="w-4 h-4"></i> شروع کنید
      </button>
    </div>
  `;
}

function renderGreetingHeader(firstLetter, greeting, userName, avatarColor, avatarIcon = '') {
  const todayIso = today();
  const weekday = getWeekday(todayIso);
  const dateStr = formatJalali(todayIso);
  return `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        ${Avatar({ text: avatarIcon ? '<i data-lucide="' + avatarIcon + '" class="w-5 h-5"></i>' : firstLetter, color: avatarColor || 'brand', size: 'md' })}
        <div>
          <p class="text-[11px] text-fg-muted">${greeting}</p>
          <p class="text-sm font-bold">${userName}</p>
          <p class="text-[10px] text-fg-muted mt-0.5 flex items-center gap-1">
            <i data-lucide="calendar" class="w-3 h-3"></i>
            ${weekday} · ${dateStr}
          </p>
        </div>
      </div>

    </div>
  `;
}

// === یادآوری‌ها ===
export function getReminderItems() {
  const items = [];
  const completedProjects = (state.data.projects || []).filter(p => !p.deletedAt && (p.status === 'archived' || p.status === 'completed'));
  for (const p of completedProjects) {
    const remaining = getProjectRemaining(p.id, state.data);
    if (remaining > 0) items.push({ type: 'project', icon: 'briefcase', color: 'cta', title: p.title, amount: remaining, description: 'تسویه نشده', path: `/project/${p.id}` });
  }
  const unknownProjects = (state.data.projects || []).filter(p => !p.deletedAt && p.status !== 'archived' && (p.amountUndetermined === true || p.amount == null));
  for (const p of unknownProjects) items.push({ type: 'unknown-project', icon: 'circle-help', color: 'warning', title: p.title, description: 'مبلغ پروژه مشخص نشده', path: `/project/${p.id}` });
  const employers = (state.data.employers || []).filter(e => !e.deletedAt);
  for (const e of employers) {
    const balance = getEmployerBalance(e.id, state.data);
    if (balance.balance > 0) items.push({ type: 'employer', icon: 'user', color: 'danger', title: e.name, amount: balance.balance, description: 'مطالبات دریافت‌نشده', path: '/employers' });
  }
  return items;
}

export function openDashboardReminders() {
  const items = getReminderItems();
  if (!items.length) return;
  const colorMap = { cta: 'bg-cta/15 text-cta', danger: 'bg-danger-soft text-danger', warning: 'bg-warning-soft text-warning' };
  const listHtml = items.map(item => `
    <button type="button" onclick="window.__closeDashboardReminders(); window.__navigate('${item.path}')" class="w-full text-right glass rounded-xl p-3 flex items-center gap-2.5 hover:bg-white/8 transition">
      <div class="w-9 h-9 rounded-lg ${colorMap[item.color] || 'glass'} flex items-center justify-center shrink-0"><i data-lucide="${item.icon}" class="w-4 h-4"></i></div>
      <div class="flex-1 min-w-0"><p class="text-xs font-bold truncate">${item.title}</p><span class="inline-block mt-1 text-[10px] text-fg-muted">${item.description}</span></div>
      ${item.amount != null ? `<p class="text-xs font-bold tabular-nums text-warning shrink-0">${formatTomanShort(item.amount)}</p>` : '<i data-lucide="chevron-left" class="w-4 h-4 text-fg-muted shrink-0"></i>'}
    </button>
  `).join('');
  openSheet(`
    <div class="pb-2">
      <div class="flex items-center justify-between mb-4">
        <div><h3 class="text-base font-bold">یادآوری‌ها</h3><p class="text-[11px] text-fg-muted mt-1">${toPersianDigits(items.length)} مورد نیازمند پیگیری</p></div>
        <button onclick="window.__closeDashboardReminders()" class="w-8 h-8 rounded-lg glass flex items-center justify-center" aria-label="بستن"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>
      <div class="space-y-2 max-h-[65vh] overflow-y-auto">${listHtml}</div>
    </div>
  `);
  window.__closeDashboardReminders = closeSheet;
  if (window.lucide) window.lucide.createIcons();
}

function renderBalanceCard(summary, percent) {
  return `
    <div class="rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-5 shadow-2xl shadow-brand/30">
      <div class="flex items-center justify-between mb-3">
        <p class="text-xs text-white/80">موجودی کل پروژه‌ها</p>
        <i data-lucide="wallet" class="w-5 h-5 text-white/80"></i>
      </div>
      <p class="text-2xl font-bold text-white tabular-nums mb-1">${formatToman(summary.totalRemaining)}</p>
      <div class="flex items-center gap-2 mb-3">
        <span class="text-[10px] text-white/70">${toPersianDigits(percent)}٪ دریافتی</span>
        <div class="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div class="h-full rounded-full bg-white transition-all duration-500" style="width: ${percent}%"></div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 pt-3 border-t border-white/15">
        <div><p class="text-[10px] text-white/70 mb-0.5">انتظار</p><p class="text-xs font-bold text-white tabular-nums">${formatTomanShort(summary.totalExpected)}</p></div>
        <div><p class="text-[10px] text-white/70 mb-0.5">دریافتی</p><p class="text-xs font-bold text-white tabular-nums">${formatTomanShort(summary.totalReceived)}</p></div>
      </div>
    </div>
  `;
}

function renderPartnerDebtSummary(summary) {
  return `
    <div onclick="window.__navigate('/partners')" class="glass-strong rounded-2xl p-4 cursor-pointer hover:bg-white/8 transition">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-danger-soft text-danger flex items-center justify-center"><i data-lucide="users" class="w-4 h-4"></i></div>
          <div><p class="text-xs font-bold">بدهی بین شرکا</p><p class="text-[10px] text-fg-muted mt-0.5">${toPersianDigits(summary.partnerDebtorsCount)} بدهکار · ${toPersianDigits(summary.partnerCreditorsCount)} طلبکار</p></div>
        </div>
        <i data-lucide="chevron-left" class="w-4 h-4 text-fg-muted"></i>
      </div>
      <p class="text-xl font-bold text-danger tabular-nums">${formatToman(summary.partnerDebtTotal)}</p>
      <p class="text-[10px] text-fg-muted mt-1">مجموع بدهی خالص شرکا؛ برای مشاهده جزئیات لمس کنید</p>
      ${summary.topPartnerDebtors.length ? `
        <div class="mt-3 pt-2 border-t border-white/5 space-y-1.5">
          ${summary.topPartnerDebtors.map(b => `<div class="flex items-center justify-between text-[10px]"><span class="text-fg-muted">${b.partner.name} · بدهکار</span><span class="font-bold text-danger tabular-nums">${formatTomanShort(b.overallPosition)}</span></div>`).join('')}
        </div>` : ''}
    </div>
  `;
}

function renderQuickActions() {
  const actions = [
    { icon: 'arrow-down-left', label: 'دریافتی', path: '/transaction/add', color: 'success' },
    { icon: 'arrow-up-right', label: 'هزینه', path: '/expense/add', color: 'danger' },
    { icon: 'arrow-right-left', label: 'انتقال', path: '/transfer/add', color: 'info' },
    { icon: 'calendar', label: 'فعالیت', path: '/activity/add', color: 'brand' },
    { icon: 'chart-pie', label: 'گزارش', path: '/reports', color: 'cta' }
  ];
  const colorMap = {
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
    brand: 'bg-brand/15 text-brand',
    cta: 'bg-cta/15 text-cta',
    info: 'bg-info-soft text-purple-300'
  };
  return `
    <div class="grid grid-cols-5 gap-1.5">
      ${actions.map(a => `
        <button onclick="window.__navigate('${a.path}')" class="flex flex-col items-center gap-1.5 py-2 rounded-xl transition active:scale-95 hover:bg-white/5 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5">
          <div class="w-11 h-11 rounded-xl ${colorMap[a.color]} flex items-center justify-center transition group-hover:scale-110"><i data-lucide="${a.icon}" class="w-5 h-5"></i></div>
          <span class="text-[10px] text-fg-muted font-medium">${a.label}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderActiveProjects(projects) {
  return `
    <div>
      ${SectionHeader({ title: 'پروژه‌های فعال', action: 'همه', actionOnClick: "window.__navigate('/projects')" })}
      <div class="space-y-2.5 mt-2.5">${projects.map(renderProjectCard).join('')}</div>
    </div>
  `;
}

function renderProjectCard(project) {
  const colorHex = COLOR_HEX[project.color] || COLOR_HEX.brand;
  const received = getProjectReceived(project.id, state.data);
  const remaining = getProjectRemaining(project.id, state.data);
  const percent = getProjectProgressPercent(project.id, state.data);
  const deadline = project.endDate || project.startDate;

  return `
    <div onclick="window.__navigate('/project/${project.id}')" class="glass rounded-2xl p-4 hover:bg-white/10 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 transition active:scale-[0.98]">
      <div class="flex items-start gap-2.5 mb-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style="background: ${colorHex}20;">
          <i data-lucide="briefcase" class="w-5 h-5" style="color: ${colorHex};"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold truncate">${project.title}</p>
          <p class="text-[10px] text-fg-muted flex items-center gap-1 mt-0.5">
            <i data-lucide="calendar" class="w-3 h-3"></i>${deadline ? formatJalali(deadline) : 'بدون مهلت'}
          </p>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2 mb-3 text-center">
        <div class="rounded-lg bg-white/5 py-2"><p class="text-[9px] text-fg-muted">مبلغ</p><p class="text-xs font-bold tabular-nums">${formatTomanShort(project.amount)}</p></div>
        <div class="rounded-lg bg-white/5 py-2"><p class="text-[9px] text-fg-muted">دریافتی</p><p class="text-xs font-bold tabular-nums text-success">${formatTomanShort(received)}</p></div>
        <div class="rounded-lg bg-white/5 py-2"><p class="text-[9px] text-fg-muted">باقیمانده</p><p class="text-xs font-bold tabular-nums text-cta">${formatTomanShort(remaining)}</p></div>
      </div>
      <div class="flex items-center justify-between text-[10px] mb-1.5">
        <span class="text-fg-muted">پیشرفت تسویه</span><span class="font-medium">${toPersianDigits(percent)}٪</span>
      </div>
      ${ProgressBar({ value: percent })}
    </div>
  `;
}

function getRecentTransactions(limit) {
  const items = [];
  for (const r of (state.data.receipts || []).filter(r => !r.deletedAt)) {
    const employer = (state.data.employers || []).find(e => e.id === r.employerId);
    items.push({ id: r.id, type: 'receipt', date: r.date, amount: r.amount, title: `دریافتی از ${employer ? employer.name : 'کارفرما'}` });
  }
  for (const e of (state.data.expenses || []).filter(e => !e.deletedAt)) {
    items.push({ id: e.id, type: 'expense', date: e.date, amount: e.amount, title: e.title || 'هزینه' });
  }
  for (const t of (state.data.partnerTransfers || []).filter(t => !t.deletedAt)) {
    const toPartner = (state.data.partners || []).find(p => p.id === t.toPartnerId);
    items.push({ id: t.id, type: 'transfer', date: t.date, amount: t.amount, title: `انتقال به ${toPartner ? toPartner.name : 'شریک'}` });
  }
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  return items.slice(0, limit);
}

function renderRecentTransactions(items) {
  const config = {
    receipt:  { icon: 'arrow-down-left',  color: 'success', prefix: '+', isInflow: true },
    expense:  { icon: 'arrow-up-right',    color: 'danger',  prefix: '-', isInflow: false },
    transfer: { icon: 'arrow-left-right',  color: 'info',    prefix: '-', isInflow: false }
  };
  const colorMap = { success: 'bg-success-soft text-success', danger: 'bg-danger-soft text-danger', info: 'bg-info-soft text-purple-300' };
  return `
    <div>
      ${SectionHeader({ title: 'تراکنش‌های اخیر', action: 'همه', actionOnClick: "window.__navigate('/transactions')" })}
      <div class="glass rounded-2xl divide-y divide-line/50 mt-2.5">
        ${items.map(item => {
          const c = config[item.type];
          return `
            <div class="flex items-center gap-3 p-3">
              <div class="w-9 h-9 rounded-xl ${colorMap[c.color]} flex items-center justify-center shrink-0"><i data-lucide="${c.icon}" class="w-4 h-4"></i></div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-bold truncate">${item.title}</p>
                <p class="text-[10px] text-fg-muted">${formatJalali(item.date)}</p>
              </div>
              <p class="text-xs font-bold tabular-nums ${c.isInflow ? 'text-success' : 'text-danger'}">${c.prefix}${formatTomanShort(item.amount)}</p>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderTopDebtors(debtors) {
  return `
    <div>
      ${SectionHeader({ title: 'بدهکاران برتر' })}
      <div class="space-y-2.5 mt-2.5">
        ${debtors.map(d => {
          const employer = d.employer;
          return `
            <div onclick="window.__navigate('/employers')" class="glass rounded-2xl p-3.5 flex items-center gap-3 hover:bg-white/8 transition active:scale-[0.98]">
              ${Avatar({ text: (employer.name || '').charAt(0), color: employer.avatarColor || 'brand', size: 'md' })}
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold truncate">${employer.name}</p>
                <p class="text-[10px] text-fg-muted">بدهکار</p>
              </div>
              <span class="text-sm font-bold text-danger tabular-nums">${formatTomanShort(d.balance)}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
