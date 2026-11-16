// src/ui/screens/expenses.js
// ثبت هزینه و انتقال بین شرکا — فاز 6 PRD
// هزینه‌ها مستقل از پروژه هستند — فقط بین شرکا تقسیم می‌شوند

import { repo } from '../../core/repository.js';
import { state } from '../../core/state.js';
import { navigate } from '../../core/router.js';
import { showToast } from '../components/toast.js';
import { openDatePicker } from '../components/datepicker.js';
import { Input, Select, Textarea } from '../components/ui.js';
import { formatToman, formatTomanShort, parseIntAmount } from '../../utils/number.js';
import { formatJalali, toPersianDigits, today } from '../../utils/date.js';

const COLOR_GRADIENTS = {
  brand: 'from-brand to-brand-dark', cta: 'from-cta to-cta-dark',
  purple: 'from-purple-500 to-pink-500', cyan: 'from-cyan-500 to-blue-500',
  pink: 'from-pink-500 to-rose-500', success: 'from-success to-emerald-700',
  warning: 'from-warning to-cta', info: 'from-info to-purple-500'
};

let expenseFormState = null;
let transferFormState = null;
let expenseAmountWordsTimer = null;

function toLatinDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, digit => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))
    .replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit));
}

function formatAmountInput(value) {
  const digits = toLatinDigits(value).replace(/[^\d]/g, '');
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
    } else if (n >= 10) parts.push(teens[n - 10]);
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

function defaultExpenseFormState() {
  return { title: '', amount: '', paidByPartnerId: '', date: today(), note: '', shares: {} };
}

function defaultTransferFormState() {
  return { fromPartnerId: '', toPartnerId: '', amount: '', date: today(), note: '' };
}

// =========== SHARE DISTRIBUTION (exported for reuse in edit form) ===========
// formState.shares: { partnerId: { type: 'percent'|'amount', value: number } }

export function computeShareAmounts(formState, expenseAmount) {
  const result = [];
  if (!formState || !formState.shares) return result;
  for (const [pid, share] of Object.entries(formState.shares)) {
    if (!share || !share.value) continue;
    let amount;
    if (share.type === 'percent') {
      amount = Math.round(expenseAmount * share.value / 100);
    } else {
      amount = share.value;
    }
    if (amount > 0) result.push({ partnerId: pid, amount });
  }
  return result;
}

export function renderShareDistributionHtml(formState, partners) {
  const amount = parseIntAmount(formState.amount);
  const shares = formState.shares || {};

  let total = 0;
  for (const p of partners) {
    const share = shares[p.id];
    if (!share || !share.value) continue;
    if (share.type === 'percent') total += Math.round(amount * share.value / 100);
    else total += share.value;
  }
  const isValid = amount > 0 && total === amount;

  return `
    <div class="glass rounded-2xl p-4" id="share-distribution">
      <div class="flex items-center justify-between mb-3">
        <p class="text-xs font-bold flex items-center gap-1.5">
          <i data-lucide="users" class="w-3.5 h-3.5"></i>
          توزیع سهم بین شرکا
        </p>
        <button type="button" onclick="window.__splitEqual()" class="text-[11px] text-brand font-medium hover:underline">تقسیم مساوی</button>
      </div>
      ${amount === 0 ? `
        <p class="text-[11px] text-fg-muted text-center py-2">ابتدا مبلغ هزینه را وارد کنید</p>
      ` : partners.length === 0 ? `
        <p class="text-[11px] text-fg-muted text-center py-2">شریکی ثبت نشده</p>
      ` : `
        <div class="space-y-1.5">
          ${partners.map(p => {
            const share = shares[p.id] || { type: 'percent', value: 0 };
            const isPercent = share.type !== 'amount';
            const displayValue = share.value ? toPersianDigits(String(share.value)) : '';
            const computedAmount = isPercent ? Math.round(amount * share.value / 100) : share.value;
            return `
              <div class="flex items-center gap-2 p-2 rounded-xl bg-white/5" data-share-row="${p.id}">
                <div class="w-7 h-7 rounded-full bg-gradient-to-br ${COLOR_GRADIENTS[p.avatarColor || 'brand']} flex items-center justify-center text-white font-bold text-xs shrink-0">${(p.name || '').charAt(0)}</div>
                <p class="flex-1 text-xs font-medium truncate min-w-0">${p.name}</p>
                <div class="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 shrink-0">
                  <button type="button" onclick="window.__setShareType('${p.id}', 'percent')" class="px-2 py-1 rounded text-[10px] font-medium transition ${isPercent ? 'bg-brand text-white' : 'text-fg-muted'}">٪</button>
                  <button type="button" onclick="window.__setShareType('${p.id}', 'amount')" class="px-2 py-1 rounded text-[10px] font-medium transition ${!isPercent ? 'bg-brand text-white' : 'text-fg-muted'}">ت</button>
                </div>
                <input type="text" inputmode="numeric" data-share-input="${p.id}" value="${displayValue}" placeholder="۰" class="w-16 h-8 px-2 rounded-lg bg-ink-soft border border-line focus:border-brand outline-none text-xs text-center tabular-nums shrink-0" />
                <span class="text-[10px] text-fg-muted tabular-nums shrink-0 w-14 text-left" data-share-computed="${p.id}">${computedAmount > 0 ? formatTomanShort(computedAmount) : '—'}</span>
              </div>
            `;
          }).join('')}
        </div>
        <div class="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs" data-share-summary>
          <span class="text-fg-muted">مجموع سهم‌ها</span>
          <span class="font-bold tabular-nums ${isValid ? 'text-success' : 'text-danger'}">
            <span data-share-total>${formatToman(total)}</span> / <span data-share-target>${formatToman(amount)}</span>
          </span>
        </div>
      `}
    </div>
  `;
}

