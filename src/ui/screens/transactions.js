// src/ui/screens/transactions.js
// صفحه تراکنش‌ها و ثبت دریافتی — فاز 5 PRD

import { repo } from '../../core/repository.js';
import { state } from '../../core/state.js';
import { navigate } from '../../core/router.js';
import { showToast } from '../components/toast.js';
import { openSheet, closeSheet, confirmDialog } from '../components/sheet.js';
import { openDatePicker } from '../components/datepicker.js';
import { Badge, Input, Select, Textarea, EmptyState, ProgressBar } from '../components/ui.js';
import { formatToman, formatTomanShort, parseIntAmount } from '../../utils/number.js';
import { formatJalali, toPersianDigits, today, isThisMonth } from '../../utils/date.js';
import { getProjectRemaining } from '../../domain/calculations.js';
import { suggestAllocation } from '../../domain/allocation.js';
import { renderShareDistributionHtml, attachShareHandlers, computeShareAmounts, refreshShareSummary } from './expenses.js';

const COLOR_HEX = {
  brand: '#0080ff', cta: '#ff7f00', purple: '#8b5cf6', cyan: '#22d3ee',
  pink: '#ec4899', success: '#36b37e', warning: '#ffab00', info: '#6554c0'
};

let transactionsSearch = '';
let transactionsFilter = 'all';
let transactionFormState = null;

// Edit form states for transactions (used in bottom sheets)
let editReceiptState = null;
let editExpenseState = null;
let editTransferState = null;
let transferAfterSave = null;
let transactionAmountWordsTimer = null;

function formatTransactionAmount(value) {
  const digits = toLatinDigits(value).replace(/[^\d]/g, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function transactionAmountToWords(value) {
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
    if (n >= 20) { parts.push(tens[Math.floor(n / 10)]); if (n % 10) parts.push(ones[n % 10]); }
    else if (n >= 10) parts.push(teens[n - 10]);
    else if (n > 0) parts.push(ones[n]);
    return parts.join(' و ');
  };
  const parts = [];
  let remaining = number;
  let scaleIndex = 0;
  while (remaining > 0) {
    const chunk = remaining % 1000;
    if (chunk) parts.unshift(underThousand(chunk) + (scales[scaleIndex] ? ' ' + scales[scaleIndex] : ''));
    remaining = Math.floor(remaining / 1000);
    scaleIndex++;
  }
  return parts.join(' و ');
}

function attachTransactionAmountInput(input, formState, wordsElement, onAmountChange) {
  if (!input) return;
  formState.amount = toLatinDigits(formState.amount).replace(/[^\d]/g, '');
  input.value = formatTransactionAmount(formState.amount);
  const updateWords = () => {
    if (wordsElement) {
      const words = transactionAmountToWords(formState.amount);
      wordsElement.textContent = words ? words + ' تومان' : '';
    }
    if (onAmountChange) onAmountChange(parseIntAmount(formState.amount));
  };
  updateWords();
  input.addEventListener('input', (event) => {
    const target = event.target;
    const cursor = target.selectionStart ?? target.value.length;
    const digitsBeforeCursor = toLatinDigits(target.value.slice(0, cursor)).replace(/[^\d]/g, '').length;
    const rawValue = toLatinDigits(target.value).replace(/[^\d]/g, '');
    formState.amount = rawValue;
    target.value = formatTransactionAmount(rawValue);
    let nextCursor = 0;
    let seenDigits = 0;
    while (nextCursor < target.value.length && seenDigits < digitsBeforeCursor) {
      if (/\d/.test(target.value[nextCursor])) seenDigits++;
      nextCursor++;
    }
    target.setSelectionRange(nextCursor, nextCursor);
    clearTimeout(transactionAmountWordsTimer);
    if (wordsElement) wordsElement.textContent = rawValue ? 'در حال تبدیل مبلغ…' : '';
    transactionAmountWordsTimer = setTimeout(updateWords, 650);
    if (onAmountChange) onAmountChange(parseIntAmount(rawValue));
  });
}

function defaultTransactionFormState() {
  return {
    step: 1, employerId: '', amount: '', date: today(),
    receiverPartnerId: '', note: '',
    selectedProjects: [], allocations: {}, allocationDirty: {}
  };
}

export function renderTransactionsPage() {
  transactionFormState = null;
  const main = document.getElementById('page-content');

  const receipts = (state.data.receipts || []).filter(r => !r.deletedAt);
  const expenses = (state.data.expenses || []).filter(e => !e.deletedAt);
  const transfers = (state.data.partnerTransfers || []).filter(t => !t.deletedAt);

  const allItems = [];
  for (const r of receipts) {
    const employer = (state.data.employers || []).find(e => e.id === r.employerId);
    const partner = (state.data.partners || []).find(p => p.id === r.receiverPartnerId);
    const allocations = (state.data.receiptAllocations || []).filter(a => a.receiptId === r.id);
    allItems.push({ id: r.id, type: 'receipt', date: r.date, amount: r.amount, employer, partner, allocationsCount: allocations.length, note: r.note });
  }
  for (const e of expenses) {
    const project = (state.data.projects || []).find(p => p.id === e.projectId);
    const partner = (state.data.partners || []).find(p => p.id === e.paidByPartnerId);
    allItems.push({ id: e.id, type: 'expense', date: e.date, amount: e.amount, title: e.title, project, partner, note: e.note });
  }
  for (const t of transfers) {
    const fromPartner = (state.data.partners || []).find(p => p.id === t.fromPartnerId);
    const toPartner = (state.data.partners || []).find(p => p.id === t.toPartnerId);
    allItems.push({ id: t.id, type: 'transfer', date: t.date, amount: t.amount, fromPartner, toPartner, purpose: t.purpose || 'project_settlement', note: t.note });
  }

  allItems.sort((a, b) => new Date(b.date) - new Date(a.date));

  const counts = {
    all: allItems.length,
    receipt: allItems.filter(i => i.type === 'receipt').length,
    expense: allItems.filter(i => i.type === 'expense').length,
    transfer: allItems.filter(i => i.type === 'transfer').length
  };

  const monthItems = allItems.filter(i => isThisMonth(i.date));
  const monthInflow = monthItems.filter(i => i.type === 'receipt').reduce((s, i) => s + i.amount, 0);
  const monthOutflow = monthItems.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);

  function getFiltered() {
    const q = transactionsSearch.trim().toLowerCase();
    return allItems.filter(item => {
      if (transactionsFilter !== 'all' && item.type !== transactionsFilter) return false;
      if (!q) return true;
      const amountStr = String(item.amount);
      const employerName = item.employer?.name || '';
      const partnerName = item.partner?.name || item.fromPartner?.name || item.toPartner?.name || '';
      const titleStr = item.title || '';
      return employerName.toLowerCase().includes(q) || partnerName.toLowerCase().includes(q) || titleStr.toLowerCase().includes(q) || amountStr.includes(q);
    });
  }

  if (allItems.length === 0) {
    main.innerHTML = `
      <div class="px-4 pt-6">
        ${EmptyState({ icon: 'receipt', title: 'هنوز تراکنشی ثبت نشده', description: 'اولین دریافتی از کارفرما را ثبت کنید تا ترازها به‌روز شوند.', actionLabel: 'ثبت دریافتی', actionOnClick: "window.__navigate('/transaction/add')" })}
      </div>
      ${renderFab()}
    `;
    if (window.lucide) window.lucide.createIcons();
    window.__navigate = (path) => navigate(path);
    return;
  }

  const filtered = getFiltered();
  const groups = groupByDate(filtered);

  main.innerHTML = `
    <div class="px-4 pt-4 pb-32">
      ${renderSummaryCard(monthInflow, monthOutflow)}
      <div class="mt-4">${renderSearch()}</div>
      <div class="mt-3">${renderFilterChips(counts)}</div>
      <div class="mt-4 space-y-4" id="transactions-list">
        ${groups.length === 0 ? `<div class="glass rounded-2xl p-6 text-center text-fg-muted text-sm">نتیجه‌ای یافت نشد</div>` : groups.map(g => renderGroup(g)).join('')}
      </div>
    </div>
    ${renderFab()}
  `;

  if (window.lucide) window.lucide.createIcons();

  const searchInput = document.getElementById('transactions-search');
  if (searchInput) {
    searchInput.value = transactionsSearch;
    searchInput.addEventListener('input', (e) => { transactionsSearch = e.target.value; rerenderList(); });
  }

  window.__navigate = (path) => navigate(path);
  window.__setTransactionsFilter = (f) => {
    transactionsFilter = f;
    document.querySelectorAll('[data-filter-chip]').forEach(chip => {
      const f2 = chip.dataset.filterChip;
      const isActive = f2 === transactionsFilter;
      chip.className = `shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${isActive ? 'bg-brand text-white' : 'glass text-fg-muted'}`;
    });
    rerenderList();
  };

  // Edit / Delete exposures for inline handlers
  window.__deleteReceipt = deleteReceipt;
  window.__deleteExpense = deleteExpense;
  window.__deleteTransfer = deleteTransfer;
  window.__editReceipt = editReceipt;
  window.__editExpense = editExpense;
  window.__editTransfer = editTransfer;

  function rerenderList() {
    const listEl = document.getElementById('transactions-list');
    if (!listEl) return;
    const reFiltered = getFiltered();
    const reGroups = groupByDate(reFiltered);
    listEl.innerHTML = reGroups.length === 0
      ? `<div class="glass rounded-2xl p-6 text-center text-fg-muted text-sm">نتیجه‌ای یافت نشد</div>`
      : reGroups.map(g => renderGroup(g)).join('');
    if (window.lucide) window.lucide.createIcons();
  }
}

