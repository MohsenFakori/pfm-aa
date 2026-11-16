// src/ui/screens/projects.js
// صفحه پروژه‌ها — فاز 4 PRD

import { repo } from '../../core/repository.js';
import { state } from '../../core/state.js';
import { navigate } from '../../core/router.js';
import { showToast } from '../components/toast.js';
import { openSheet, closeSheet, confirmDialog } from '../components/sheet.js';
import { openDatePicker } from '../components/datepicker.js';
import { Badge, Input, Select, Textarea, EmptyState, Tabs, ProgressBar } from '../components/ui.js';
import { formatToman, formatTomanShort, parseIntAmount } from '../../utils/number.js';
import { formatJalali, toPersianDigits, today } from '../../utils/date.js';
import { getProjectReceived, getProjectRemaining, getProjectProgressPercent } from '../../domain/calculations.js';
import { validate, PROJECT_COLORS, PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '../../domain/validators.js';

const COLOR_GRADIENTS = {
  brand: 'from-brand to-brand-dark', cta: 'from-cta to-cta-dark',
  purple: 'from-purple-500 to-pink-500', cyan: 'from-cyan-500 to-blue-500',
  pink: 'from-pink-500 to-rose-500', success: 'from-success to-emerald-700',
  warning: 'from-warning to-cta', info: 'from-info to-purple-500'
};
const COLOR_HEX = {
  brand: '#0080ff', cta: '#ff7f00', purple: '#8b5cf6', cyan: '#22d3ee',
  pink: '#ec4899', success: '#36b37e', warning: '#ffab00', info: '#6554c0'
};
const STATUS_CONFIG = {
  active: { color: 'warning', label: 'فعال', icon: 'circle' },
  completed: { color: 'success', label: 'تکمیل‌شده', icon: 'check-circle' },
  archived: { color: 'fg-muted', label: 'بایگانی‌شده', icon: 'archive' }
};

let searchTerm = '';
let activeProjectTab = 'receipts';
let currentDetailParams = null;
let projectFormState = null;

function formatAmountInput(value) {
  const digits = toLatinDigits(String(value ?? '')).replace(/[^\d]/g, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function amountToPersianWords(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) return '';

  const ones = ['','یک','دو','سه','چهار','پنج','شش','هفت','هشت','نه'];
  const teens = ['ده','یازده','دوازده','سیزده','چهارده','پانزده','شانزده','هفده','هجده','نوزده'];
  const tens = ['','','بیست','سی','چهل','پنجاه','شصت','هفتاد','هشتاد','نود'];
  const hundreds = ['','صد','دویست','سیصد','چهارصد','پانصد','ششصد','هفتصد','هشتصد','نهصد'];
  const scales = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

  const underThousand = (n) => {
    const parts = [];
    if (n >= 100) parts.push(hundreds[Math.floor(n / 100)]);
    n %= 100;
    if (n >= 20) {
      parts.push(tens[Math.floor(n / 10)]);
      if (n % 10) parts.push(ones[n % 10]);
    } else if (n >= 10) {
      parts.push(teens[n - 10]);
    } else if (n > 0) {
      parts.push(ones[n]);
    }
    return parts.join(' و ');
  };

  const parts = [];
  let remaining = number;
  let scaleIndex = 0;
  while (remaining > 0) {
    const chunk = remaining % 1000;
    if (chunk) {
      const words = underThousand(chunk);
      parts.unshift(scales[scaleIndex] ? words + ' ' + scales[scaleIndex] : words);
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex++;
  }
  return parts.join(' و ');
}

function defaultProjectFormState() {
  return {
    step: 1, editId: null,
    title: '', employerId: '', amount: '', amountUndetermined: false, amountType: 'fixed_start',
    startDate: '', endDate: '', status: 'active', color: 'brand', note: '', pinned: false,
    selectedPartners: [], partnerShares: {}
  };
}

// =========== LIST PAGE ===========
export function renderProjectsPage() {
  const allProjects = (state.data.projects || []).filter(p => !p.deletedAt);
  const tags = (state.data.tags || []).filter(t => !t.deletedAt);
  const main = document.getElementById('page-content');

  if (allProjects.length === 0) {
    main.innerHTML = `
      <div class="px-4 pt-6">
        ${EmptyState({ icon: 'briefcase', title: 'هنوز پروژه‌ای ثبت نشده', description: 'برای شروع، اولین پروژه خود را ایجاد کنید.', actionLabel: 'ایجاد پروژه', actionOnClick: 'window.__openProjectForm()' })}
      </div>
      ${renderFab()}
    `;
    if (window.lucide) window.lucide.createIcons();
    window.__openProjectForm = () => openProjectForm();
    return;
  }

  function getFiltered() {
    const q = searchTerm.trim().toLowerCase();
    return allProjects.filter(p => {
      if (q && !(p.title || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function sortProjects(list) {
    return [...list].sort((a, b) => {
      if (a.status === 'active' && b.status === 'active') {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  const filtered = sortProjects(getFiltered());
  const active = filtered.filter(p => p.status === 'active');
  const completed = filtered.filter(p => p.status === 'completed');
  const archived = filtered.filter(p => p.status === 'archived');

  main.innerHTML = `
    <div class="px-4 pt-4 pb-32">
      ${renderSearch('project-search', 'جستجوی پروژه...')}
      <div class="mt-4" id="projects-list">
        ${renderProjectSection('active', active) + renderProjectSection('completed', completed) + renderProjectSection('archived', archived)}
      </div>
    </div>
    ${renderFab()}
  `;

  if (window.lucide) window.lucide.createIcons();

  const searchInput = document.getElementById('project-search');
  if (searchInput) {
    searchInput.value = searchTerm;
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      const listEl = document.getElementById('projects-list');
      if (listEl) {
        const reFiltered = sortProjects(getFiltered());
        const rActive = reFiltered.filter(p => p.status === 'active');
        const rCompleted = reFiltered.filter(p => p.status === 'completed');
        const rArchived = reFiltered.filter(p => p.status === 'archived');
        listEl.innerHTML = renderProjectSection('active', rActive) + renderProjectSection('completed', rCompleted) + renderProjectSection('archived', rArchived);
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  window.__openProjectForm = () => openProjectForm();
  window.__navigate = (path) => navigate(path);
}

function renderProjectSection(status, projects) {
  if (projects.length === 0) return '';
  const config = STATUS_CONFIG[status];
  return `
    <div class="mb-5">
      <div class="flex items-center gap-2 mb-2.5 px-1">
        <div class="w-2 h-2 rounded-full bg-${config.color}"></div>
        <p class="text-sm font-bold">${config.label}</p>
        <span class="text-[10px] text-fg-muted bg-white/5 px-2 py-0.5 rounded-md">${toPersianDigits(projects.length)}</span>
      </div>
      <div class="space-y-2.5">
        ${projects.map(renderProjectCard).join('')}
      </div>
    </div>
  `;
}

function renderProjectCard(project) {
  const colorHex = COLOR_HEX[project.color] || COLOR_HEX.brand;
  const received = getProjectReceived(project.id, state.data);
  const remaining = getProjectRemaining(project.id, state.data);
  const percent = getProjectProgressPercent(project.id, state.data);
  const statusConfig = STATUS_CONFIG[project.status];
  const statusVariant = { active: 'warning', completed: 'success', archived: 'default' }[project.status];
  const deadline = project.endDate || project.startDate;

  return `
    <div onclick="window.__navigate('/project/${project.id}')" class="glass rounded-2xl p-4 hover:bg-white/8 transition active:scale-[0.98]">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2.5 flex-1 min-w-0">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style="background: ${colorHex}20;">
            <i data-lucide="briefcase" class="w-5 h-5" style="color: ${colorHex};"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold truncate">${project.title}</p>
            <p class="text-[10px] text-fg-muted flex items-center gap-1 mt-0.5">
              <i data-lucide="calendar" class="w-3 h-3"></i>
              ${deadline ? formatJalali(deadline) : 'بدون مهلت'}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          ${project.pinned ? '<i data-lucide="bookmark" class="w-3.5 h-3.5 text-cta"></i>' : ''}
          ${Badge({ variant: statusVariant, label: statusConfig.label })}
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2 mb-3 text-center">
        <div class="rounded-lg bg-white/5 py-2">
          <p class="text-[9px] text-fg-muted">مبلغ</p>
          <p class="text-xs font-bold tabular-nums">${project.amountUndetermined ? 'نامشخص' : formatTomanShort(project.amount)}</p>
        </div>
        <div class="rounded-lg bg-white/5 py-2">
          <p class="text-[9px] text-fg-muted">دریافتی</p>
          <p class="text-xs font-bold tabular-nums text-success">${formatTomanShort(received)}</p>
        </div>
        <div class="rounded-lg bg-white/5 py-2">
          <p class="text-[9px] text-fg-muted">باقیمانده</p>
          <p class="text-xs font-bold tabular-nums text-cta">${project.amountUndetermined ? '—' : formatTomanShort(remaining)}</p>
        </div>
      </div>

      <div class="flex items-center justify-between text-[10px] mb-1.5">
        <span class="text-fg-muted">پیشرفت تسویه</span>
        <span class="font-medium">${project.amountUndetermined ? '—' : toPersianDigits(percent) + '٪'}</span>
      </div>
      ${project.amountUndetermined ? '' : ProgressBar({ value: percent })}
    </div>
  `;
}

function renderSearch(inputId, placeholder) {
  return `
    <div class="relative">
      <i data-lucide="search" class="w-4 h-4 text-fg-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
      <input id="${inputId}" type="text" placeholder="${placeholder}" class="w-full h-11 pr-10 pl-4 rounded-xl bg-ink-soft border border-line focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-sm transition" />
    </div>
  `;
}

function renderFab() {
  return `
    <div class="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 pointer-events-none z-30">
      <div class="flex justify-end">
        <button onclick="window.__openProjectForm()" class="pointer-events-auto w-14 h-14 rounded-2xl bg-cta hover:bg-cta-dark text-white shadow-xl shadow-cta/40 flex items-center justify-center transition active:scale-95">
          <i data-lucide="plus" class="w-6 h-6"></i>
        </button>
      </div>
    </div>
  `;
}

// =========== PROJECT TEMPLATES ===========
const TEMPLATES_KEY = 'pfm:templates';

function getTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load templates:', e);
    return [];
  }
}

function saveTemplatesList(list) {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save templates:', e);
  }
}

function openTemplatePicker() {
  const templates = getTemplates();
  const employers = (state.data.employers || []).filter(e => !e.deletedAt);

  const listHtml = templates.length === 0
    ? `<div class="text-center py-8">
        <div class="w-12 h-12 rounded-2xl glass-strong flex items-center justify-center mx-auto mb-3">
          <i data-lucide="layout-template" class="w-6 h-6 text-fg-muted"></i>
        </div>
        <p class="text-xs text-fg-muted">هنوز قالبی ذخیره نشده</p>
        <p class="text-[10px] text-fg-subtle mt-1">بعد از تکمیل فرم، روی «ذخیره به‌عنوان قالب» بزنید</p>
      </div>`
    : templates.map((t, i) => {
        const employer = employers.find(e => e.id === t.employerId);
        const partnerCount = Object.keys(t.partnerShares || {}).length;
        return `
          <div class="glass rounded-xl p-3 flex items-center gap-2.5">
            <button onclick="window.__applyTemplate(${i})" class="flex-1 flex items-center gap-2.5 text-right min-w-0">
              <div class="w-9 h-9 rounded-lg bg-gradient-to-br ${COLOR_GRADIENTS[t.color] || COLOR_GRADIENTS.brand} flex items-center justify-center shrink-0">
                <i data-lucide="briefcase" class="w-4 h-4 text-white"></i>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-bold truncate">${t.name}</p>
                <p class="text-[10px] text-fg-muted">
                  ${employer ? employer.name : 'بدون کارفرما'}
                  ${t.amountUndetermined ? ' · مبلغ نامشخص' : (t.amount ? ' · ' + formatTomanShort(t.amount) : '')}
                  ${partnerCount > 0 ? ' · ' + toPersianDigits(partnerCount) + ' شریک' : ''}
                </p>
              </div>
            </button>
            <button onclick="window.__deleteTemplate(${i})" class="w-8 h-8 rounded-lg glass text-danger hover:bg-danger/10 flex items-center justify-center shrink-0">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        `;
      }).join('');

  const content = `
    <div class="pb-2">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold">انتخاب قالب</h3>
        <button onclick="window.__cancelTemplatePicker()" class="w-8 h-8 rounded-lg glass flex items-center justify-center">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="space-y-2 max-h-[55vh] overflow-y-auto">${listHtml}</div>
    </div>
  `;

  openSheet(content, {
    onMount: () => {
      window.__cancelTemplatePicker = () => closeSheet();
      window.__applyTemplate = (idx) => {
        const tpl = templates[idx];
        if (tpl) applyTemplate(tpl);
      };
      window.__deleteTemplate = (idx) => {
        const newList = getTemplates().filter((_, i) => i !== idx);
        saveTemplatesList(newList);
        showToast('قالب حذف شد', 'success');
        // Refresh the picker sheet
        const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
        if (sheet) {
          const contentEl = sheet.querySelector('.sheet-content');
          if (contentEl) {
            // Re-open picker
            closeSheet();
            openTemplatePicker();
          }
        }
      };
      if (window.lucide) window.lucide.createIcons();
    }
  });
}

function applyTemplate(tpl) {
  if (!tpl) return;
  // Pre-fill form state from template (only fields that exist in template)
  if (tpl.employerId) projectFormState.employerId = tpl.employerId;
  if (tpl.amountUndetermined === true) {
    projectFormState.amountUndetermined = true;
    projectFormState.amount = '';
  } else if (tpl.amount != null) {
    projectFormState.amount = String(tpl.amount);
    projectFormState.amountUndetermined = false;
  }
  if (tpl.color) projectFormState.color = tpl.color;
  if (tpl.partnerShares && typeof tpl.partnerShares === 'object') {
    // Validate that the partner IDs in the template still exist
    const validPartnerIds = (state.data.partners || []).filter(p => !p.deletedAt).map(p => p.id);
    projectFormState.selectedPartners = Object.keys(tpl.partnerShares)
      .filter(pid => validPartnerIds.includes(pid));
    projectFormState.partnerShares = {};
    for (const pid of projectFormState.selectedPartners) {
      projectFormState.partnerShares[pid] = tpl.partnerShares[pid];
    }
  }
  closeSheet();
  refreshProjectFormSheet();
  showToast('قالب اعمال شد', 'success');
}

function saveAsTemplate() {
  syncProjectFormInputs();

  // نام قالب را از کاربر بگیریریم
  const defaultName = projectFormState.title || 'قالب بدون نام';
  const name = window.prompt('نام قالب را وارد کنید:', defaultName);
  if (!name || !name.trim()) return;

  const template = {
    name: name.trim(),
    employerId: projectFormState.employerId || null,
    amount: projectFormState.amountUndetermined ? null : (parseIntAmount(projectFormState.amount) || 0),
    amountUndetermined: projectFormState.amountUndetermined, 
    color: projectFormState.color || 'brand',
    partnerShares: { ...projectFormState.partnerShares }
  };

  const list = getTemplates();
  list.push(template);
  saveTemplatesList(list);
  showToast('قالب ذخیره شد', 'success');
}

// =========== MULTI-STEP FORM ===========
function openProjectForm(id = null) {
  projectFormState = defaultProjectFormState();
  if (id) {
    const project = (state.data.projects || []).find(p => p.id === id);
    if (project) {
      projectFormState.editId = id;
      projectFormState.title = project.title || '';
      projectFormState.employerId = project.employerId || '';
      projectFormState.amount = String(project.amount ?? '');
      projectFormState.amountUndetermined = project.amountUndetermined === true;
      projectFormState.amountType = project.amountType || 'fixed_start';
      projectFormState.startDate = project.startDate || '';
      projectFormState.endDate = project.endDate || '';
      projectFormState.status = project.status || 'active';
      projectFormState.color = project.color || 'brand';
      projectFormState.note = project.note || '';
      projectFormState.pinned = project.pinned || false;

      const existingShares = (state.data.projectShares || []).filter(s => s.projectId === id);
      for (const share of existingShares) {
        projectFormState.selectedPartners.push(share.partnerId);
        projectFormState.partnerShares[share.partnerId] = share.percentage;
      }
    }
  }
  showProjectFormSheet();
}

function showProjectFormSheet() {
  const content = renderProjectFormContent();
  openSheet(content, {
    onMount: () => {
      attachProjectFormListeners();
      window.__closeProjectForm = () => closeSheet();
      window.__projectFormNext = projectFormNext;
      window.__projectFormPrev = projectFormPrev;
      window.__projectFormSave = projectFormSave;
      window.__pickProjectColor = (color) => { projectFormState.color = color; refreshProjectFormSheet(); };
      window.__openDateField = openDateField;
      window.__clearDateField = clearDateField;
      window.__togglePartner = togglePartner;
      window.__distributeEqually = distributeEqually;
      window.__quickAddEmployer = quickAddEmployer;
      window.__quickAddPartner = quickAddPartner;
      window.__navigate = (path) => { closeSheet(); navigate(path); };
      window.__openTemplatePicker = openTemplatePicker;
      window.__applyTemplate = applyTemplate;
      window.__saveAsTemplate = saveAsTemplate;
      window.__deleteTemplate = deleteTemplate;
      window.__cancelTemplatePicker = () => closeSheet();
    }
  });
}

function refreshProjectFormSheet() {
  const formSheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (formSheet) {
    const contentEl = formSheet.querySelector('.sheet-content');
    if (contentEl) {
      contentEl.innerHTML = renderProjectFormContent();
      if (window.lucide) window.lucide.createIcons();
      attachProjectFormListeners();
    }
  } else {
    showProjectFormSheet();
  }
}

function renderProjectFormContent() {
  const step = projectFormState.step;
  let stepHtml = '';
  if (step === 1) stepHtml = renderStep1();
  else if (step === 2) stepHtml = renderStep2();

  return `
    <div class="pb-2">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold">${projectFormState.editId ? 'ویرایش پروژه' : 'پروژه جدید'}</h3>
        <button onclick="window.__closeProjectForm()" class="w-8 h-8 rounded-lg glass flex items-center justify-center">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      ${renderStepIndicator(step)}
      <div class="mt-4">${stepHtml}</div>
      <div class="flex gap-2 mt-6">
        ${step > 1 ? `
          <button onclick="window.__projectFormPrev()" class="flex-1 h-11 rounded-xl glass text-sm font-medium hover:bg-white/10 transition flex items-center justify-center gap-2">
            <i data-lucide="chevron-right" class="w-4 h-4"></i> قبلی
          </button>
        ` : ''}
        ${step < 2 ? `
          <button onclick="window.__projectFormNext()" class="flex-1 h-11 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-brand/30">
            بعدی <i data-lucide="chevron-left" class="w-4 h-4"></i>
          </button>
        ` : ''}
        ${step === 2 ? `
          <button onclick="window.__projectFormSave()" class="flex-1 h-11 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-cta/30">
            <i data-lucide="check" class="w-4 h-4"></i> ثبت پروژه
          </button>
        ` : ''}
      </div>
      ${step === 2 && !projectFormState.editId ? `
        <button onclick="window.__saveAsTemplate()" class="w-full h-10 mt-2 rounded-xl glass border border-line hover:bg-white/8 text-[11px] font-medium text-fg-muted transition flex items-center justify-center gap-2">
          <i data-lucide="bookmark-plus" class="w-4 h-4"></i>
          ذخیره به‌عنوان قالب
        </button>
      ` : ''}
    </div>
  `;
}

function renderStepIndicator(currentStep) {
  const steps = ['اطلاعات', 'شرکا'];
  return `
    <div class="flex items-center gap-2">
      ${steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isDone = stepNum < currentStep;
        return `
          <div class="flex items-center gap-1.5 flex-1">
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isActive ? 'bg-brand text-white' : isDone ? 'bg-success text-white' : 'glass text-fg-muted'}">
              ${isDone ? '<i data-lucide="check" class="w-3.5 h-3.5"></i>' : toPersianDigits(stepNum)}
            </div>
            <span class="text-[10px] ${isActive ? 'text-fg font-medium' : 'text-fg-muted'} truncate">${label}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderStep1() {
  const employers = (state.data.employers || []).filter(e => !e.deletedAt);
  const employerOptions = employers.map(e => ({ value: e.id, label: e.name }));
  const showTemplateButton = !projectFormState.editId;

  return `
    <div class="space-y-3">
      ${showTemplateButton ? `
        <button onclick="window.__openTemplatePicker()" class="w-full h-10 rounded-xl glass border border-line hover:bg-white/8 text-xs font-medium transition flex items-center justify-center gap-2">
          <i data-lucide="layout-template" class="w-4 h-4"></i>
          از قالب
        </button>
      ` : ''}
      ${Input({ name: 'title', label: 'عنوان پروژه', placeholder: 'مثلاً: اپلیکیشن فروش', value: projectFormState.title, required: true, icon: 'briefcase' })}

      ${employers.length === 0
        ? `<div class="rounded-xl bg-warning-soft p-3 text-xs text-warning flex items-center gap-2">
            <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i>
            <span class="flex-1">هنوز کارفرمایی ثبت نشده.</span>
            <button onclick="window.__quickAddEmployer()" class="text-brand font-medium underline shrink-0">افزودن</button>
          </div>`
        : `<div class="relative">
            ${Select({ name: 'employerId', label: 'کارفرما', options: employerOptions, value: projectFormState.employerId, required: true, placeholder: 'انتخاب کارفرما', icon: 'briefcase' })}
            <button type="button" onclick="window.__quickAddEmployer()" class="absolute left-1 top-7 w-9 h-9 rounded-lg bg-brand/15 text-brand hover:bg-brand/25 transition flex items-center justify-center" title="افزودن کارفرمای جدید">
              <i data-lucide="plus" class="w-4 h-4"></i>
            </button>
          </div>`
      }

      <div>
        <label class="text-xs text-fg-muted mb-1.5 block">مبلغ پروژه</label>
        <div class="relative">
          <input type="text" name="amount" placeholder="مبلغ به تومان" value="${formatAmountInput(projectFormState.amount)}" inputmode="numeric" ${projectFormState.amountUndetermined ? 'disabled' : ''}
            class="w-full h-11 pr-4 pl-20 rounded-xl bg-ink-soft border border-line focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-sm transition tabular-nums ${projectFormState.amountUndetermined ? 'opacity-50 cursor-not-allowed' : ''}" />
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-fg-muted bg-white/5 px-2 py-1 rounded-md pointer-events-none">تومان</span>
        </div>
        <p data-amount-words class="text-[11px] text-fg-muted mt-2 min-h-4" aria-live="polite"></p>
        <div class="mt-3 flex items-center justify-between gap-3">
          <span class="text-xs text-fg-muted">فعلاً مبلغ پروژه مشخص نیست</span>
          <button type="button" data-toggle-amount-undetermined role="switch"
            aria-checked="${projectFormState.amountUndetermined ? 'true' : 'false'}"
            aria-label="تغییر وضعیت مشخص بودن مبلغ پروژه"
            class="relative w-12 h-7 shrink-0 rounded-full transition ${projectFormState.amountUndetermined ? 'bg-success' : 'bg-white/15'}">
            <span class="absolute top-0.5 ${projectFormState.amountUndetermined ? 'left-0.5' : 'right-0.5'} w-6 h-6 rounded-full bg-white shadow-md transition-all"></span>
          </button>
        </div>
        ${projectFormState.amountUndetermined ? '<p class="text-[10px] text-warning mt-1.5">مبلغ پروژه فعلاً ثبت نمی‌شود و بعداً می‌توانید آن را مشخص کنید.</p>' : ''}
      </div>

      ${renderDateField('startDate', 'تاریخ شروع', projectFormState.startDate, true)}
      ${renderDateField('endDate', 'تاریخ پایان (اختیاری)', projectFormState.endDate, false)}

      <div>
        <label class="text-xs text-fg-muted mb-1.5 block">رنگ پروژه</label>
        <div class="flex flex-wrap gap-2">
          ${PROJECT_COLORS.map(color => `
            <button type="button" onclick="window.__pickProjectColor('${color}')" class="w-10 h-10 rounded-full bg-gradient-to-br ${COLOR_GRADIENTS[color]} flex items-center justify-center transition ${projectFormState.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-ink-soft' : ''}">
              ${projectFormState.color === color ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderDateField(fieldName, label, value, required) {
  return `
    <div>
      <label class="text-xs text-fg-muted mb-1.5 block">${label}${required ? ' <span class="text-danger">*</span>' : ''}</label>
      <div class="flex gap-2">
        <button onclick="window.__openDateField('${fieldName}')" class="flex-1 h-11 px-4 rounded-xl bg-ink-soft border border-line focus:border-brand outline-none text-sm transition flex items-center justify-between ${!value ? 'text-fg-muted' : ''}">
          <span>${value ? formatJalali(value) : 'انتخاب تاریخ'}</span>
          <i data-lucide="calendar" class="w-4 h-4 text-fg-muted"></i>
        </button>
        ${value && !required ? `
          <button onclick="window.__clearDateField('${fieldName}')" class="w-11 h-11 rounded-xl glass text-fg-muted hover:text-danger flex items-center justify-center transition shrink-0">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderStep2() {
  const partners = (state.data.partners || []).filter(p => !p.deletedAt);
  if (partners.length === 0) {
    return `
      <div class="rounded-xl bg-warning-soft p-4 text-center">
        <i data-lucide="users" class="w-8 h-8 text-warning mx-auto mb-2"></i>
        <p class="text-xs text-warning mb-3">هنوز شریکی ثبت نشده. ابتدا یک شریک اضافه کنید.</p>
        <button onclick="window.__navigate('/partners')" class="h-9 px-4 rounded-xl bg-warning text-white text-xs font-medium">افزودن شریک</button>
      </div>
    `;
  }

  const sum = projectFormState.selectedPartners.reduce((s, pid) => s + (projectFormState.partnerShares[pid] || 0), 0);
  const sumValid = projectFormState.selectedPartners.length === 0 || sum === 100;

  return `
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-xs text-fg-muted">شرکای پروژه و سهم درصدی هر کدام</p>
        <div class="flex items-center gap-2">
          <button onclick="window.__quickAddPartner()" class="text-[11px] text-brand font-medium hover:underline flex items-center gap-1">
            <i data-lucide="plus" class="w-3 h-3"></i> شریک جدید
          </button>
          ${projectFormState.selectedPartners.length > 0 ? `
            <span class="text-fg-subtle">·</span>
            <button onclick="window.__distributeEqually()" class="text-[11px] text-brand font-medium hover:underline">تقسیم مساوی</button>
          ` : ''}
        </div>
      </div>

      <div class="space-y-2">
        ${partners.map(partner => {
          const isSelected = projectFormState.selectedPartners.includes(partner.id);
          const percentage = projectFormState.partnerShares[partner.id] || '';
          return `
            <div class="glass rounded-xl p-3 ${isSelected ? 'border border-brand/40' : ''}">
              <div class="flex items-center gap-3">
                <label class="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                  <input type="checkbox" data-partner-id="${partner.id}" ${isSelected ? 'checked' : ''} onchange="window.__togglePartner('${partner.id}')" class="w-4 h-4 rounded accent-brand" />
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br ${COLOR_GRADIENTS[partner.avatarColor || 'brand']} flex items-center justify-center text-white font-bold text-xs shrink-0">
                    ${(partner.name || '').charAt(0)}
                  </div>
                  <span class="text-sm font-medium truncate">${partner.name}</span>
                </label>
                ${isSelected ? `
                  <div class="flex items-center gap-1 shrink-0">
                    <input type="text" inputmode="numeric" value="${percentage !== '' ? toPersianDigits(percentage) : ''}" data-percent-partner="${partner.id}" placeholder="۰" class="w-14 h-9 px-2 rounded-lg bg-ink-soft border border-line focus:border-brand outline-none text-sm text-center tabular-nums" />
                    <span class="text-xs text-fg-muted">٪</span>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="flex items-center justify-between rounded-xl glass-strong p-3" id="partner-sum-display">
        <span class="text-xs text-fg-muted">جمع سهم‌ها</span>
        <span class="text-sm font-bold tabular-nums ${sumValid ? 'text-success' : 'text-warning'}">
          ${toPersianDigits(sum)}٪
          ${sumValid && projectFormState.selectedPartners.length > 0 ? '<i data-lucide="check-circle" class="w-4 h-4 text-success inline mr-1"></i>' : ''}
        </span>
      </div>
      ${projectFormState.selectedPartners.length > 0 && !sumValid ? `<p class="text-[10px] text-warning text-center">جمع سهم‌ها باید ۱۰۰٪ باشد</p>` : ''}
    </div>
  `;
}

function attachProjectFormListeners() {
  const formSheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (!formSheet) return;

  const titleInput = formSheet.querySelector('[name="title"]');
  if (titleInput) titleInput.addEventListener('input', (e) => { projectFormState.title = e.target.value; });

  const employerSelect = formSheet.querySelector('[name="employerId"]');
  if (employerSelect) employerSelect.addEventListener('change', (e) => { projectFormState.employerId = e.target.value; });

  const amountInput = formSheet.querySelector('[name="amount"]');
  const amountWords = formSheet.querySelector('[data-amount-words]');
  let amountWordsTimer = null;

  const updateAmountWords = () => {
    if (!amountWords) return;
    const amount = parseIntAmount(projectFormState.amount);
    amountWords.textContent = amount > 0
      ? amountToPersianWords(amount) + ' تومان'
      : '';
  };

  if (amountInput) {
    projectFormState.amount = toLatinDigits(String(projectFormState.amount || '')).replace(/[^\d]/g, '');
    amountInput.value = formatAmountInput(projectFormState.amount);
    updateAmountWords();

    amountInput.addEventListener('input', (e) => {
      const input = e.target;
      const cursor = input.selectionStart ?? input.value.length;
      const digitsBeforeCursor = toLatinDigits(input.value.slice(0, cursor)).replace(/[^\d]/g, '').length;
      const rawValue = toLatinDigits(input.value).replace(/[^\d]/g, '');
      projectFormState.amount = rawValue;
      input.value = formatAmountInput(rawValue);

      let nextCursor = 0;
      let seenDigits = 0;
      while (nextCursor < input.value.length && seenDigits < digitsBeforeCursor) {
        if (/\d/.test(input.value[nextCursor])) seenDigits++;
        nextCursor++;
      }
      input.setSelectionRange(nextCursor, nextCursor);

      clearTimeout(amountWordsTimer);
      if (amountWords) amountWords.textContent = rawValue ? 'در حال تبدیل مبلغ…' : '';
      amountWordsTimer = setTimeout(updateAmountWords, 650);
    });
  }

  const amountUndeterminedToggle = formSheet.querySelector('[data-toggle-amount-undetermined]');
  if (amountUndeterminedToggle) amountUndeterminedToggle.addEventListener('click', () => {
    projectFormState.amountUndetermined = !projectFormState.amountUndetermined;
    refreshProjectFormSheet();
  });

  const amountTypeRadios = formSheet.querySelectorAll('[name="amountType"]');
  amountTypeRadios.forEach(r => r.addEventListener('change', (e) => { projectFormState.amountType = e.target.value; }));

  const percentInputs = formSheet.querySelectorAll('[data-percent-partner]');
  percentInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const pid = e.target.dataset.percentPartner;
      const latinValue = toLatinDigits(String(e.target.value || ''));
      const val = parseInt(latinValue.replace(/[^\d]/g, '')) || 0;
      projectFormState.partnerShares[pid] = val;
      updatePartnerSumDisplay();
    });
  });
}

function updatePartnerSumDisplay() {
  const sum = projectFormState.selectedPartners.reduce((s, pid) => s + (projectFormState.partnerShares[pid] || 0), 0);
  const sumValid = projectFormState.selectedPartners.length === 0 || sum === 100;
  const sumEl = document.getElementById('partner-sum-display');
  if (sumEl) {
    sumEl.innerHTML = `
      <span class="text-xs text-fg-muted">جمع سهم‌ها</span>
      <span class="text-sm font-bold tabular-nums ${sumValid ? 'text-success' : 'text-warning'}">
        ${toPersianDigits(sum)}٪
        ${sumValid && projectFormState.selectedPartners.length > 0 ? '<i data-lucide="check-circle" class="w-4 h-4 text-success inline mr-1"></i>' : ''}
      </span>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

function openDateField(fieldName) {
  openDatePicker({
    value: projectFormState[fieldName],
    onSelect: (iso) => { projectFormState[fieldName] = iso; refreshProjectFormSheet(); },
    onClose: () => {}
  });
}

function clearDateField(fieldName) {
  projectFormState[fieldName] = '';
  refreshProjectFormSheet();
}

function togglePartner(pid) {
  if (projectFormState.selectedPartners.includes(pid)) {
    projectFormState.selectedPartners = projectFormState.selectedPartners.filter(id => id !== pid);
    delete projectFormState.partnerShares[pid];
  } else {
    projectFormState.selectedPartners.push(pid);
    projectFormState.partnerShares[pid] = 0;
  }
  refreshProjectFormSheet();
}

function distributeEqually() {
  const selected = projectFormState.selectedPartners;
  if (selected.length === 0) return;
  const each = Math.floor(100 / selected.length);
  const remainder = 100 - each * selected.length;
  selected.forEach((pid, i) => { projectFormState.partnerShares[pid] = each + (i < remainder ? 1 : 0); });
  refreshProjectFormSheet();
}

function projectFormNext() {
  syncProjectFormInputs();
  if (projectFormState.step === 1 && !validateStep1()) return;
  if (projectFormState.step === 2 && !validateStep2()) return;
  if (projectFormState.step < 2) { projectFormState.step++; refreshProjectFormSheet(); }
}

function projectFormPrev() {
  syncProjectFormInputs();
  if (projectFormState.step > 1) { projectFormState.step--; refreshProjectFormSheet(); }
}

function projectFormSave() {
  syncProjectFormInputs();
  if (!validateStep1()) { projectFormState.step = 1; refreshProjectFormSheet(); return; }
  if (!validateStep2()) { projectFormState.step = 2; refreshProjectFormSheet(); return; }
  saveProject();
}

// Sync all form inputs to state (defensive — handles cases where input events didn't fire)
function syncProjectFormInputs() {
  const formSheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (!formSheet) return;

  // Step 1 inputs
  const titleInput = formSheet.querySelector('[name="title"]');
  if (titleInput) projectFormState.title = titleInput.value;

  const employerSelect = formSheet.querySelector('[name="employerId"]');
  if (employerSelect) projectFormState.employerId = employerSelect.value;

  const amountInput = formSheet.querySelector('[name="amount"]');
  if (amountInput) projectFormState.amount = toLatinDigits(String(amountInput.value || '')).replace(/[^\d]/g, '');

  const amountUndeterminedInput = formSheet.querySelector('[name="amountUndetermined"]');
  if (amountUndeterminedInput) projectFormState.amountUndetermined = amountUndeterminedInput.checked;

  // Step 2 percent inputs — handle Persian digits
  const percentInputs = formSheet.querySelectorAll('[data-percent-partner]');
  percentInputs.forEach(input => {
    const pid = input.dataset.percentPartner;
    const latinValue = toLatinDigits(String(input.value || ''));
    const val = parseInt(latinValue.replace(/[^\d]/g, '')) || 0;
    projectFormState.partnerShares[pid] = val;
  });
}

// تبدیل اعداد فارسی/عربی به لاتین
function toLatinDigits(str) {
  if (!str) return '';
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let result = String(str);
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persian[i], 'g'), i);
    result = result.replace(new RegExp(arabic[i], 'g'), i);
  }
  return result;
}

function validateStep1() {
  if (!projectFormState.title || projectFormState.title.trim().length < 2) { showToast('عنوان پروژه حداقل ۲ کاراکتر باید باشد', 'error'); return false; }
  if (!projectFormState.employerId) { showToast('انتخاب کارفرما الزامی است', 'error'); return false; }
  if (!projectFormState.amountUndetermined) {
    const amount = parseIntAmount(projectFormState.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      showToast('مبلغ پروژه باید عدد صحیح مثبت باشد یا گزینه «مبلغ مشخص نیست» را فعال کنید', 'error');
      return false;
    }
  }
  if (!projectFormState.startDate) { showToast('تاریخ شروع الزامی است', 'error'); return false; }
  if (projectFormState.endDate && new Date(projectFormState.endDate) < new Date(projectFormState.startDate)) { showToast('تاریخ پایان باید بعد از تاریخ شروع باشد', 'error'); return false; }
  return true;
}

function validateStep2() {
  const selected = projectFormState.selectedPartners;
  if (selected.length === 0) return true;
  const sum = selected.reduce((s, pid) => s + (projectFormState.partnerShares[pid] || 0), 0);
  if (sum !== 100) { showToast('جمع سهم شرکا باید ۱۰۰٪ باشد', 'error'); return false; }
  return true;
}

async function saveProject() {
  try {
    const amount = projectFormState.amountUndetermined ? null : parseIntAmount(projectFormState.amount);

    const projectData = {
      title: projectFormState.title.trim(),
      employerId: projectFormState.employerId,
      amount,
      amountUndetermined: projectFormState.amountUndetermined,
      amountType: projectFormState.amountType,
      startDate: projectFormState.startDate,
      endDate: projectFormState.endDate || null,
      status: projectFormState.status,
      color: projectFormState.color,
      note: projectFormState.note || '',
      pinned: projectFormState.pinned || false
    };

    let projectId;
    if (projectFormState.editId) {
      const updated = await repo.projects.update(projectFormState.editId, projectData);
      state.updateEntity('projects', updated);
      projectId = projectFormState.editId;
      const oldShares = (state.data.projectShares || []).filter(s => s.projectId === projectId);
      for (const share of oldShares) {
        await repo.projectShares.delete(share.id);
        state.removeEntity('projectShares', share.id);
      }
    } else {
      const project = await repo.projects.create(projectData);
      state.updateEntity('projects', project);
      projectId = project.id;
    }

    for (const pid of projectFormState.selectedPartners) {
      const percentage = projectFormState.partnerShares[pid] || 0;
      if (percentage > 0) {
        const share = await repo.projectShares.create({ projectId, partnerId: pid, percentage });
        state.updateEntity('projectShares', share);
      }
    }

    closeSheet();
    showToast(projectFormState.editId ? 'پروژه به‌روزرسانی شد' : 'پروژه ایجاد شد', 'success');
    renderProjectsPage();
  } catch (e) {
    console.error('Save project failed:', e);
    showToast('خطا در ذخیره پروژه', 'error');
  }
}

// =========== DETAIL PAGE ===========
export function renderProjectDetailPage(params) {
  currentDetailParams = params;
  const projectId = params?.id;
  const project = (state.data.projects || []).find(p => p.id === projectId && !p.deletedAt);
  const main = document.getElementById('page-content');

  if (!project) {
    main.innerHTML = `
      <div class="px-4 pt-6">
        ${EmptyState({ icon: 'alert-triangle', title: 'پروژه یافت نشد', description: 'این پروژه ممکن است حذف شده باشد.', actionLabel: 'بازگشت به پروژه‌ها', actionOnClick: 'window.__navigate("/projects")' })}
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    window.__navigate = (path) => navigate(path);
    return;
  }

  const colorHex = COLOR_HEX[project.color] || COLOR_HEX.brand;
  const received = getProjectReceived(project.id, state.data);
  const remaining = getProjectRemaining(project.id, state.data);
  const percent = getProjectProgressPercent(project.id, state.data);
  const employer = (state.data.employers || []).find(e => e.id === project.employerId);

  const tabs = [
    { id: 'receipts', label: 'تراکنش‌ها' },
    { id: 'activities', label: 'فعالیت‌ها' }
  ];

  main.innerHTML = `
    <div class="pb-32">
      <div class="p-4" style="background: linear-gradient(135deg, ${colorHex}30 0%, ${colorHex}08 100%);">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-2.5 flex-1 min-w-0">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style="background: ${colorHex}30;">
              <i data-lucide="briefcase" class="w-6 h-6" style="color: ${colorHex};"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-base font-bold truncate">${project.title}</p>
              <p class="text-[11px] text-fg-muted flex items-center gap-1">
                <i data-lucide="user" class="w-3 h-3"></i>
                ${employer ? employer.name : 'بدون کارفرما'}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button onclick="window.__togglePin('${project.id}')" class="w-9 h-9 rounded-xl glass flex items-center justify-center ${project.pinned ? 'text-cta' : 'text-fg-muted'}">
              <i data-lucide="${project.pinned ? 'bookmark-check' : 'bookmark'}" class="w-4 h-4"></i>
            </button>
            <button onclick="window.__editProject('${project.id}')" class="w-9 h-9 rounded-xl glass flex items-center justify-center">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="window.__deleteProject('${project.id}')" class="w-9 h-9 rounded-xl glass flex items-center justify-center text-danger">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 mb-3">
          <div class="glass-strong rounded-xl p-2.5">
            <p class="text-[10px] text-fg-muted">مبلغ پروژه</p>
            <p class="text-sm font-bold tabular-nums">${project.amountUndetermined ? 'نامشخص' : formatTomanShort(project.amount)}</p>
          </div>
          <div class="glass-strong rounded-xl p-2.5">
            <p class="text-[10px] text-fg-muted">دریافتی</p>
            <p class="text-sm font-bold tabular-nums text-success">${formatTomanShort(received)}</p>
          </div>
          <div class="glass-strong rounded-xl p-2.5">
            <p class="text-[10px] text-fg-muted">باقیمانده</p>
            <p class="text-sm font-bold tabular-nums text-cta">${project.amountUndetermined ? '—' : formatTomanShort(remaining)}</p>
          </div>
          <div class="glass-strong rounded-xl p-2.5">
            <p class="text-[10px] text-fg-muted">پیشرفت</p>
            <p class="text-sm font-bold tabular-nums">${project.amountUndetermined ? '—' : toPersianDigits(percent) + '٪'}</p>
          </div>
        </div>

        ${project.amountUndetermined ? '' : ProgressBar({ value: percent })}

        <div class="flex items-center justify-between text-[10px] text-fg-muted mt-2">
          <span class="flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3"></i>${formatJalali(project.startDate)}</span>
          ${project.endDate ? `<span class="flex items-center gap-1"><i data-lucide="flag" class="w-3 h-3"></i>${formatJalali(project.endDate)}</span>` : ''}
        </div>

        ${renderStatusSelector(project, remaining)}
      </div>

      <div class="px-4 mt-4">
        ${Tabs({ tabs, activeTab: activeProjectTab, onChange: 'window.__switchProjectTab' })}
      </div>

      <div class="px-4 mt-3 space-y-2" id="project-tab-content">
        ${renderProjectTabContent(project.id, activeProjectTab)}
      </div>

      <div class="px-4 mt-4 grid grid-cols-2 gap-2">
        <button onclick="window.__navigate('/transaction/add')" class="h-11 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-cta/30">
          <i data-lucide="arrow-down-left" class="w-4 h-4"></i> دریافتی
        </button>
        <button onclick="window.__navigate('/transfer/add')" class="h-11 rounded-xl glass-strong hover:bg-white/15 text-white text-sm font-medium transition flex items-center justify-center gap-2">
          <i data-lucide="arrow-right-left" class="w-4 h-4"></i> انتقال
        </button>
        <button onclick="window.__navigate('/activity/add')" class="h-11 rounded-xl glass-strong hover:bg-white/15 text-white text-sm font-medium transition flex items-center justify-center gap-2">
          <i data-lucide="calendar" class="w-4 h-4"></i> فعالیت
        </button>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  window.__switchProjectTab = (tabId) => {
    activeProjectTab = tabId;
    renderProjectDetailPage(currentDetailParams);
  };
  window.__editProject = (id) => openProjectForm(id);
  window.__deleteProject = (id) => deleteProject(id);
  window.__togglePin = togglePin;
  window.__changeProjectStatus = changeProjectStatus;
  window.__navigate = (path) => navigate(path);
}

function renderProjectTabContent(projectId, tabId) {
  if (tabId === 'receipts') {
    const allocations = (state.data.receiptAllocations || []).filter(a => {
      if (a.projectId !== projectId) return false;
      const receipt = (state.data.receipts || []).find(r => r.id === a.receiptId);
      return receipt && !receipt.deletedAt;
    });
    allocations.sort((a, b) => {
      const ra = (state.data.receipts || []).find(r => r.id === a.receiptId);
      const rb = (state.data.receipts || []).find(r => r.id === b.receiptId);
      return new Date(rb?.date || 0) - new Date(ra?.date || 0);
    });

    if (allocations.length === 0) return renderEmptyTab('هنوز تراکنشی برای این پروژه ثبت نشده');

    return allocations.map(a => {
      const receipt = (state.data.receipts || []).find(r => r.id === a.receiptId);
      const employer = (state.data.employers || []).find(e => e.id === receipt?.employerId);
      return `
        <div class="glass rounded-xl p-3 flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-success-soft text-success flex items-center justify-center shrink-0">
            <i data-lucide="arrow-down" class="w-4 h-4"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium truncate">${employer ? employer.name : 'کارفرما'}</p>
            <p class="text-[10px] text-fg-muted">${receipt ? formatJalali(receipt.date) : ''}</p>
          </div>
          <p class="text-sm font-bold tabular-nums text-success">${formatTomanShort(a.amount)}</p>
        </div>
      `;
    }).join('');
  }

  if (tabId === 'activities') {
    const activities = (state.data.dailyActivities || []).filter(a => a.projectId === projectId && !a.deletedAt).sort((a, b) => new Date(b.date) - new Date(a.date));
    if (activities.length === 0) return renderEmptyTab('هنوز فعالیتی برای این پروژه ثبت نشده');

    return activities.map(a => {
      const partner = (state.data.partners || []).find(p => p.id === a.partnerId);
      return `
        <div class="glass rounded-xl p-3 flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-brand/15 text-brand flex items-center justify-center shrink-0">
            <i data-lucide="clock" class="w-4 h-4"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium truncate">${partner ? partner.name : 'شریک'}</p>
            <p class="text-[10px] text-fg-muted">
              ${formatJalali(a.date)} · ${toPersianDigits(a.startTime || '')} تا ${toPersianDigits(a.endTime || '')}
            </p>
          </div>
        </div>
      `;
    }).join('');
  }

  return '';
}

function renderEmptyTab(message) {
  return `
    <div class="glass rounded-xl p-6 text-center">
      <i data-lucide="inbox" class="w-8 h-8 text-fg-muted mx-auto mb-2"></i>
      <p class="text-xs text-fg-muted">${message}</p>
    </div>
  `;
}

// === ثبت سریع کارفرمای جدید از داخل فرم پروژه ===
function quickAddEmployer() {
  // ابتدا فرم پروژه را ببند تا تداخل نباشد
  const quickContent = `
    <div class="pb-2">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold">کارفرمای جدید</h3>
        <button onclick="window.__closeQuickAdd()" class="w-8 h-8 rounded-lg glass flex items-center justify-center">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="space-y-3">
        ${Input({ name: 'quickName', label: 'نام', placeholder: 'نام کارفرما', required: true, icon: 'user' })}
        ${Input({ name: 'quickPhone', label: 'شماره تماس (اختیاری)', placeholder: '۰۹۱۲...', icon: 'phone', inputmode: 'tel' })}
      </div>
      <button onclick="window.__saveQuickEmployer()" class="w-full h-11 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-brand/30 mt-4">
        <i data-lucide="check" class="w-4 h-4"></i> ثبت و انتخاب
      </button>
    </div>
  `;
  // sheet فرم پروژه را موقتاً مخفی کن
  const projectSheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (projectSheet) projectSheet.style.display = 'none';

  openSheet(quickContent, {
    onMount: () => {
      window.__closeQuickAdd = () => {
        closeSheet();
        // sheet پروژه را دوباره نشان بده
        if (projectSheet) projectSheet.style.display = '';
      };
      window.__saveQuickEmployer = async () => {
        const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
        if (!sheet) return;
        const name = sheet.querySelector('[name="quickName"]')?.value?.trim() || '';
        const phone = sheet.querySelector('[name="quickPhone"]')?.value?.trim() || '';
        if (!name || name.length < 2) { showToast('نام کارفرما الزامی است', 'error'); return; }
        try {
          const created = await repo.employers.create({ name, phone, avatarColor: 'brand' });
          state.updateEntity('employers', created);
          projectFormState.employerId = created.id;
          closeSheet();
          if (projectSheet) projectSheet.style.display = '';
          refreshProjectFormSheet();
          showToast('کارفرما ثبت شد', 'success');
        } catch (e) {
          console.error('Quick add employer failed:', e);
          showToast('خطا در ثبت کارفرما', 'error');
        }
      };
    }
  });
}

// === ثبت سریع شریک جدید از داخل فرم پروژه ===
function quickAddPartner() {
  const quickContent = `
    <div class="pb-2">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold">شریک جدید</h3>
        <button onclick="window.__closeQuickAdd()" class="w-8 h-8 rounded-lg glass flex items-center justify-center">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="space-y-3">
        ${Input({ name: 'quickName', label: 'نام', placeholder: 'نام شریک', required: true, icon: 'user' })}
        ${Input({ name: 'quickPhone', label: 'شماره تماس (اختیاری)', placeholder: '۰۹۱۲...', icon: 'phone', inputmode: 'tel' })}
      </div>
      <button onclick="window.__saveQuickPartner()" class="w-full h-11 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-brand/30 mt-4">
        <i data-lucide="check" class="w-4 h-4"></i> ثبت و افزودن
      </button>
    </div>
  `;
  const projectSheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (projectSheet) projectSheet.style.display = 'none';

  openSheet(quickContent, {
    onMount: () => {
      window.__closeQuickAdd = () => {
        closeSheet();
        if (projectSheet) projectSheet.style.display = '';
      };
      window.__saveQuickPartner = async () => {
        const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
        if (!sheet) return;
        const name = sheet.querySelector('[name="quickName"]')?.value?.trim() || '';
        const phone = sheet.querySelector('[name="quickPhone"]')?.value?.trim() || '';
        if (!name || name.length < 2) { showToast('نام شریک الزامی است', 'error'); return; }
        try {
          const created = await repo.partners.create({ name, phone, avatarColor: 'brand' });
          state.updateEntity('partners', created);
          // شریک جدید را به‌طور خودکار به پروژه اضافه کن
          projectFormState.selectedPartners.push(created.id);
          projectFormState.partnerShares[created.id] = 0;
          closeSheet();
          if (projectSheet) projectSheet.style.display = '';
          refreshProjectFormSheet();
          showToast('شریک ثبت و اضافه شد', 'success');
        } catch (e) {
          console.error('Quick add partner failed:', e);
          showToast('خطا در ثبت شریک', 'error');
        }
      };
    }
  });
}

async function togglePin(id) {
  const project = (state.data.projects || []).find(p => p.id === id);
  if (!project) return;
  try {
    const updated = await repo.projects.update(id, { pinned: !project.pinned });
    state.updateEntity('projects', updated);
    showToast(project.pinned ? 'پین برداشته شد' : 'پروژه پین شد', 'success');
    renderProjectDetailPage(currentDetailParams);
  } catch (e) {
    console.error('Toggle pin failed:', e);
    showToast('خطا در تغییر وضعیت پین', 'error');
  }
}

// === انتخابگر وضعیت پروژه ===
// فقط در صورت تسویه کامل اجازه completed/archived می‌دهد
function renderStatusSelector(project, remaining) {
  const canChangeToCompleted = !project.amountUndetermined && remaining === 0;
  const statusOptions = [
    { value: 'active', label: 'فعال', alwaysEnabled: true },
    { value: 'completed', label: 'تکمیل‌شده', alwaysEnabled: false },
    { value: 'archived', label: 'بایگانی‌شده', alwaysEnabled: false }
  ];

  return `
    <div class="mt-3 pt-3 border-t border-white/10">
      <p class="text-[10px] text-fg-muted mb-2">تغییر وضعیت پروژه</p>
      <div class="flex gap-1.5">
        ${statusOptions.map(opt => {
          const isActive = project.status === opt.value;
          const isEnabled = opt.alwaysEnabled || canChangeToCompleted;
          const baseClass = isActive
            ? 'bg-brand text-white'
            : isEnabled
              ? 'glass text-fg-muted hover:bg-white/10'
              : 'glass text-fg-subtle opacity-50 cursor-not-allowed';
          const onclickAttr = isEnabled && !isActive
            ? `onclick="window.__changeProjectStatus('${project.id}', '${opt.value}')"`
            : '';
          const tooltip = !isEnabled && !opt.alwaysEnabled
            ? `data-tooltip="${project.amountUndetermined ? 'ابتدا مبلغ پروژه را مشخص کنید' : 'ابتدا پروژه باید تسویه شود'}"`
            : '';
          return `
            <button ${onclickAttr} ${tooltip} class="flex-1 h-9 rounded-lg text-xs font-medium transition ${baseClass}">
              ${opt.label}
            </button>
          `;
        }).join('')}
      </div>
      ${!canChangeToCompleted ? `
        <p class="text-[9px] text-warning mt-1.5 flex items-center gap-1">
          <i data-lucide="alert-triangle" class="w-3 h-3"></i>
          ${project.amountUndetermined ? 'برای تکمیل یا بایگانی، ابتدا مبلغ پروژه را مشخص کنید.' : `برای تغییر به تکمیل/بایگانی، باید پروژه کاملاً تسویه شود (${formatTomanShort(remaining)} باقیمانده)`}
        </p>
      ` : ''}
    </div>
  `;
}

async function changeProjectStatus(projectId, newStatus) {
  const project = (state.data.projects || []).find(p => p.id === projectId);
  if (!project) return;

  // بررسی تسویه برای completed و archived
  if (newStatus === 'completed' || newStatus === 'archived') {
    const remaining = getProjectRemaining(projectId, state.data);
    if (remaining > 0) {
      showToast('پروژه باید ابتدا کاملاً تسویه شود', 'error');
      return;
    }
  }

  try {
    const updated = await repo.projects.update(projectId, { status: newStatus });
    state.updateEntity('projects', updated);
    const statusLabel = PROJECT_STATUS_LABELS[newStatus] || newStatus;
    showToast(`وضعیت پروژه به «${statusLabel}» تغییر یافت`, 'success');
    renderProjectDetailPage(currentDetailParams);
  } catch (e) {
    console.error('Change status failed:', e);
    showToast('خطا در تغییر وضعیت', 'error');
  }
}

function deleteProject(id) {
  const project = (state.data.projects || []).find(p => p.id === id);
  if (!project) return;
  confirmDialog({
    title: 'حذف پروژه',
    message: `آیا از حذف پروژه «${project.title}» مطمئن هستید؟ این عمل قابل بازگشت نیست.`,
    confirmText: 'حذف',
    danger: true,
    onConfirm: async () => {
      try {
        await repo.projects.delete(id);
        state.removeEntity('projects', id);
        showToast('پروژه حذف شد', 'success');
        navigate('/projects');
      } catch (e) {
        console.error('Delete project failed:', e);
        showToast('خطا در حذف پروژه', 'error');
      }
    }
  });
}