// Update only the summary and computed amounts (without re-rendering inputs, to preserve focus)
export function refreshShareSummary(formState, partners) {
  const amount = parseIntAmount(formState.amount);
  const shares = formState.shares || {};
  let total = 0;
  for (const p of partners) {
    const share = shares[p.id];
    if (!share || !share.value) continue;
    if (share.type === 'percent') total += Math.round(amount * share.value / 100);
    else total += share.value;
  }
  const isValid = amount > 0 && total === amount;
  const summaryEl = document.querySelector('[data-share-summary]');
  if (summaryEl) {
    const totalEl = summaryEl.querySelector('[data-share-total]');
    const wrapper = totalEl?.parentElement;
    if (totalEl) totalEl.textContent = formatToman(total);
    if (wrapper) wrapper.className = `font-bold tabular-nums ${isValid ? 'text-success' : 'text-danger'}`;
  }
  for (const p of partners) {
    const share = shares[p.id];
    if (!share) continue;
    const computedAmount = share.type === 'percent' ? Math.round(amount * share.value / 100) : share.value;
    const el = document.querySelector(`[data-share-computed="${p.id}"]`);
    if (el) el.textContent = computedAmount > 0 ? formatTomanShort(computedAmount) : '—';
  }
}

// Attaches input listeners + registers window.__setShareType and window.__splitEqual
export function attachShareHandlers(formState, partners, refreshFn, container) {
  const root = container || document;

  window.__setShareType = (pid, type) => {
    if (!formState.shares) formState.shares = {};
    if (!formState.shares[pid]) formState.shares[pid] = { type: 'percent', value: 0 };
    formState.shares[pid].type = type;
    refreshFn();
  };

  window.__splitEqual = () => {
    const amount = parseIntAmount(formState.amount);
    if (amount <= 0) { showToast('ابتدا مبلغ را وارد کنید', 'warning'); return; }
    if (partners.length === 0) { showToast('شریکی ثبت نشده', 'warning'); return; }
    const perPartner = Math.floor(amount / partners.length);
    const remainder = amount - perPartner * partners.length;
    if (!formState.shares) formState.shares = {};
    partners.forEach((p, i) => {
      formState.shares[p.id] = { type: 'amount', value: perPartner + (i < remainder ? 1 : 0) };
    });
    refreshFn();
  };

  const inputs = root.querySelectorAll('[data-share-input]');
  inputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const pid = e.target.dataset.shareInput;
      const val = parseIntAmount(e.target.value);
      if (!formState.shares) formState.shares = {};
      if (!formState.shares[pid]) formState.shares[pid] = { type: 'percent', value: 0 };
      formState.shares[pid].value = val;
      refreshShareSummary(formState, partners);
    });
  });
}