function groupByDate(items) {
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayDate = new Date(todayDate.getTime() - 86400000);
  const weekStart = new Date(todayDate.getTime() - 6 * 86400000);
  const groups = { today: [], yesterday: [], week: [], older: [] };
  for (const item of items) {
    const d = new Date(item.date);
    if (d >= todayDate) groups.today.push(item);
    else if (d >= yesterdayDate) groups.yesterday.push(item);
    else if (d >= weekStart) groups.week.push(item);
    else groups.older.push(item);
  }
  const result = [];
  if (groups.today.length) result.push({ key: 'today', label: 'امروز', items: groups.today });
  if (groups.yesterday.length) result.push({ key: 'yesterday', label: 'دیروز', items: groups.yesterday });
  if (groups.week.length) result.push({ key: 'week', label: 'این هفته', items: groups.week });
  if (groups.older.length) result.push({ key: 'older', label: 'قدیمی‌تر', items: groups.older });
  return result;
}

function renderGroup(group) {
  return `
    <div>
      <div class="flex items-center gap-2 mb-2 px-1">
        <p class="text-xs font-bold text-fg-muted">${group.label}</p>
        <span class="text-[10px] text-fg-muted bg-white/5 px-2 py-0.5 rounded-md">${toPersianDigits(group.items.length)}</span>
      </div>
      <div class="space-y-2">${group.items.map(renderTransactionItem).join('')}</div>
    </div>
  `;
}

function renderTransactionItem(item) {
  if (item.type === 'receipt') return renderReceiptItem(item);
  if (item.type === 'expense') return renderExpenseItem(item);
  return renderTransferItem(item);
}

function renderReceiptItem(item) {
  const employerName = item.employer?.name || 'کارفرما';
  const partnerName = item.partner?.name || '—';
  return `
    <div class="glass rounded-2xl p-3.5 flex items-center gap-3 hover:bg-white/8 transition active:scale-[0.98]" onclick="window.__editReceipt('${item.id}')">
      <div class="w-10 h-10 rounded-xl bg-success-soft text-success flex items-center justify-center shrink-0">
        <i data-lucide="arrow-down-left" class="w-5 h-5"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <p class="text-sm font-bold truncate">${employerName}</p>
          ${Badge({ variant: 'success', label: 'دریافتی', classes: 'shrink-0' })}
        </div>
        <p class="text-[11px] text-fg-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span class="flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3"></i>${formatJalali(item.date)}</span>
          <span class="flex items-center gap-1"><i data-lucide="user" class="w-3 h-3"></i>${partnerName}</span>
          ${item.allocationsCount > 0 ? `<span class="flex items-center gap-1"><i data-lucide="briefcase" class="w-3 h-3"></i>${toPersianDigits(item.allocationsCount)} پروژه</span>` : ''}
        </p>
      </div>
      <div class="text-left shrink-0"><p class="text-sm font-bold text-success tabular-nums">+ ${formatTomanShort(item.amount)}</p></div>
      <button onclick="event.stopPropagation(); window.__deleteReceipt('${item.id}')" class="w-8 h-8 rounded-lg glass text-danger hover:bg-danger/10 flex items-center justify-center shrink-0 transition" aria-label="حذف">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    </div>
  `;
}

function renderExpenseItem(item) {
  const partnerName = item.partner?.name || '—';
  return `
    <div class="glass rounded-2xl p-3.5 flex items-center gap-3 hover:bg-white/8 transition active:scale-[0.98]" onclick="window.__editExpense('${item.id}')">
      <div class="w-10 h-10 rounded-xl bg-danger-soft text-danger flex items-center justify-center shrink-0">
        <i data-lucide="arrow-up-right" class="w-5 h-5"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <p class="text-sm font-bold truncate">${item.title}</p>
          ${Badge({ variant: 'danger', label: 'هزینه', classes: 'shrink-0' })}
        </div>
        <p class="text-[11px] text-fg-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span class="flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3"></i>${formatJalali(item.date)}</span>
          <span class="flex items-center gap-1"><i data-lucide="user" class="w-3 h-3"></i>${partnerName}</span>
        </p>
      </div>
      <div class="text-left shrink-0"><p class="text-sm font-bold text-danger tabular-nums">- ${formatTomanShort(item.amount)}</p></div>
      <button onclick="event.stopPropagation(); window.__deleteExpense('${item.id}')" class="w-8 h-8 rounded-lg glass text-danger hover:bg-danger/10 flex items-center justify-center shrink-0 transition" aria-label="حذف">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    </div>
  `;
}

function renderTransferItem(item) {
  const fromName = item.fromPartner?.name || 'شریک';
  const toName = item.toPartner?.name || 'شریک';
  return `
    <div class="glass rounded-2xl p-3.5 flex items-center gap-3 hover:bg-white/8 transition active:scale-[0.98]" onclick="window.__editTransfer('${item.id}')">
      <div class="w-10 h-10 rounded-xl bg-info-soft text-purple-300 flex items-center justify-center shrink-0">
        <i data-lucide="arrow-right-left" class="w-5 h-5"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold truncate">انتقال از ${fromName} به ${toName}</p>
        <p class="text-[11px] text-fg-muted mt-0.5 flex items-center gap-1.5">
          <i data-lucide="calendar" class="w-3 h-3"></i>${formatJalali(item.date)} · ${item.purpose === 'expense_settlement' ? 'تسویه هزینه‌ها' : 'تسویه سهم پروژه‌ها'}
        </p>
      </div>
      <div class="text-left shrink-0"><p class="text-sm font-bold text-fg-muted tabular-nums">${formatTomanShort(item.amount)}</p></div>
      <button onclick="event.stopPropagation(); window.__deleteTransfer('${item.id}')" class="w-8 h-8 rounded-lg glass text-danger hover:bg-danger/10 flex items-center justify-center shrink-0 transition" aria-label="حذف">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    </div>
  `;
}

function renderSummaryCard(inflow, outflow) {
  const net = inflow - outflow;
  return `
    <div class="glass-strong rounded-2xl p-4">
      <p class="text-xs text-fg-muted mb-3">خلاصه این ماه</p>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <div class="flex items-center gap-1.5 mb-1"><i data-lucide="arrow-down-left" class="w-3.5 h-3.5 text-success"></i><span class="text-[10px] text-fg-muted">ورودی</span></div>
          <p class="text-sm font-bold text-success tabular-nums">${formatTomanShort(inflow)}</p>
        </div>
        <div>
          <div class="flex items-center gap-1.5 mb-1"><i data-lucide="arrow-up-right" class="w-3.5 h-3.5 text-danger"></i><span class="text-[10px] text-fg-muted">خروجی</span></div>
          <p class="text-sm font-bold text-danger tabular-nums">${formatTomanShort(outflow)}</p>
        </div>
      </div>
      <div class="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
        <span class="text-[11px] text-fg-muted">خالص</span>
        <span class="text-sm font-bold tabular-nums ${net >= 0 ? 'text-success' : 'text-danger'}">${formatTomanShort(net)}</span>
      </div>
    </div>
  `;
}

function renderSearch() {
  return `
    <div class="relative">
      <i data-lucide="search" class="w-4 h-4 text-fg-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
      <input id="transactions-search" type="text" placeholder="جستجو در تراکنش‌ها..." class="w-full h-11 pr-10 pl-4 rounded-xl bg-ink-soft border border-line focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-sm transition" />
    </div>
  `;
}