// =========== ADD EXPENSE PAGE ===========
export function renderAddExpensePage() {
  if (!expenseFormState) expenseFormState = defaultExpenseFormState();
  const main = document.getElementById('page-content');
  main.innerHTML = `
    <div class="px-4 pt-4 pb-32">
      <div class="flex items-center gap-3 mb-4">
        <button onclick="window.__navigate('/transactions')" class="w-9 h-9 rounded-lg glass flex items-center justify-center">
          <i data-lucide="chevron-right" class="w-5 h-5"></i>
        </button>
        <h2 class="text-base font-bold">ثبت هزینه</h2>
      </div>
      <div id="expense-form-content">${renderExpenseForm()}</div>
      <div class="flex gap-2 mt-6">
        <button onclick="window.__navigate('/transactions')" class="flex-1 h-11 rounded-xl glass text-sm font-medium hover:bg-white/10 transition">انصراف</button>
        <button onclick="window.__saveExpense()" class="flex-1 h-11 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-cta/30">
          <i data-lucide="check" class="w-4 h-4"></i> ثبت هزینه
        </button>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  attachExpenseFormListeners();
  const amountInput = main.querySelector('[name="amount"]');
  if (amountInput) amountInput.focus();
  window.__navigate = (path) => navigate(path);
  window.__saveExpense = saveExpense;
  window.__openExpenseDate = openExpenseDate;
}

function renderExpenseForm() {
  const partners = (state.data.partners || []).filter(p => !p.deletedAt);
  const partnerOptions = partners.map(p => ({ value: p.id, label: p.name }));

  const partnerWarning = partners.length === 0 ? `
    <div class="rounded-xl bg-warning-soft p-3 text-xs text-warning flex items-center gap-2">
      <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i>
      <span class="flex-1">ابتدا یک شریک ثبت کنید.</span>
      <button onclick="window.__navigate('/partners')" class="text-brand font-medium underline shrink-0">رفتن</button>
    </div>
  ` : '';

  return `
    <div class="space-y-3">
      ${partnerWarning}
      ${Input({ name: 'title', label: 'عنوان هزینه', placeholder: 'مثلاً: خرید سرور', value: expenseFormState.title, required: true, icon: 'receipt' })}
      ${Input({ name: 'amount', type: 'text', label: 'مبلغ', placeholder: 'مبلغ به تومان', value: formatAmountInput(expenseFormState.amount), required: true, suffix: 'تومان', inputmode: 'numeric' })}
      <p data-expense-amount-words class="text-[11px] text-fg-muted -mt-1 min-h-4" aria-live="polite"></p>
      <div>
        <label class="text-xs text-fg-muted mb-1.5 block">تاریخ <span class="text-danger">*</span></label>
        <button onclick="window.__openExpenseDate()" class="w-full h-11 px-4 rounded-xl bg-ink-soft border border-line focus:border-brand outline-none text-sm transition flex items-center justify-between">
          <span>${formatJalali(expenseFormState.date)}</span>
          <i data-lucide="calendar" class="w-4 h-4 text-fg-muted"></i>
        </button>
      </div>
      ${Select({ name: 'paidByPartnerId', label: 'پرداخت‌کننده', options: partnerOptions, value: expenseFormState.paidByPartnerId, required: true, placeholder: 'کی پرداخت کرده؟', icon: 'user' })}
      ${renderShareDistributionHtml(expenseFormState, partners)}
      ${Textarea({ name: 'note', label: 'توضیحات (اختیاری)', placeholder: 'یادداشت اختیاری...', value: expenseFormState.note, rows: 2 })}
    </div>
  `;
}

function attachExpenseFormListeners() {
  const main = document.getElementById('page-content');
  if (!main) return;
  const titleInput = main.querySelector('[name="title"]');
  if (titleInput) titleInput.addEventListener('input', (e) => { expenseFormState.title = e.target.value; });
  const amountInput = main.querySelector('[name="amount"]');
  const amountWords = main.querySelector('[data-expense-amount-words]');
  const updateAmountWords = () => {
    if (!amountWords) return;
    const amount = parseIntAmount(expenseFormState.amount);
    amountWords.textContent = amount > 0 ? amountToPersianWords(amount) + ' تومان' : '';
  };

  if (amountInput) {
    expenseFormState.amount = toLatinDigits(expenseFormState.amount).replace(/[^\d]/g, '');
    amountInput.value = formatAmountInput(expenseFormState.amount);
    updateAmountWords();
    amountInput.addEventListener('input', (e) => {
      const input = e.target;
      const cursor = input.selectionStart ?? input.value.length;
      const digitsBeforeCursor = toLatinDigits(input.value.slice(0, cursor)).replace(/[^\d]/g, '').length;
      const rawValue = toLatinDigits(input.value).replace(/[^\d]/g, '');
      expenseFormState.amount = rawValue;
      input.value = formatAmountInput(rawValue);

      let nextCursor = 0;
      let seenDigits = 0;
      while (nextCursor < input.value.length && seenDigits < digitsBeforeCursor) {
        if (/\d/.test(input.value[nextCursor])) seenDigits++;
        nextCursor++;
      }
      input.setSelectionRange(nextCursor, nextCursor);

      clearTimeout(expenseAmountWordsTimer);
      if (amountWords) amountWords.textContent = rawValue ? 'در حال تبدیل مبلغ…' : '';
      expenseAmountWordsTimer = setTimeout(updateAmountWords, 650);

      const partners = (state.data.partners || []).filter(p => !p.deletedAt);
      refreshShareSummary(expenseFormState, partners);
    });
  }
  const paidBySelect = main.querySelector('[name="paidByPartnerId"]');
  if (paidBySelect) paidBySelect.addEventListener('change', (e) => {
    expenseFormState.paidByPartnerId = e.target.value;
    // Auto-default to 100% for the paying partner if no shares set yet
    if (e.target.value && (!expenseFormState.shares || Object.keys(expenseFormState.shares).filter(k => expenseFormState.shares[k] && expenseFormState.shares[k].value > 0).length === 0)) {
      expenseFormState.shares = { [e.target.value]: { type: 'percent', value: 100 } };
      refreshExpenseForm();
    }
  });
  const noteInput = main.querySelector('[name="note"]');
  if (noteInput) noteInput.addEventListener('input', (e) => { expenseFormState.note = e.target.value; });

  // Share distribution handlers
  const partners = (state.data.partners || []).filter(p => !p.deletedAt);
  attachShareHandlers(expenseFormState, partners, refreshExpenseForm, main);
}

function refreshExpenseForm() {
  const contentEl = document.getElementById('expense-form-content');
  if (contentEl) {
    contentEl.innerHTML = renderExpenseForm();
    if (window.lucide) window.lucide.createIcons();
    attachExpenseFormListeners();
  }
}

function openExpenseDate() {
  openDatePicker({ value: expenseFormState.date, onSelect: (iso) => { expenseFormState.date = iso; refreshExpenseForm(); }, onClose: () => {} });
}

async function saveExpense() {
  if (!expenseFormState.title || expenseFormState.title.trim().length < 2) { showToast('عنوان هزینه حداقل ۲ کاراکتر باید باشد', 'error'); return; }
  const amount = parseIntAmount(expenseFormState.amount);
  if (!amount || amount <= 0) { showToast('مبلغ باید عدد صحیح مثبت باشد', 'error'); return; }
  if (!expenseFormState.paidByPartnerId) { showToast('انتخاب پرداخت‌کننده الزامی است', 'error'); return; }
  if (!expenseFormState.date) { showToast('تاریخ الزامی است', 'error'); return; }

  // Compute and validate share distribution
  const shareDistribution = computeShareAmounts(expenseFormState, amount);
  const hasShares = Object.values(expenseFormState.shares || {}).some(s => s && s.value > 0);
  if (hasShares) {
    const total = shareDistribution.reduce((s, x) => s + x.amount, 0);
    if (total !== amount) {
      showToast(`مجموع سهم‌ها (${formatToman(total)}) با مبلغ هزینه (${formatToman(amount)}) برابر نیست`, 'error');
      return;
    }
  }

  try {
    const expenseData = {
      title: expenseFormState.title.trim(),
      amount,
      paidByPartnerId: expenseFormState.paidByPartnerId,
      date: expenseFormState.date,
      note: expenseFormState.note?.trim() || '',
      shareDistribution: hasShares ? shareDistribution : []
    };
    const expense = await repo.expenses.create(expenseData);
    state.updateEntity('expenses', expense);
    showToast('هزینه با موفقیت ثبت شد', 'success');
    expenseFormState = null;
    navigate('/transactions');
  } catch (e) {
    console.error('Save expense failed:', e);
    showToast('خطا در ثبت هزینه', 'error');
  }
}

// =========== ADD TRANSFER PAGE ===========
export function renderAddTransferPage() {
  if (!transferFormState) transferFormState = defaultTransferFormState();
  const main = document.getElementById('page-content');
  main.innerHTML = `
    <div class="px-4 pt-4 pb-32">
      <div class="flex items-center gap-3 mb-4">
        <button onclick="window.__navigate('/transactions')" class="w-9 h-9 rounded-lg glass flex items-center justify-center">
          <i data-lucide="chevron-right" class="w-5 h-5"></i>
        </button>
        <h2 class="text-base font-bold">انتقال بین شرکا</h2>
      </div>
      <div id="transfer-form-content">${renderTransferForm()}</div>
      <div class="flex gap-2 mt-6">
        <button onclick="window.__navigate('/transactions')" class="flex-1 h-11 rounded-xl glass text-sm font-medium hover:bg-white/10 transition">انصراف</button>
        <button onclick="window.__saveTransfer()" class="flex-1 h-11 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-cta/30">
          <i data-lucide="check" class="w-4 h-4"></i> ثبت انتقال
        </button>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  attachTransferFormListeners();
  window.__navigate = (path) => navigate(path);
  window.__saveTransfer = saveTransfer;
  window.__openTransferDate = openTransferDate;
}