function renderFilterChips(counts) {
  const chips = [
    { id: 'all', label: 'همه', count: counts.all },
    { id: 'receipt', label: 'درآمد', count: counts.receipt },
    { id: 'expense', label: 'هزینه', count: counts.expense },
    { id: 'transfer', label: 'انتقال', count: counts.transfer }
  ];
  return `
    <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
      ${chips.map(c => `
        <button data-filter-chip="${c.id}" onclick="window.__setTransactionsFilter('${c.id}')" class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${c.id === transactionsFilter ? 'bg-brand text-white' : 'glass text-fg-muted'}">
          ${c.label} <span class="opacity-70">${toPersianDigits(c.count)}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderFab() {
  return `
    <div class="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 pointer-events-none z-30">
      <div class="flex justify-end">
        <button onclick="window.__navigate('/transaction/add')" class="pointer-events-auto w-14 h-14 rounded-2xl bg-cta hover:bg-cta-dark text-white shadow-xl shadow-cta/40 flex items-center justify-center transition active:scale-95">
          <i data-lucide="plus" class="w-6 h-6"></i>
        </button>
      </div>
    </div>
  `;
}

// =========== ADD TRANSACTION PAGE ===========
export function renderAddTransactionPage(reset = true) {
  // فقط وقتی از router صدا زده می‌شود (reset=true) state را ریست کن
  // وقتی از داخل صفحه (txFormNext و غیره) صدا زده می‌شود، state حفظ شود
  if (reset) {
    transactionFormState = defaultTransactionFormState();
  }
  const main = document.getElementById('page-content');

  main.innerHTML = `
    <div class="px-4 pt-4 pb-32">
      <div class="flex items-center gap-3 mb-4">
        <button onclick="window.__navigate('/transactions')" class="w-9 h-9 rounded-lg glass flex items-center justify-center">
          <i data-lucide="chevron-right" class="w-5 h-5"></i>
        </button>
        <h2 class="text-base font-bold">ثبت دریافتی</h2>
      </div>
      ${renderStepIndicator(transactionFormState.step)}
      <div class="mt-4" id="transaction-form-content">${renderFormStep()}</div>
      <div class="flex gap-2 mt-6">
        ${transactionFormState.step > 1 ? `
          <button onclick="window.__txFormPrev()" class="flex-1 h-11 rounded-xl glass text-sm font-medium hover:bg-white/10 transition flex items-center justify-center gap-2">
            <i data-lucide="chevron-right" class="w-4 h-4"></i> قبلی
          </button>
        ` : ''}
        ${transactionFormState.step < 2 ? `
          <button onclick="window.__txFormNext()" class="flex-1 h-11 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-brand/30">
            بعدی <i data-lucide="chevron-left" class="w-4 h-4"></i>
          </button>
        ` : ''}
        ${transactionFormState.step === 2 ? `
          <button onclick="window.__txFormSave()" class="flex-1 h-11 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-cta/30">
            <i data-lucide="check" class="w-4 h-4"></i> ثبت دریافتی
          </button>
        ` : ''}
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
  attachFormListeners();

  window.__navigate = (path) => navigate(path);
  window.__txFormNext = txFormNext;
  window.__txFormPrev = txFormPrev;
  window.__txFormSave = txFormSave;
  window.__openTxDate = openTxDate;
  window.__addQuickAmount = addQuickAmount;
  window.__toggleProject = toggleProject;
  window.__autoSuggest = autoSuggestAllocations;
}

function renderStepIndicator(step) {
  const steps = ['اطلاعات پایه', 'تخصیص به پروژه‌ها'];
  return `
    <div class="flex items-center gap-2">
      ${steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === step;
        const isDone = stepNum < step;
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

function renderFormStep() {
  if (transactionFormState.step === 1) return renderStep1();
  return renderStep2();
}

function renderStep1() {
  const employers = (state.data.employers || []).filter(e => !e.deletedAt);
  const partners = (state.data.partners || []).filter(p => !p.deletedAt);
  const employerOptions = employers.map(e => ({ value: e.id, label: e.name }));
  const partnerOptions = partners.map(p => ({ value: p.id, label: p.name }));

  const amount = parseIntAmount(transactionFormState.amount);
  const amountDisplay = amount > 0 ? formatToman(amount) : '۰ تومان';

  const employerWarning = employers.length === 0 ? `
    <div class="rounded-xl bg-warning-soft p-3 text-xs text-warning flex items-center gap-2">
      <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i>
      <span class="flex-1">ابتدا یک کارفرما ثبت کنید.</span>
      <button onclick="window.__navigate('/employers')" class="text-brand font-medium underline shrink-0">رفتن</button>
    </div>
  ` : '';

  const partnerWarning = partners.length === 0 ? `
    <div class="rounded-xl bg-warning-soft p-3 text-xs text-warning flex items-center gap-2">
      <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i>
      <span class="flex-1">ابتدا یک شریک ثبت کنید.</span>
      <button onclick="window.__navigate('/partners')" class="text-brand font-medium underline shrink-0">رفتن</button>
    </div>
  ` : '';

  return `
    <div class="space-y-3">
      ${employerWarning}
      ${Select({ name: 'employerId', label: 'کارفرما', options: employerOptions, value: transactionFormState.employerId, required: true, placeholder: 'انتخاب کارفرما', icon: 'briefcase' })}
      <div>
        <label class="text-xs text-fg-muted mb-1.5 block">مبلغ دریافتی <span class="text-danger">*</span></label>
        <div class="text-center py-3 mb-2">
          <p class="text-2xl font-bold tabular-nums ${amount > 0 ? 'text-success' : 'text-fg-muted'}" id="amount-display">${amountDisplay}</p>
        </div>
        ${Input({ name: 'amount', type: 'text', placeholder: 'مبلغ به تومان', value: formatTransactionAmount(transactionFormState.amount), suffix: 'تومان', inputmode: 'numeric' })}
        <p data-transaction-amount-words class="text-[11px] text-fg-muted mt-1 min-h-4" aria-live="polite"></p>
        <div class="flex gap-2 mt-2">
          <button type="button" onclick="window.__addQuickAmount(100000)" class="flex-1 h-9 rounded-lg glass text-xs font-medium hover:bg-white/10 transition">+ ۱۰۰هزار</button>
          <button type="button" onclick="window.__addQuickAmount(500000)" class="flex-1 h-9 rounded-lg glass text-xs font-medium hover:bg-white/10 transition">+ ۵۰۰هزار</button>
          <button type="button" onclick="window.__addQuickAmount(1000000)" class="flex-1 h-9 rounded-lg glass text-xs font-medium hover:bg-white/10 transition">+ ۱ میلیون</button>
        </div>
      </div>
      <div>
        <label class="text-xs text-fg-muted mb-1.5 block">تاریخ دریافت <span class="text-danger">*</span></label>
        <button onclick="window.__openTxDate()" class="w-full h-11 px-4 rounded-xl bg-ink-soft border border-line focus:border-brand outline-none text-sm transition flex items-center justify-between">
          <span>${formatJalali(transactionFormState.date)}</span>
          <i data-lucide="calendar" class="w-4 h-4 text-fg-muted"></i>
        </button>
      </div>
      ${partnerWarning}
      ${Select({ name: 'receiverPartnerId', label: 'دریافت‌کننده (کی پول را گرفته؟)', options: partnerOptions, value: transactionFormState.receiverPartnerId, required: true, placeholder: 'انتخاب شریک', icon: 'user' })}
      ${Textarea({ name: 'note', label: 'توضیحات (اختیاری)', placeholder: 'یادداشت اختیاری...', value: transactionFormState.note, rows: 2 })}
    </div>
  `;
}

function renderStep2() {
  const employerId = transactionFormState.employerId;
  const employer = (state.data.employers || []).find(e => e.id === employerId);

  if (!employer) {
    return `<div class="rounded-xl bg-warning-soft p-4 text-center"><i data-lucide="alert-triangle" class="w-8 h-8 text-warning mx-auto mb-2"></i><p class="text-xs text-warning">ابتدا کارفرما را انتخاب کنید.</p></div>`;
  }

  const projects = (state.data.projects || []).filter(p => !p.deletedAt && p.employerId === employerId && p.status !== 'archived');
  const projectDebts = projects.map(p => ({ id: p.id, title: p.title, color: p.color, remaining: getProjectRemaining(p.id, state.data) })).filter(p => p.remaining > 0);

  const receiptAmount = parseIntAmount(transactionFormState.amount);

  if (projectDebts.length === 0) {
    return `
      <div class="space-y-3">
        <div class="rounded-xl bg-info-soft p-4 text-center">
          <i data-lucide="check-circle" class="w-8 h-8 text-purple-300 mx-auto mb-2"></i>
          <p class="text-xs text-purple-300 mb-1">این کارفرما پروژه بدهکاری ندارد.</p>
          <p class="text-[11px] text-fg-muted">کل مبلغ به‌عنوان علی‌الحساب کارفرما ثبت می‌شود.</p>
        </div>
        <div id="allocation-summary">${renderAllocationSummary(receiptAmount, computeTotalAllocated())}</div>
      </div>
    `;
  }

  return `
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-xs text-fg-muted">پروژه‌های بدهکار این کارفرما</p>
        <button onclick="window.__autoSuggest()" class="text-[11px] text-brand font-medium hover:underline">تخصیص خودکار</button>
      </div>
      <div class="space-y-2">
        ${projectDebts.map(pd => {
          const isSelected = transactionFormState.selectedProjects.includes(pd.id);
          const allocValue = transactionFormState.allocations[pd.id] ?? '';
          const allocAmount = parseIntAmount(allocValue);
          const percent = pd.remaining > 0 && allocAmount > 0 ? Math.min(100, Math.round((allocAmount / pd.remaining) * 100)) : 0;
          const colorHex = COLOR_HEX[pd.color] || COLOR_HEX.brand;
          return `
            <div class="glass rounded-xl p-3 ${isSelected ? 'border border-brand/40' : ''}">
              <div class="flex items-center gap-3">
                <label class="flex items-center gap-2.5 flex-1 min-w-0">
                  <input type="checkbox" data-project-id="${pd.id}" ${isSelected ? 'checked' : ''} onchange="window.__toggleProject('${pd.id}')" class="w-4 h-4 rounded accent-brand" />
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background: ${colorHex}20;">
                    <i data-lucide="briefcase" class="w-4 h-4" style="color: ${colorHex};"></i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">${pd.title}</p>
                    <p class="text-[10px] text-fg-muted">بدهی باقیمانده: ${formatTomanShort(pd.remaining)}</p>
                  </div>
                </label>
                ${isSelected ? `
                  <div class="flex items-center gap-1 shrink-0">
                    <input type="text" inputmode="numeric" data-alloc-project="${pd.id}" value="${allocValue ? toPersianDigits(allocValue) : ''}" placeholder="۰" class="w-24 h-9 px-2 rounded-lg bg-ink-soft border border-line focus:border-brand outline-none text-sm text-center tabular-nums" />
                    <span class="text-[10px] text-fg-muted">ت</span>
                  </div>
                ` : ''}
              </div>
              ${isSelected ? `
                <div class="mt-2 px-1" data-alloc-bar="${pd.id}" style="${allocAmount > 0 ? '' : 'display:none;'}">
                  <div class="flex items-center justify-between text-[10px] mb-1">
                    <span class="text-fg-muted">تخصیص</span>
                    <span class="font-medium" data-alloc-percent>${toPersianDigits(percent)}٪</span>
                  </div>
                  ${ProgressBar({ value: percent })}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
      <div id="allocation-summary">${renderAllocationSummary(receiptAmount, computeTotalAllocated())}</div>
    </div>
  `;
}

function computeTotalAllocated() {
  let total = 0;
  for (const pid of transactionFormState.selectedProjects) {
    total += parseIntAmount(transactionFormState.allocations[pid] || '0');
  }
  return total;
}

function renderAllocationSummary(receiptAmount, totalAllocated) {
  const surplus = receiptAmount - totalAllocated;
  const isOver = totalAllocated > receiptAmount;
  return `
    <div class="glass-strong rounded-2xl p-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-fg-muted">مبلغ دریافتی</span>
        <span class="text-sm font-bold tabular-nums">${formatToman(receiptAmount)}</span>
      </div>
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-fg-muted">مجموع تخصیص</span>
        <span class="text-sm font-bold tabular-nums ${isOver ? 'text-danger' : 'text-success'}">${formatToman(totalAllocated)}</span>
      </div>
      <div class="border-t border-white/5 pt-2 mt-2">
        ${surplus > 0 ? `
          <div class="flex items-center justify-between">
            <span class="text-xs text-success flex items-center gap-1"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> مازاد</span>
            <span class="text-sm font-bold text-success tabular-nums">${formatToman(surplus)}</span>
          </div>
          <p class="text-[10px] text-fg-muted mt-1">مازاد به علی‌الحساب کارفرما ثبت می‌شود</p>
        ` : isOver ? `
          <div class="flex items-center justify-between">
            <span class="text-xs text-danger flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> کسری</span>
            <span class="text-sm font-bold text-danger tabular-nums">${formatToman(-surplus)}</span>
          </div>
          <p class="text-[10px] text-danger mt-1">جمع تخصیص بیش از مبلغ دریافتی است</p>
        ` : `
          <div class="flex items-center justify-between">
            <span class="text-xs text-success flex items-center gap-1"><i data-lucide="check" class="w-3.5 h-3.5"></i> تطابق کامل</span>
            <span class="text-sm font-bold text-success tabular-nums">${formatToman(0)}</span>
          </div>
        `}
      </div>
    </div>
  `;
}

function attachFormListeners() {
  const main = document.getElementById('page-content');
  if (!main) return;
  const employerSelect = main.querySelector('[name="employerId"]');
  if (employerSelect) employerSelect.addEventListener('change', (e) => {
    transactionFormState.employerId = e.target.value;
    transactionFormState.selectedProjects = [];
    transactionFormState.allocations = {};
    transactionFormState.allocationDirty = {};
  });
  const amountInput = main.querySelector('[name="amount"]');
  attachTransactionAmountInput(amountInput, transactionFormState, main.querySelector('[data-transaction-amount-words]'), (amt) => {
    const display = document.getElementById('amount-display');
    if (display) {
      display.textContent = amt > 0 ? formatToman(amt) : '۰ تومان';
      display.className = `text-2xl font-bold tabular-nums ${amt > 0 ? 'text-success' : 'text-fg-muted'}`;
    }
  });
  const receiverSelect = main.querySelector('[name="receiverPartnerId"]');
  if (receiverSelect) receiverSelect.addEventListener('change', (e) => { transactionFormState.receiverPartnerId = e.target.value; });
  const noteInput = main.querySelector('[name="note"]');
  if (noteInput) noteInput.addEventListener('input', (e) => { transactionFormState.note = e.target.value; });
  const allocInputs = main.querySelectorAll('[data-alloc-project]');
  allocInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const pid = e.target.dataset.allocProject;
      transactionFormState.allocations[pid] = e.target.value;
      transactionFormState.allocationDirty[pid] = true;
      updateAllocationUI();
    });
  });
}