function renderTransferForm() {
  const partners = (state.data.partners || []).filter(p => !p.deletedAt);
  const projects = (state.data.projects || []).filter(p => !p.deletedAt && p.status === 'active');
  const partnerOptions = partners.map(p => ({ value: p.id, label: p.name }));
  const projectOptions = projects.map(p => ({ value: p.id, label: p.title }));

  const partnerWarning = partners.length === 0 ? `
    <div class="rounded-xl bg-warning-soft p-3 text-xs text-warning flex items-center gap-2">
      <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i>
      <span class="flex-1">ابتدا حداقل دو شریک ثبت کنید.</span>
      <button onclick="window.__navigate('/partners')" class="text-brand font-medium underline shrink-0">رفتن</button>
    </div>
  ` : '';

  const fromPartner = partners.find(p => p.id === transferFormState.fromPartnerId);
  const toPartner = partners.find(p => p.id === transferFormState.toPartnerId);

  const visualHtml = (fromPartner || toPartner) ? `
    <div class="glass-strong rounded-2xl p-4 flex items-center justify-center gap-4">
      <div class="flex flex-col items-center gap-1.5">
        ${fromPartner ? `
          <div class="w-12 h-12 rounded-full bg-gradient-to-br ${COLOR_GRADIENTS[fromPartner.avatarColor || 'brand']} flex items-center justify-center text-white font-bold">${(fromPartner.name || '').charAt(0)}</div>
          <p class="text-[10px] text-fg-muted truncate max-w-[80px]">${fromPartner.name}</p>
        ` : `
          <div class="w-12 h-12 rounded-full glass flex items-center justify-center"><i data-lucide="user" class="w-5 h-5 text-fg-muted"></i></div>
          <p class="text-[10px] text-fg-muted">مبدأ</p>
        `}
      </div>
      <div class="text-fg-muted"><i data-lucide="arrow-right-left" class="w-5 h-5"></i></div>
      <div class="flex flex-col items-center gap-1.5">
        ${toPartner ? `
          <div class="w-12 h-12 rounded-full bg-gradient-to-br ${COLOR_GRADIENTS[toPartner.avatarColor || 'cta']} flex items-center justify-center text-white font-bold">${(toPartner.name || '').charAt(0)}</div>
          <p class="text-[10px] text-fg-muted truncate max-w-[80px]">${toPartner.name}</p>
        ` : `
          <div class="w-12 h-12 rounded-full glass flex items-center justify-center"><i data-lucide="user" class="w-5 h-5 text-fg-muted"></i></div>
          <p class="text-[10px] text-fg-muted">مقصد</p>
        `}
      </div>
    </div>
  ` : '';

  return `
    <div class="space-y-3">
      ${partnerWarning}
      ${visualHtml}
      ${Select({ name: 'fromPartnerId', label: 'از شریک', options: partnerOptions, value: transferFormState.fromPartnerId, required: true, placeholder: 'انتخاب شریک مبدأ', icon: 'user' })}
      ${Select({ name: 'toPartnerId', label: 'به شریک', options: partnerOptions, value: transferFormState.toPartnerId, required: true, placeholder: 'انتخاب شریک مقصد', icon: 'user' })}
      ${Input({ name: 'amount', type: 'text', label: 'مبلغ', placeholder: 'مبلغ به تومان', value: formatAmountInput(transferFormState.amount), required: true, suffix: 'تومان', inputmode: 'numeric' })}
      <p data-transfer-amount-words class="text-[11px] text-fg-muted -mt-1 min-h-4" aria-live="polite"></p>
      <div>
        <label class="text-xs text-fg-muted mb-1.5 block">تاریخ <span class="text-danger">*</span></label>
        <button onclick="window.__openTransferDate()" class="w-full h-11 px-4 rounded-xl bg-ink-soft border border-line focus:border-brand outline-none text-sm transition flex items-center justify-between">
          <span>${formatJalali(transferFormState.date)}</span>
          <i data-lucide="calendar" class="w-4 h-4 text-fg-muted"></i>
        </button>
      </div>
      ${Textarea({ name: 'note', label: 'توضیحات (اختیاری)', placeholder: 'یادداشت اختیاری...', value: transferFormState.note, rows: 2 })}
    </div>
  `;
}

function attachTransferFormListeners() {
  const main = document.getElementById('page-content');
  if (!main) return;
  const fromSelect = main.querySelector('[name="fromPartnerId"]');
  if (fromSelect) fromSelect.addEventListener('change', (e) => { transferFormState.fromPartnerId = e.target.value; refreshTransferForm(); });
  const toSelect = main.querySelector('[name="toPartnerId"]');
  if (toSelect) toSelect.addEventListener('change', (e) => { transferFormState.toPartnerId = e.target.value; refreshTransferForm(); });
  const amountInput = main.querySelector('[name="amount"]');
  const amountWords = main.querySelector('[data-transfer-amount-words]');
  const updateAmountWords = () => {
    const amount = parseIntAmount(transferFormState.amount);
    if (amountWords) amountWords.textContent = amount > 0 ? amountToPersianWords(amount) + ' تومان' : '';
  };
  if (amountInput) {
    transferFormState.amount = toLatinDigits(transferFormState.amount).replace(/[^\d]/g, '');
    amountInput.value = formatAmountInput(transferFormState.amount);
    updateAmountWords();
    amountInput.addEventListener('input', (e) => {
      const input = e.target;
      const cursor = input.selectionStart ?? input.value.length;
      const digitsBeforeCursor = toLatinDigits(input.value.slice(0, cursor)).replace(/[^\d]/g, '').length;
      const rawValue = toLatinDigits(input.value).replace(/[^\d]/g, '');
      transferFormState.amount = rawValue;
      input.value = formatAmountInput(rawValue);
      let nextCursor = 0;
      let seenDigits = 0;
      while (nextCursor < input.value.length && seenDigits < digitsBeforeCursor) {
        if (/\d/.test(input.value[nextCursor])) seenDigits++;
        nextCursor++;
      }
      input.setSelectionRange(nextCursor, nextCursor);
      clearTimeout(expenseAmountWordsTimer);
      if (amountWords) amountWords.textContent = rawValue ? 'در حال تبدیل مبلغ…' : '';
      expenseAmountWordsTimer = setTimeout(updateAmountWords, 650);
    });
  }
  const noteInput = main.querySelector('[name="note"]');
  if (noteInput) noteInput.addEventListener('input', (e) => { transferFormState.note = e.target.value; });
}