function updateAllocationUI() {
  const summaryEl = document.getElementById('allocation-summary');
  if (summaryEl) {
    const receiptAmount = parseIntAmount(transactionFormState.amount);
    const totalAllocated = computeTotalAllocated();
    summaryEl.innerHTML = renderAllocationSummary(receiptAmount, totalAllocated);
    if (window.lucide) window.lucide.createIcons();
  }
  for (const pid of transactionFormState.selectedProjects) {
    const remaining = getProjectRemaining(pid, state.data);
    const allocAmount = parseIntAmount(transactionFormState.allocations[pid] || '0');
    const percent = remaining > 0 && allocAmount > 0 ? Math.min(100, Math.round((allocAmount / remaining) * 100)) : 0;
    const barContainer = document.querySelector(`[data-alloc-bar="${pid}"]`);
    if (barContainer) {
      if (allocAmount > 0) {
        barContainer.style.display = '';
        const percentEl = barContainer.querySelector('[data-alloc-percent]');
        if (percentEl) percentEl.textContent = `${toPersianDigits(percent)}٪`;
      } else {
        barContainer.style.display = 'none';
      }
    }
  }
}

function refreshFormStep() {
  // فقط محتوای فرم را به‌روز می‌کند (نه دکمه‌ها)
  // برای تغییرات که دکمه‌ها را تغییر می‌دهند، از renderAddTransactionPage استفاده کنید
  const contentEl = document.getElementById('transaction-form-content');
  if (contentEl) {
    contentEl.innerHTML = renderFormStep();
    if (window.lucide) window.lucide.createIcons();
    attachFormListeners();
  }
}

function openTxDate() {
  syncTransactionFormInputs();
  openDatePicker({ value: transactionFormState.date, onSelect: (iso) => { transactionFormState.date = iso; renderAddTransactionPage(false); }, onClose: () => {} });
}

function addQuickAmount(delta) {
  syncTransactionFormInputs();
  const current = parseIntAmount(transactionFormState.amount);
  const next = current + delta;
  transactionFormState.amount = String(next);
  renderAddTransactionPage(false);
}

function toggleProject(pid) {
  syncTransactionFormInputs();
  if (transactionFormState.selectedProjects.includes(pid)) {
    transactionFormState.selectedProjects = transactionFormState.selectedProjects.filter(id => id !== pid);
    delete transactionFormState.allocations[pid];
    delete transactionFormState.allocationDirty[pid];
  } else {
    transactionFormState.selectedProjects.push(pid);
    transactionFormState.allocations[pid] = '';
  }
  silentAutoSuggest();
  renderAddTransactionPage(false);
}

function silentAutoSuggest() {
  const receiptAmount = parseIntAmount(transactionFormState.amount);
  if (receiptAmount <= 0) return;
  if (transactionFormState.selectedProjects.length === 0) return;

  const employerId = transactionFormState.employerId;
  const projects = (state.data.projects || []).filter(p =>
    !p.deletedAt && p.employerId === employerId && p.status !== 'archived'
  );

  // به ترتیب انتخاب پیش می‌رویم؛ مبالغی که کاربر دستی وارد کرده از مانده کسر می‌شوند.
  let remainingAmount = receiptAmount;
  for (const pid of transactionFormState.selectedProjects) {
    const project = projects.find(p => p.id === pid);
    if (!project) continue;

    const projectRemaining = getProjectRemaining(pid, state.data);
    if (transactionFormState.allocationDirty[pid]) {
      remainingAmount -= parseIntAmount(transactionFormState.allocations[pid] || '0');
      continue;
    }

    const amount = Math.min(projectRemaining, Math.max(0, remainingAmount));
    transactionFormState.allocations[pid] = String(amount);
    remainingAmount -= amount;
  }
}

function autoSuggestAllocations() {
  syncTransactionFormInputs();
  const receiptAmount = parseIntAmount(transactionFormState.amount);
  if (receiptAmount <= 0) { showToast('ابتدا مبلغ دریافتی را وارد کنید', 'warning'); return; }
  if (transactionFormState.selectedProjects.length === 0) { showToast('حداقل یک پروژه را انتخاب کنید', 'warning'); return; }
  const employerId = transactionFormState.employerId;
  const projects = (state.data.projects || []).filter(p => !p.deletedAt && p.employerId === employerId && p.status !== 'archived');
  const projectDebts = transactionFormState.selectedProjects
    .map(pid => projects.find(p => p.id === pid))
    .filter(Boolean)
    .map(p => ({ id: p.id, remaining: getProjectRemaining(p.id, state.data) }))
    .filter(p => p.remaining > 0);
  if (projectDebts.length === 0) { showToast('پروژه بدهکاری برای این کارفرما وجود ندارد', 'warning'); return; }
  const result = suggestAllocation(receiptAmount, projectDebts);
  for (const alloc of result.allocations) {
    if (transactionFormState.selectedProjects.includes(alloc.projectId)) transactionFormState.allocations[alloc.projectId] = String(alloc.amount);
  }
  for (const pid of transactionFormState.selectedProjects) {
    if (!result.allocations.find(a => a.projectId === pid)) transactionFormState.allocations[pid] = '0';
  }
  transactionFormState.allocationDirty = {};
  renderAddTransactionPage(false);
  if (result.surplus > 0) showToast(`تخصیص اعمال شد. مازاد: ${formatToman(result.surplus)}`, 'info');
  else showToast('تخصیص پیشنهادی اعمال شد', 'success');
}

function txFormNext() {
  syncTransactionFormInputs();
  if (transactionFormState.step === 1 && !validateStep1()) return;
  if (transactionFormState.step < 2) {
    transactionFormState.step++;
    if (transactionFormState.step === 2) silentAutoSuggest();
    renderAddTransactionPage(false);
  }
}

function txFormPrev() {
  syncTransactionFormInputs();
  if (transactionFormState.step > 1) { transactionFormState.step--; renderAddTransactionPage(false); }
}