function refreshTransferForm() {
  const contentEl = document.getElementById('transfer-form-content');
  if (contentEl) {
    contentEl.innerHTML = renderTransferForm();
    if (window.lucide) window.lucide.createIcons();
    attachTransferFormListeners();
  }
}

function openTransferDate() {
  openDatePicker({ value: transferFormState.date, onSelect: (iso) => { transferFormState.date = iso; refreshTransferForm(); }, onClose: () => {} });
}

async function saveTransfer() {
  if (!transferFormState.fromPartnerId) { showToast('انتخاب شریک مبدأ الزامی است', 'error'); return; }
  if (!transferFormState.toPartnerId) { showToast('انتخاب شریک مقصد الزامی است', 'error'); return; }
  if (transferFormState.fromPartnerId === transferFormState.toPartnerId) { showToast('شریک مبدأ و مقصد نمی‌توانند یکسان باشند', 'error'); return; }
  const amount = parseIntAmount(transferFormState.amount);
  if (!amount || amount <= 0) { showToast('مبلغ باید عدد صحیح مثبت باشد', 'error'); return; }
  if (!transferFormState.date) { showToast('تاریخ الزامی است', 'error'); return; }

  try {
    const transferData = {
      fromPartnerId: transferFormState.fromPartnerId,
      toPartnerId: transferFormState.toPartnerId,
      amount,
      date: transferFormState.date,
      note: transferFormState.note?.trim() || ''
    };
    const transfer = await repo.partnerTransfers.create(transferData);
    state.updateEntity('partnerTransfers', transfer);
    showToast('انتقال با موفقیت ثبت شد', 'success');
    transferFormState = null;
    navigate('/transactions');
  } catch (e) {
    console.error('Save transfer failed:', e);
    showToast('خطا در ثبت انتقال', 'error');
  }
}