// Sync all form inputs to state (defensive — handles cases where input events didn't fire)
function syncTransactionFormInputs() {
  const main = document.getElementById('page-content');
  if (!main) return;

  const employerSelect = main.querySelector('[name="employerId"]');
  if (employerSelect) transactionFormState.employerId = employerSelect.value;

  const amountInput = main.querySelector('[name="amount"]');
  if (amountInput) transactionFormState.amount = toLatinDigits(amountInput.value).replace(/[^\d]/g, '');

  const receiverSelect = main.querySelector('[name="receiverPartnerId"]');
  if (receiverSelect) transactionFormState.receiverPartnerId = receiverSelect.value;

  const noteInput = main.querySelector('[name="note"]');
  if (noteInput) transactionFormState.note = noteInput.value;

  // Step 2 allocation inputs — handle Persian digits
  const allocInputs = main.querySelectorAll('[data-alloc-project]');
  allocInputs.forEach(input => {
    const pid = input.dataset.allocProject;
    const latinValue = toLatinDigits(String(input.value || ''));
    const val = parseInt(latinValue.replace(/[^\d]/g, '')) || 0;
    transactionFormState.allocations[pid] = String(val);
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
  if (!transactionFormState.employerId) { showToast('انتخاب کارفرما الزامی است', 'error'); return false; }
  const amount = parseIntAmount(transactionFormState.amount);
  if (!amount || amount <= 0) { showToast('مبلغ دریافتی باید عدد صحیح مثبت باشد', 'error'); return false; }
  if (!transactionFormState.date) { showToast('تاریخ دریافت الزامی است', 'error'); return false; }
  if (!transactionFormState.receiverPartnerId) { showToast('انتخاب دریافت‌کننده الزامی است', 'error'); return false; }
  return true;
}

async function txFormSave() {
  syncTransactionFormInputs();
  if (!validateStep1()) { transactionFormState.step = 1; renderAddTransactionPage(false); return; }
  const receiptAmount = parseIntAmount(transactionFormState.amount);
  const totalAllocated = computeTotalAllocated();
  if (totalAllocated > receiptAmount) { showToast('جمع تخصیص‌ها بیش از مبلغ دریافتی است', 'error'); return; }

  const employerId = transactionFormState.employerId;
  const projects = (state.data.projects || []).filter(p => !p.deletedAt && p.employerId === employerId && p.status !== 'archived');
  for (const pid of transactionFormState.selectedProjects) {
    const allocAmount = parseIntAmount(transactionFormState.allocations[pid] || '0');
    if (allocAmount < 0) { showToast('مبلغ تخصیص منفی مجاز نیست', 'error'); return; }
    const project = projects.find(p => p.id === pid);
    if (project) {
      const remaining = getProjectRemaining(pid, state.data);
      if (allocAmount > remaining) { showToast(`تخصیص بیش از بدهی پروژه «${project.title}» است`, 'error'); return; }
    }
  }

  const surplus = receiptAmount - totalAllocated;

  try {
    const receiptData = {
      employerId: transactionFormState.employerId,
      receiverPartnerId: transactionFormState.receiverPartnerId,
      amount: receiptAmount,
      date: transactionFormState.date,
      note: transactionFormState.note?.trim() || ''
    };
    const receipt = await repo.receipts.create(receiptData);
    state.updateEntity('receipts', receipt);

    for (const pid of transactionFormState.selectedProjects) {
      const allocAmount = parseIntAmount(transactionFormState.allocations[pid] || '0');
      if (allocAmount > 0) {
        const alloc = await repo.receiptAllocations.create({ receiptId: receipt.id, projectId: pid, amount: allocAmount });
        state.updateEntity('receiptAllocations', alloc);
      }
    }

    if (surplus > 0) {
      const existingCredit = (state.data.employerCredits || []).find(c => c.employerId === transactionFormState.employerId && c.amount > 0);
      if (existingCredit) {
        const updated = await repo.employerCredits.update(existingCredit.id, { amount: existingCredit.amount + surplus, sourceReceiptId: receipt.id });
        state.updateEntity('employerCredits', updated);
      } else {
        const credit = await repo.employerCredits.create({ employerId: transactionFormState.employerId, amount: surplus, sourceReceiptId: receipt.id, consumedReceiptIds: [] });
        state.updateEntity('employerCredits', credit);
      }
    }

    showToast('دریافتی با موفقیت ثبت شد', 'success');
    transactionFormState = null;
    navigate('/transactions');
  } catch (e) {
    console.error('Save receipt failed:', e);
    showToast('خطا در ثبت دریافتی', 'error');
  }
}

// =========== DELETE TRANSACTIONS ===========
// حذف با قابلیت بازگردانی (undo) — رکورد به‌صورت soft-delete می‌شود و toast با دکمه «بازگردانی» نشان داده می‌شود.
function deleteReceipt(id) {
  const receipt = (state.data.receipts || []).find(r => r.id === id);
  if (!receipt) return;

  (async () => {
    try {
      // Soft-delete: فقط receipt را soft-delete می‌کنیم (allocations حفظ می‌شوند تا در صورت undo قابل بازیابی باشند)
      const updated = await repo.receipts.update(id, { deletedAt: new Date().toISOString() });
      state.updateEntity('receipts', updated);
      afterChange();

      showToast('حذف شد', 'success', {
        duration: 5000,
        actionLabel: 'بازگردانی',
        onAction: async () => {
          try {
            const restored = await repo.receipts.update(id, { deletedAt: null });
            state.updateEntity('receipts', restored);
            showToast('دریافتی بازگردانده شد', 'success');
            renderTransactionsPage();
          } catch (e) {
            console.error('Restore receipt failed:', e);
            showToast('خطا در بازگردانی', 'error');
          }
        }
      });
    } catch (e) {
      console.error('Delete receipt failed:', e);
      showToast('خطا در حذف دریافتی', 'error');
    }
  })();
}

function deleteExpense(id) {
  const expense = (state.data.expenses || []).find(e => e.id === id);
  if (!expense) return;

  (async () => {
    try {
      const updated = await repo.expenses.update(id, { deletedAt: new Date().toISOString() });
      state.updateEntity('expenses', updated);
      renderTransactionsPage();

      showToast('حذف شد', 'success', {
        duration: 5000,
        actionLabel: 'بازگردانی',
        onAction: async () => {
          try {
            const restored = await repo.expenses.update(id, { deletedAt: null });
            state.updateEntity('expenses', restored);
            showToast('هزینه بازگردانده شد', 'success');
            renderTransactionsPage();
          } catch (e) {
            console.error('Restore expense failed:', e);
            showToast('خطا در بازگردانی', 'error');
          }
        }
      });
    } catch (e) {
      console.error('Delete expense failed:', e);
      showToast('خطا در حذف هزینه', 'error');
    }
  })();
}

function deleteTransfer(id, afterChange = renderTransactionsPage) {
  const transfer = (state.data.partnerTransfers || []).find(t => t.id === id);
  if (!transfer) return;

  (async () => {
    try {
      const updated = await repo.partnerTransfers.update(id, { deletedAt: new Date().toISOString() });
      state.updateEntity('partnerTransfers', updated);
      afterChange();

      showToast('حذف شد', 'success', {
        duration: 5000,
        actionLabel: 'بازگردانی',
        onAction: async () => {
          try {
            const restored = await repo.partnerTransfers.update(id, { deletedAt: null });
            state.updateEntity('partnerTransfers', restored);
            showToast('انتقال بازگردانده شد', 'success');
            afterChange();
          } catch (e) {
            console.error('Restore transfer failed:', e);
            showToast('خطا در بازگردانی', 'error');
          }
        }
      });
    } catch (e) {
      console.error('Delete transfer failed:', e);
      showToast('خطا در حذف انتقال', 'error');
    }
  })();
}

// =========== EDIT RECEIPT (bottom sheet) ===========
function editReceipt(id) {
  const receipt = (state.data.receipts || []).find(r => r.id === id);
  if (!receipt) return;
  editReceiptState = {
    id: receipt.id,
    employerId: receipt.employerId || '',
    amount: String(receipt.amount || ''),
    date: receipt.date || today(),
    receiverPartnerId: receipt.receiverPartnerId || '',
    note: receipt.note || ''
  };
  openSheet(renderReceiptEditForm(), {
    onMount: () => {
      attachReceiptEditListeners();
      window.__saveReceiptEdit = saveReceiptEdit;
      window.__closeEditSheet = () => closeSheet();
      window.__openReceiptEditDate = openReceiptEditDate;
    }
  });
}

function renderReceiptEditForm() {
  const employers = (state.data.employers || []).filter(e => !e.deletedAt);
  const partners = (state.data.partners || []).filter(p => !p.deletedAt);
  const employerOptions = employers.map(e => ({ value: e.id, label: e.name }));
  const partnerOptions = partners.map(p => ({ value: p.id, label: p.name }));

  return `
    <div class="pb-2">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold">ویرایش دریافتی</h3>
        <button onclick="window.__closeEditSheet()" class="w-8 h-8 rounded-lg glass flex items-center justify-center">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="space-y-3">
        ${Select({ name: 'editEmployerId', label: 'کارفرما', options: employerOptions, value: editReceiptState.employerId, required: true, placeholder: 'انتخاب کارفرما', icon: 'briefcase' })}
        ${Input({ name: 'editAmount', type: 'text', label: 'مبلغ دریافتی', placeholder: 'مبلغ به تومان', value: formatTransactionAmount(editReceiptState.amount), required: true, suffix: 'تومان', inputmode: 'numeric' })}
        <p data-edit-receipt-amount-words class="text-[11px] text-fg-muted -mt-1 min-h-4" aria-live="polite"></p>
        <div>
          <label class="text-xs text-fg-muted mb-1.5 block">تاریخ دریافت <span class="text-danger">*</span></label>
          <button onclick="window.__openReceiptEditDate()" class="w-full h-11 px-4 rounded-xl bg-ink-soft border border-line focus:border-brand outline-none text-sm transition flex items-center justify-between">
            <span>${formatJalali(editReceiptState.date)}</span>
            <i data-lucide="calendar" class="w-4 h-4 text-fg-muted"></i>
          </button>
        </div>
        ${Select({ name: 'editReceiverPartnerId', label: 'دریافت‌کننده', options: partnerOptions, value: editReceiptState.receiverPartnerId, required: true, placeholder: 'انتخاب شریک', icon: 'user' })}
        ${Textarea({ name: 'editNote', label: 'توضیحات (اختیاری)', placeholder: 'یادداشت اختیاری...', value: editReceiptState.note, rows: 2 })}
      </div>
      <div class="flex gap-2 mt-6">
        <button onclick="window.__closeEditSheet()" class="flex-1 h-11 rounded-xl glass text-sm font-medium hover:bg-white/10 transition">انصراف</button>
        <button onclick="window.__saveReceiptEdit()" class="flex-1 h-11 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-brand/30">
          <i data-lucide="check" class="w-4 h-4"></i> ذخیره تغییرات
        </button>
      </div>
    </div>
  `;
}

function attachReceiptEditListeners() {
  const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (!sheet) return;
  const employerSelect = sheet.querySelector('[name="editEmployerId"]');
  if (employerSelect) employerSelect.addEventListener('change', (e) => { editReceiptState.employerId = e.target.value; });
  const amountInput = sheet.querySelector('[name="editAmount"]');
  attachTransactionAmountInput(amountInput, editReceiptState, sheet.querySelector('[data-edit-receipt-amount-words]'));
  const receiverSelect = sheet.querySelector('[name="editReceiverPartnerId"]');
  if (receiverSelect) receiverSelect.addEventListener('change', (e) => { editReceiptState.receiverPartnerId = e.target.value; });
  const noteInput = sheet.querySelector('[name="editNote"]');
  if (noteInput) noteInput.addEventListener('input', (e) => { editReceiptState.note = e.target.value; });
}

function openReceiptEditDate() {
  openDatePicker({
    value: editReceiptState.date,
    onSelect: (iso) => { editReceiptState.date = iso; refreshReceiptEditSheet(); },
    onClose: () => {}
  });
}

function refreshReceiptEditSheet() {
  const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (!sheet) return;
  sheet.innerHTML = `<div class="px-5 pt-5 pb-8 sheet-content">${renderReceiptEditForm()}</div>`;
  if (window.lucide) window.lucide.createIcons();
  attachReceiptEditListeners();
  window.__saveReceiptEdit = saveReceiptEdit;
  window.__closeEditSheet = () => closeSheet();
  window.__openReceiptEditDate = openReceiptEditDate;
}

async function saveReceiptEdit() {
  if (!editReceiptState) return;
  // Sync from inputs (defensive)
  const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (sheet) {
    const employerSelect = sheet.querySelector('[name="editEmployerId"]');
    if (employerSelect) editReceiptState.employerId = employerSelect.value;
    const amountInput = sheet.querySelector('[name="editAmount"]');
    if (amountInput) editReceiptState.amount = toLatinDigits(amountInput.value).replace(/[^\d]/g, '');
    const receiverSelect = sheet.querySelector('[name="editReceiverPartnerId"]');
    if (receiverSelect) editReceiptState.receiverPartnerId = receiverSelect.value;
    const noteInput = sheet.querySelector('[name="editNote"]');
    if (noteInput) editReceiptState.note = noteInput.value;
  }

  if (!editReceiptState.employerId) { showToast('انتخاب کارفرما الزامی است', 'error'); return; }
  const amount = parseIntAmount(editReceiptState.amount);
  if (!amount || amount <= 0) { showToast('مبلغ باید عدد صحیح مثبت باشد', 'error'); return; }
  if (!editReceiptState.date) { showToast('تاریخ دریافت الزامی است', 'error'); return; }
  if (!editReceiptState.receiverPartnerId) { showToast('انتخاب دریافت‌کننده الزامی است', 'error'); return; }

  try {
    const updated = await repo.receipts.update(editReceiptState.id, {
      employerId: editReceiptState.employerId,
      receiverPartnerId: editReceiptState.receiverPartnerId,
      amount,
      date: editReceiptState.date,
      note: editReceiptState.note?.trim() || ''
    });
    state.updateEntity('receipts', updated);
    showToast('دریافتی به‌روزرسانی شد', 'success');
    editReceiptState = null;
    closeSheet();
    renderTransactionsPage();
  } catch (e) {
    console.error('Save receipt edit failed:', e);
    showToast('خطا در به‌روزرسانی دریافتی', 'error');
  }
}

// =========== EDIT EXPENSE (bottom sheet) ===========
function editExpense(id) {
  const expense = (state.data.expenses || []).find(e => e.id === id);
  if (!expense) return;

  // Convert existing shareDistribution (array of {partnerId, amount}) to shares state
  const shares = {};
  if (Array.isArray(expense.shareDistribution)) {
    for (const s of expense.shareDistribution) {
      if (s && s.partnerId && s.amount > 0) {
        shares[s.partnerId] = { type: 'amount', value: s.amount };
      }
    }
  }

  editExpenseState = {
    id: expense.id,
    title: expense.title || '',
    amount: String(expense.amount || ''),
    paidByPartnerId: expense.paidByPartnerId || '',
    date: expense.date || today(),
    note: expense.note || '',
    shares
  };

  openSheet(renderExpenseEditForm(), {
    onMount: () => {
      attachExpenseEditListeners();
      window.__saveExpenseEdit = saveExpenseEdit;
      window.__closeEditSheet = () => closeSheet();
      window.__openExpenseEditDate = openExpenseEditDate;
    }
  });
}

function renderExpenseEditForm() {
  const partners = (state.data.partners || []).filter(p => !p.deletedAt);
  const partnerOptions = partners.map(p => ({ value: p.id, label: p.name }));

  return `
    <div class="pb-2">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold">ویرایش هزینه</h3>
        <button onclick="window.__closeEditSheet()" class="w-8 h-8 rounded-lg glass flex items-center justify-center">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="space-y-3">
        ${Input({ name: 'editTitle', label: 'عنوان هزینه', placeholder: 'مثلاً: خرید سرور', value: editExpenseState.title, required: true, icon: 'receipt' })}
        ${Input({ name: 'editAmount', type: 'text', label: 'مبلغ', placeholder: 'مبلغ به تومان', value: editExpenseState.amount, required: true, suffix: 'تومان', inputmode: 'numeric' })}
        <div>
          <label class="text-xs text-fg-muted mb-1.5 block">تاریخ <span class="text-danger">*</span></label>
          <button onclick="window.__openExpenseEditDate()" class="w-full h-11 px-4 rounded-xl bg-ink-soft border border-line focus:border-brand outline-none text-sm transition flex items-center justify-between">
            <span>${formatJalali(editExpenseState.date)}</span>
            <i data-lucide="calendar" class="w-4 h-4 text-fg-muted"></i>
          </button>
        </div>
        ${Select({ name: 'editPaidByPartnerId', label: 'پرداخت‌کننده', options: partnerOptions, value: editExpenseState.paidByPartnerId, required: true, placeholder: 'کی پرداخت کرده؟', icon: 'user' })}
        ${renderShareDistributionHtml(editExpenseState, partners)}
        ${Textarea({ name: 'editNote', label: 'توضیحات (اختیاری)', placeholder: 'یادداشت اختیاری...', value: editExpenseState.note, rows: 2 })}
      </div>
      <div class="flex gap-2 mt-6">
        <button onclick="window.__closeEditSheet()" class="flex-1 h-11 rounded-xl glass text-sm font-medium hover:bg-white/10 transition">انصراف</button>
        <button onclick="window.__saveExpenseEdit()" class="flex-1 h-11 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-brand/30">
          <i data-lucide="check" class="w-4 h-4"></i> ذخیره تغییرات
        </button>
      </div>
    </div>
  `;
}

function attachExpenseEditListeners() {
  const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (!sheet) return;
  const titleInput = sheet.querySelector('[name="editTitle"]');
  if (titleInput) titleInput.addEventListener('input', (e) => { editExpenseState.title = e.target.value; });
  const amountInput = sheet.querySelector('[name="editAmount"]');
  if (amountInput) amountInput.addEventListener('input', (e) => {
    editExpenseState.amount = e.target.value;
    const partners = (state.data.partners || []).filter(p => !p.deletedAt);
    refreshShareSummary(editExpenseState, partners);
  });
  const paidBySelect = sheet.querySelector('[name="editPaidByPartnerId"]');
  if (paidBySelect) paidBySelect.addEventListener('change', (e) => { editExpenseState.paidByPartnerId = e.target.value; });
  const noteInput = sheet.querySelector('[name="editNote"]');
  if (noteInput) noteInput.addEventListener('input', (e) => { editExpenseState.note = e.target.value; });

  // Share distribution handlers (rebinds window.__setShareType, window.__splitEqual)
  const partners = (state.data.partners || []).filter(p => !p.deletedAt);
  attachShareHandlers(editExpenseState, partners, refreshExpenseEditSheet, sheet);
}

function openExpenseEditDate() {
  openDatePicker({
    value: editExpenseState.date,
    onSelect: (iso) => { editExpenseState.date = iso; refreshExpenseEditSheet(); },
    onClose: () => {}
  });
}

function refreshExpenseEditSheet() {
  const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (!sheet) return;
  sheet.innerHTML = `<div class="px-5 pt-5 pb-8 sheet-content">${renderExpenseEditForm()}</div>`;
  if (window.lucide) window.lucide.createIcons();
  attachExpenseEditListeners();
  window.__saveExpenseEdit = saveExpenseEdit;
  window.__closeEditSheet = () => closeSheet();
  window.__openExpenseEditDate = openExpenseEditDate;
}

async function saveExpenseEdit() {
  if (!editExpenseState) return;
  // Sync from inputs (defensive)
  const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (sheet) {
    const titleInput = sheet.querySelector('[name="editTitle"]');
    if (titleInput) editExpenseState.title = titleInput.value;
    const amountInput = sheet.querySelector('[name="editAmount"]');
    if (amountInput) editExpenseState.amount = amountInput.value;
    const paidBySelect = sheet.querySelector('[name="editPaidByPartnerId"]');
    if (paidBySelect) editExpenseState.paidByPartnerId = paidBySelect.value;
    const noteInput = sheet.querySelector('[name="editNote"]');
    if (noteInput) editExpenseState.note = noteInput.value;
  }

  if (!editExpenseState.title || editExpenseState.title.trim().length < 2) { showToast('عنوان هزینه حداقل ۲ کاراکتر باید باشد', 'error'); return; }
  const amount = parseIntAmount(editExpenseState.amount);
  if (!amount || amount <= 0) { showToast('مبلغ باید عدد صحیح مثبت باشد', 'error'); return; }
  if (!editExpenseState.paidByPartnerId) { showToast('انتخاب پرداخت‌کننده الزامی است', 'error'); return; }
  if (!editExpenseState.date) { showToast('تاریخ الزامی است', 'error'); return; }

  const shareDistribution = computeShareAmounts(editExpenseState, amount);
  const hasShares = Object.values(editExpenseState.shares || {}).some(s => s && s.value > 0);
  if (hasShares) {
    const total = shareDistribution.reduce((s, x) => s + x.amount, 0);
    if (total !== amount) {
      showToast(`مجموع سهم‌ها (${formatToman(total)}) با مبلغ هزینه (${formatToman(amount)}) برابر نیست`, 'error');
      return;
    }
  }

  try {
    const updated = await repo.expenses.update(editExpenseState.id, {
      title: editExpenseState.title.trim(),
      amount,
      paidByPartnerId: editExpenseState.paidByPartnerId,
      date: editExpenseState.date,
      note: editExpenseState.note?.trim() || '',
      shareDistribution: hasShares ? shareDistribution : []
    });
    state.updateEntity('expenses', updated);
    showToast('هزینه به‌روزرسانی شد', 'success');
    editExpenseState = null;
    closeSheet();
    renderTransactionsPage();
  } catch (e) {
    console.error('Save expense edit failed:', e);
    showToast('خطا در به‌روزرسانی هزینه', 'error');
  }
}

// =========== EDIT TRANSFER (bottom sheet) ===========
function editTransfer(id, afterSave = renderTransactionsPage) {
  transferAfterSave = afterSave;
  const transfer = (state.data.partnerTransfers || []).find(t => t.id === id);
  if (!transfer) return;
  editTransferState = {
    id: transfer.id,
    fromPartnerId: transfer.fromPartnerId || '',
    toPartnerId: transfer.toPartnerId || '',
    amount: String(transfer.amount || ''),
    date: transfer.date || today(),
    purpose: transfer.purpose || 'project_settlement',
    note: transfer.note || ''
  };
  openSheet(renderTransferEditForm(), {
    onMount: () => {
      attachTransferEditListeners();
      window.__saveTransferEdit = saveTransferEdit;
      window.__closeEditSheet = () => closeSheet();
      window.__openTransferEditDate = openTransferEditDate;
    }
  });
}

function renderTransferEditForm() {
  const partners = (state.data.partners || []).filter(p => !p.deletedAt);
  const partnerOptions = partners.map(p => ({ value: p.id, label: p.name }));

  return `
    <div class="pb-2">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold">ویرایش انتقال</h3>
        <button onclick="window.__closeEditSheet()" class="w-8 h-8 rounded-lg glass flex items-center justify-center">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="space-y-3">
        ${Select({ name: 'editFromPartnerId', label: 'از شریک', options: partnerOptions, value: editTransferState.fromPartnerId, required: true, placeholder: 'انتخاب شریک مبدأ', icon: 'user' })}
        ${Select({ name: 'editToPartnerId', label: 'به شریک', options: partnerOptions, value: editTransferState.toPartnerId, required: true, placeholder: 'انتخاب شریک مقصد', icon: 'user' })}
        ${Select({ name: 'editPurpose', label: 'هدف انتقال', options: [{ value: 'project_settlement', label: 'تسویه سهم پروژه‌ها' }, { value: 'expense_settlement', label: 'تسویه هزینه‌ها و بدهی بین شرکا' }], value: editTransferState.purpose || 'project_settlement', required: true, icon: 'arrow-left-right' })}
        ${Input({ name: 'editAmount', type: 'text', label: 'مبلغ', placeholder: 'مبلغ به تومان', value: formatTransactionAmount(editTransferState.amount), required: true, suffix: 'تومان', inputmode: 'numeric' })}
        <p data-edit-transfer-amount-words class="text-[11px] text-fg-muted -mt-1 min-h-4" aria-live="polite"></p>
        <div>
          <label class="text-xs text-fg-muted mb-1.5 block">تاریخ <span class="text-danger">*</span></label>
          <button onclick="window.__openTransferEditDate()" class="w-full h-11 px-4 rounded-xl bg-ink-soft border border-line focus:border-brand outline-none text-sm transition flex items-center justify-between">
            <span>${formatJalali(editTransferState.date)}</span>
            <i data-lucide="calendar" class="w-4 h-4 text-fg-muted"></i>
          </button>
        </div>
        ${Textarea({ name: 'editNote', label: 'توضیحات (اختیاری)', placeholder: 'یادداشت اختیاری...', value: editTransferState.note, rows: 2 })}
      </div>
      <div class="flex gap-2 mt-6">
        <button onclick="window.__closeEditSheet()" class="flex-1 h-11 rounded-xl glass text-sm font-medium hover:bg-white/10 transition">انصراف</button>
        <button onclick="window.__saveTransferEdit()" class="flex-1 h-11 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-brand/30">
          <i data-lucide="check" class="w-4 h-4"></i> ذخیره تغییرات
        </button>
      </div>
    </div>
  `;
}

function attachTransferEditListeners() {
  const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (!sheet) return;
  const fromSelect = sheet.querySelector('[name="editFromPartnerId"]');
  if (fromSelect) fromSelect.addEventListener('change', (e) => { editTransferState.fromPartnerId = e.target.value; });
  const toSelect = sheet.querySelector('[name="editToPartnerId"]');
  if (toSelect) toSelect.addEventListener('change', (e) => { editTransferState.toPartnerId = e.target.value; });
  const amountInput = sheet.querySelector('[name="editAmount"]');
  attachTransactionAmountInput(amountInput, editTransferState, sheet.querySelector('[data-edit-transfer-amount-words]'));
  const purposeSelect = sheet.querySelector('[name="editPurpose"]');
  if (purposeSelect) purposeSelect.addEventListener('change', (e) => { editTransferState.purpose = e.target.value; });
  const noteInput = sheet.querySelector('[name="editNote"]');
  if (noteInput) noteInput.addEventListener('input', (e) => { editTransferState.note = e.target.value; });
}

function openTransferEditDate() {
  openDatePicker({
    value: editTransferState.date,
    onSelect: (iso) => { editTransferState.date = iso; refreshTransferEditSheet(); },
    onClose: () => {}
  });
}

function refreshTransferEditSheet() {
  const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (!sheet) return;
  sheet.innerHTML = `<div class="px-5 pt-5 pb-8 sheet-content">${renderTransferEditForm()}</div>`;
  if (window.lucide) window.lucide.createIcons();
  attachTransferEditListeners();
  window.__saveTransferEdit = saveTransferEdit;
  window.__closeEditSheet = () => closeSheet();
  window.__openTransferEditDate = openTransferEditDate;
}

async function saveTransferEdit() {
  if (!editTransferState) return;
  // Sync from inputs (defensive)
  const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (sheet) {
    const fromSelect = sheet.querySelector('[name="editFromPartnerId"]');
    if (fromSelect) editTransferState.fromPartnerId = fromSelect.value;
    const toSelect = sheet.querySelector('[name="editToPartnerId"]');
    if (toSelect) editTransferState.toPartnerId = toSelect.value;
    const amountInput = sheet.querySelector('[name="editAmount"]');
    if (amountInput) editTransferState.amount = toLatinDigits(amountInput.value).replace(/[^\d]/g, '');
    const noteInput = sheet.querySelector('[name="editNote"]');
    if (noteInput) editTransferState.note = noteInput.value;
  }

  if (!editTransferState.fromPartnerId) { showToast('انتخاب شریک مبدأ الزامی است', 'error'); return; }
  if (!editTransferState.toPartnerId) { showToast('انتخاب شریک مقصد الزامی است', 'error'); return; }
  if (editTransferState.fromPartnerId === editTransferState.toPartnerId) { showToast('شریک مبدأ و مقصد نمی‌توانند یکسان باشند', 'error'); return; }
  const amount = parseIntAmount(editTransferState.amount);
  if (!amount || amount <= 0) { showToast('مبلغ باید عدد صحیح مثبت باشد', 'error'); return; }
  if (!editTransferState.date) { showToast('تاریخ الزامی است', 'error'); return; }

  try {
    const updated = await repo.partnerTransfers.update(editTransferState.id, {
      fromPartnerId: editTransferState.fromPartnerId,
      toPartnerId: editTransferState.toPartnerId,
      amount,
      date: editTransferState.date,
      purpose: editTransferState.purpose || 'project_settlement',
      note: editTransferState.note?.trim() || ''
    });
    state.updateEntity('partnerTransfers', updated);
    showToast('انتقال به‌روزرسانی شد', 'success');
    editTransferState = null;
    closeSheet();
    (transferAfterSave || renderTransactionsPage)();
    transferAfterSave = null;
  } catch (e) {
    console.error('Save transfer edit failed:', e);
    showToast('خطا در به‌روزرسانی انتقال', 'error');
  }
}

// API مشترک برای مدیریت انتقال‌ها از صفحه شرکا
export function openTransferEditor(id, afterSave = renderTransactionsPage) { editTransfer(id, afterSave); }
export function removeTransferRecord(id, afterChange = renderTransactionsPage) { deleteTransfer(id, afterChange); }
