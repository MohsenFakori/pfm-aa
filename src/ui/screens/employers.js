// src/ui/screens/employers.js
// صفحه کارفرماها — فاز 3 PRD

import { repo } from '../../core/repository.js';
import { state } from '../../core/state.js';
import { showToast } from '../components/toast.js';
import { openSheet, closeSheet, confirmDialog } from '../components/sheet.js';
import { Avatar, Input, Select, Textarea, EmptyState } from '../components/ui.js';
import { formatToman, formatTomanShort, parseIntAmount } from '../../utils/number.js';
import { formatJalali, toPersianDigits } from '../../utils/date.js';
import { getEmployerBalance, getEmployerReceipts } from '../../domain/calculations.js';
import { validate, AVATAR_COLORS } from '../../domain/validators.js';

const COLOR_GRADIENTS = {
  brand: 'from-brand to-brand-dark',
  cta: 'from-cta to-cta-dark',
  purple: 'from-purple-500 to-pink-500',
  cyan: 'from-cyan-500 to-blue-500',
  pink: 'from-pink-500 to-rose-500',
  success: 'from-success to-emerald-700',
  warning: 'from-warning to-cta',
  info: 'from-info to-purple-500'
};

let searchTerm = '';
let orderInitialized = false;
let employerFormState = { id: null, color: 'brand' };

export function renderEmployersPage() {
  const allEmployers = (state.data.employers || []).filter(e => !e.deletedAt);

  if (!orderInitialized && allEmployers.length > 0) {
    const existingOrder = state.data.customOrders?.employers || [];
    if (existingOrder.length === 0) {
      const sorted = [...allEmployers].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      state.updateCustomOrder('employers', sorted.map(e => e.id));
    }
    orderInitialized = true;
  }

  const order = state.data.customOrders?.employers || [];
  const sorted = [...allEmployers].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    if (ia === -1 && ib === -1) return new Date(b.createdAt) - new Date(a.createdAt);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const main = document.getElementById('page-content');

  if (allEmployers.length === 0) {
    main.innerHTML = `
      <div class="px-4 pt-6">
        ${EmptyState({ icon: 'briefcase', title: 'هنوز کارفرمایی ثبت نشده', description: 'برای شروع، اولین کارفرمای خود را ثبت کنید.', actionLabel: 'افزودن کارفرما', actionOnClick: 'window.__openEmployerForm()' })}
      </div>
      ${renderFab()}
    `;
    if (window.lucide) window.lucide.createIcons();
    window.__openEmployerForm = () => openEmployerForm();
    return;
  }

  function getFiltered() {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(e => (e.name || '').toLowerCase().includes(q) || (e.phone || '').includes(q));
  }

  function renderListHtml(list) {
    if (list.length === 0) return `<div class="glass rounded-2xl p-6 text-center text-fg-muted text-sm">نتیجه‌ای یافت نشد</div>`;
    return list.map(renderEmployerCard).join('');
  }

  main.innerHTML = `
    <div class="px-4 pt-4 pb-32">
      ${renderSearch('employer-search', 'جستجوی کارفرما...')}
      <div id="employer-list" class="space-y-2.5 mt-4">
        ${renderListHtml(getFiltered())}
      </div>
    </div>
    ${renderFab()}
  `;

  if (window.lucide) window.lucide.createIcons();

  const searchInput = document.getElementById('employer-search');
  if (searchInput) {
    searchInput.value = searchTerm;
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      const listEl = document.getElementById('employer-list');
      if (listEl) {
        listEl.innerHTML = renderListHtml(getFiltered());
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  window.__openEmployerForm = () => openEmployerForm();
  window.__editEmployer = (id) => openEmployerForm(id);
  window.__deleteEmployer = (id) => deleteEmployer(id);
}

function renderEmployerCard(employer) {
  const balance = getEmployerBalance(employer.id, state.data);
  const firstLetter = (employer.name || '').charAt(0);

  let balanceLabel = 'تسویه';
  let balanceColor = 'text-fg-muted';
  let balanceDisplay = formatToman(0);

  if (balance.hasUnknownProjectAmounts) {
    balanceLabel = 'تراز موقت · نیازمند بررسی';
    balanceColor = 'text-warning';
    balanceDisplay = formatToman(Math.abs(balance.balance));
  } else if (balance.balance > 0) {
    balanceLabel = 'بدهکار';
    balanceColor = 'text-danger';
    balanceDisplay = formatToman(balance.balance);
  } else if (balance.balance < 0) {
    balanceLabel = 'بستانکار';
    balanceColor = 'text-success';
    balanceDisplay = formatToman(Math.abs(balance.balance));
  }

  return `
    <div onclick="window.__editEmployer('${employer.id}')"
      class="glass rounded-2xl p-3.5 flex items-center gap-3 hover:bg-white/8 transition active:scale-[0.98]">
      <div class="shrink-0">
        ${Avatar({ text: firstLetter, color: employer.avatarColor || 'brand', size: 'md' })}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold truncate">${employer.name}</p>
        ${employer.phone ? `
          <p class="text-[11px] text-fg-muted flex items-center gap-1 mt-0.5">
            <i data-lucide="phone" class="w-3 h-3"></i>
            ${toPersianDigits(employer.phone)}
          </p>
        ` : ''}
        <div class="flex items-center gap-1.5 mt-1.5">
          <span class="text-[10px] ${balanceColor}">${balanceLabel}</span>
          <span class="text-xs font-bold ${balanceColor} tabular-nums">${balanceDisplay}</span>
        </div>
      </div>
      <i data-lucide="chevron-left" class="w-4 h-4 text-fg-muted shrink-0"></i>
    </div>
  `;
}

function renderSearch(inputId, placeholder) {
  return `
    <div class="relative">
      <i data-lucide="search" class="w-4 h-4 text-fg-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
      <input id="${inputId}" type="text" placeholder="${placeholder}"
        class="w-full h-11 pr-10 pl-4 rounded-xl bg-ink-soft border border-line focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-sm transition" />
    </div>
  `;
}

function renderFab() {
  return `
    <div class="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 pointer-events-none z-30">
      <div class="flex justify-end">
        <button onclick="window.__openEmployerForm()"
          class="pointer-events-auto w-14 h-14 rounded-2xl bg-cta hover:bg-cta-dark text-white shadow-xl shadow-cta/40 flex items-center justify-center transition active:scale-95">
          <i data-lucide="plus" class="w-6 h-6"></i>
        </button>
      </div>
    </div>
  `;
}

function openEmployerForm(id = null) {
  const employer = id ? (state.data.employers || []).find(e => e.id === id) : null;
  employerFormState = { id: id, color: employer?.avatarColor || 'brand' };

  const content = renderEmployerForm(employer);
  openSheet(content, {
    onMount: () => {
      window.__closeEmployerForm = () => closeSheet();
      window.__saveEmployer = saveEmployer;
      window.__deleteEmployer = (eid) => deleteEmployer(eid);
      window.__pickEmployerColor = (color) => {
        employerFormState.color = color;
        refreshEmployerColorPicker();
      };
      window.__allocateCredit = (employerId) => openCreditAllocationForm(employerId);
    }
  });
}

// === فرم تخصیص علی‌الحساب به پروژه ===
function openCreditAllocationForm(employerId) {
  const employer = (state.data.employers || []).find(e => e.id === employerId);
  if (!employer) return;

  const balance = getEmployerBalance(employerId, state.data);
  const credit = balance.totalCredit;
  if (credit <= 0) { showToast('علی‌الحسابی برای تخصیص وجود ندارد', 'info'); return; }

  const employerProjects = (state.data.projects || []).filter(p =>
    p.employerId === employerId && !p.deletedAt && p.status !== 'archived'
  );
  if (employerProjects.length === 0) { showToast('پروژه‌ای برای تخصیص وجود ندارد', 'warning'); return; }

  const projectOptions = employerProjects.map(p => ({ value: p.id, label: p.title }));

  const content = `
    <div class="pb-2">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold">تخصیص علی‌الحساب</h3>
        <button onclick="window.__closeCreditAlloc()" class="w-8 h-8 rounded-lg glass flex items-center justify-center">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <div class="glass rounded-xl p-3 mb-4">
        <div class="flex items-center justify-between">
          <span class="text-xs text-fg-muted">علی‌الحساب قابل تخصیص</span>
          <span class="text-sm font-bold text-purple-300 tabular-nums">${formatToman(credit)}</span>
        </div>
      </div>

      <div class="space-y-3">
        ${Select({ name: 'creditProjectId', label: 'پروژه مقصد', options: projectOptions, required: true, placeholder: 'انتخاب پروژه', icon: 'briefcase' })}
        ${Input({ name: 'creditAmount', type: 'text', label: 'مبلغ تخصیص', placeholder: String(credit), value: String(credit), required: true, suffix: 'تومان', inputmode: 'numeric' })}
        ${Textarea({ name: 'creditNote', label: 'توضیحات (اختیاری)', placeholder: 'یادداشت اختیاری...', rows: 2 })}
      </div>

      <button onclick="window.__saveCreditAlloc('${employerId}')"
        class="w-full h-11 rounded-xl bg-purple hover:bg-purple/90 text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-purple/30 mt-4">
        <i data-lucide="check" class="w-4 h-4"></i> تخصیص به پروژه
      </button>
    </div>
  `;

  // sheet کارفرما را موقتاً مخفی کن
  const employerSheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (employerSheet) employerSheet.style.display = 'none';

  openSheet(content, {
    onMount: () => {
      window.__closeCreditAlloc = () => {
        closeSheet();
        if (employerSheet) employerSheet.style.display = '';
      };
      window.__saveCreditAlloc = async (eid) => {
        await saveCreditAllocation(eid, credit, employerSheet);
      };
    }
  });
}

// === ذخیره تخصیص علی‌الحساب ===
// این تخصص مازاد دریافتی را به یک پروژه اختصاص می‌دهد
// با ایجاد یک ReceiptAllocation روی یکی از receiptهای این کارفرما که surplus دارد
async function saveCreditAllocation(employerId, maxCredit, employerSheet) {
  const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (!sheet) return;

  const projectId = sheet.querySelector('[name="creditProjectId"]')?.value || '';
  const amountStr = sheet.querySelector('[name="creditAmount"]')?.value || '';
  const note = sheet.querySelector('[name="creditNote"]')?.value?.trim() || '';
  const amount = parseIntAmount(amountStr);

  if (!projectId) { showToast('پروژه را انتخاب کنید', 'error'); return; }
  if (!amount || amount <= 0) { showToast('مبلغ نامعتبر است', 'error'); return; }
  if (amount > maxCredit) { showToast(`مبلغ نمی‌تواند بیش از علی‌الحساب (${formatToman(maxCredit)}) باشد`, 'error'); return; }

  try {
    // پیدا کردن receiptهای این کارفرما که surplus دارند (مبلغ دریافتی > مجموع تخصیص‌ها)
    const employerReceipts = (state.data.receipts || []).filter(r =>
      r.employerId === employerId && !r.deletedAt
    );

    let remainingToAllocate = amount;
    const allocationsToCreate = [];

    for (const receipt of employerReceipts) {
      if (remainingToAllocate <= 0) break;

      const existingAllocations = (state.data.receiptAllocations || []).filter(a => {
        if (a.receiptId !== receipt.id) return false;
        const r = (state.data.receipts || []).find(rr => rr.id === a.receiptId);
        return r && !r.deletedAt;
      });
      const allocated = existingAllocations.reduce((s, a) => s + (a.amount || 0), 0);
      const surplus = receipt.amount - allocated;

      if (surplus > 0) {
        const allocAmount = Math.min(surplus, remainingToAllocate);
        allocationsToCreate.push({ receiptId: receipt.id, projectId, amount: allocAmount });
        remainingToAllocate -= allocAmount;
      }
    }

    if (remainingToAllocate > 0) {
      showToast('خطا: علی‌الحساب کافی یافت نشد', 'error');
      return;
    }

    // ایجاد تخصیص‌ها
    for (const alloc of allocationsToCreate) {
      const created = await repo.receiptAllocations.create({
        receiptId: alloc.receiptId,
        projectId: alloc.projectId,
        amount: alloc.amount
      });
      state.updateEntity('receiptAllocations', created);
    }

    showToast(`${formatToman(amount)} به پروژه تخصیص یافت`, 'success');
    closeSheet();
    if (employerSheet) employerSheet.style.display = '';

    // فرم کارفرما را دوباره باز کن تا به‌روز شده نمایش داده شود
    openEmployerForm(employerId);
  } catch (e) {
    console.error('Credit allocation failed:', e);
    showToast('خطا در تخصیص علی‌الحساب', 'error');
  }
}

function renderEmployerForm(employer) {
  const isEdit = !!employer;

  // ریز پرداختی‌ها فقط در حالت ویرایش نمایش داده می‌شود
  let receiptsHtml = '';
  if (isEdit && employer) {
    const receipts = getEmployerReceipts(employer.id, state.data);
    if (receipts.length > 0) {
      receiptsHtml = `
        <div class="mt-4 pt-4 border-t border-line">
          <div class="flex items-center gap-2 mb-3">
            <i data-lucide="receipt" class="w-4 h-4 text-fg-muted"></i>
            <h4 class="text-xs font-bold">ریز پرداختی‌ها (${toPersianDigits(receipts.length)})</h4>
          </div>
          <div class="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
            ${receipts.map(r => `
              <div class="glass rounded-xl p-3">
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-lg bg-success-soft text-success flex items-center justify-center shrink-0">
                      <i data-lucide="arrow-down-left" class="w-3.5 h-3.5"></i>
                    </div>
                    <div>
                      <p class="text-[11px] font-bold">${formatJalali(r.date)}</p>
                      <p class="text-[9px] text-fg-muted">دریافت‌کننده: ${r.receiverName}</p>
                    </div>
                  </div>
                  <p class="text-xs font-bold text-success tabular-nums">${formatTomanShort(r.amount)}</p>
                </div>
                ${r.allocations.length > 0 ? `
                  <div class="mt-2 pt-2 border-t border-white/5 space-y-1">
                    ${r.allocations.map(a => `
                      <div class="flex items-center justify-between text-[10px]">
                        <span class="text-fg-muted truncate">${a.projectName}</span>
                        <span class="tabular-nums font-medium">${formatTomanShort(a.amount)}</span>
                      </div>
                    `).join('')}
                    ${r.surplus > 0 ? `
                      <div class="flex items-center justify-between text-[10px] pt-1 mt-1 border-t border-white/5">
                        <span class="text-purple-300">علی‌الحساب</span>
                        <span class="tabular-nums font-medium text-purple-300">${formatTomanShort(r.surplus)}</span>
                      </div>
                    ` : ''}
                  </div>
                ` : `
                  <div class="mt-2 pt-2 border-t border-white/5">
                    <p class="text-[10px] text-purple-300">کل مبلغ به‌عنوان علی‌الحساب ثبت شده</p>
                  </div>
                `}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  // مدیریت علی‌الحساب — فقط در حالت ویرایش و اگر علی‌الحساب > 0 باشد
  let creditHtml = '';
  if (isEdit && employer) {
    const balance = getEmployerBalance(employer.id, state.data);
    if (balance.totalCredit > 0) {
      // پروژه‌های این کارفرما (فعال یا تکمیل‌شده)
      const employerProjects = (state.data.projects || []).filter(p =>
        p.employerId === employer.id && !p.deletedAt && p.status !== 'archived'
      );
      const projectOptions = employerProjects.map(p => ({ value: p.id, label: p.title }));

      creditHtml = `
        <div class="mt-4 pt-4 border-t border-line">
          <div class="flex items-center gap-2 mb-2">
            <i data-lucide="wallet" class="w-4 h-4 text-purple-300"></i>
            <h4 class="text-xs font-bold">مدیریت علی‌الحساب</h4>
          </div>
          <div class="glass rounded-xl p-3 mb-3">
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-fg-muted">علی‌الحساب کارفرما</span>
              <span class="text-sm font-bold text-purple-300 tabular-nums">${formatToman(balance.totalCredit)}</span>
            </div>
            <p class="text-[10px] text-fg-muted mt-1.5">این مبلغ مازاد دریافتی است که به پروژه‌ای تخصیص نیافته. می‌توانید آن را به یک پروژه تخصیص دهید.</p>
          </div>
          ${projectOptions.length > 0 ? `
            <button onclick="window.__allocateCredit('${employer.id}')"
              class="w-full h-10 rounded-xl bg-purple/20 text-purple-300 text-xs font-medium hover:bg-purple/30 transition flex items-center justify-center gap-2">
              <i data-lucide="arrow-right-left" class="w-3.5 h-3.5"></i>
              تخصیص علی‌الحساب به پروژه
            </button>
          ` : `
            <p class="text-[10px] text-warning text-center py-2">پروژه‌ای برای تخصیص وجود ندارد</p>
          `}
        </div>
      `;
    }
  }

  return `
    <div class="pb-2">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold">${isEdit ? 'ویرایش کارفرما' : 'کارفرمای جدید'}</h3>
        <button onclick="window.__closeEmployerForm()" class="w-8 h-8 rounded-lg glass flex items-center justify-center">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <div class="space-y-3">
        ${Input({ name: 'name', label: 'نام', placeholder: 'نام کارفرما', value: employer?.name || '', required: true, icon: 'user' })}
        ${Input({ name: 'phone', label: 'شماره تماس', placeholder: '۰۹۱۲...', value: employer?.phone || '', icon: 'phone', inputmode: 'tel' })}
        ${Textarea({ name: 'note', label: 'یادداشت', placeholder: 'یادداشت اختیاری...', value: employer?.note || '', rows: 2 })}

        <div>
          <label class="text-xs text-fg-muted mb-1.5 block">رنگ آواتار</label>
          <div class="flex flex-wrap gap-2" id="employer-color-picker">
            ${renderColorPickerButtons(employerFormState.color, '__pickEmployerColor')}
          </div>
        </div>
      </div>

      ${receiptsHtml}
      ${creditHtml}

      <div class="flex gap-2 mt-6">
        ${isEdit ? `
          <button onclick="window.__deleteEmployer('${employer.id}')"
            class="h-11 px-4 rounded-xl glass text-danger text-sm font-medium hover:bg-danger/10 transition flex items-center gap-2">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        ` : ''}
        <button onclick="window.__saveEmployer()"
          class="flex-1 h-11 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-brand/30">
          <i data-lucide="check" class="w-4 h-4"></i>
          ${isEdit ? 'ذخیره تغییرات' : 'ثبت کارفرما'}
        </button>
      </div>
    </div>
  `;
}

function renderColorPickerButtons(selected, callback) {
  return AVATAR_COLORS.map(color => `
    <button type="button" onclick="${callback}('${color}')"
      class="w-10 h-10 rounded-full bg-gradient-to-br ${COLOR_GRADIENTS[color]} flex items-center justify-center transition ${selected === color ? 'ring-2 ring-white ring-offset-2 ring-offset-ink-soft' : ''}">
      ${selected === color ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
    </button>
  `).join('');
}

function refreshEmployerColorPicker() {
  const picker = document.getElementById('employer-color-picker');
  if (picker) {
    picker.innerHTML = renderColorPickerButtons(employerFormState.color, '__pickEmployerColor');
    if (window.lucide) window.lucide.createIcons();
  }
}

async function saveEmployer() {
  const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (!sheet) return;

  const name = sheet.querySelector('[name="name"]')?.value?.trim() || '';
  const phone = sheet.querySelector('[name="phone"]')?.value?.trim() || '';
  const note = sheet.querySelector('[name="note"]')?.value?.trim() || '';
  const avatarColor = employerFormState.color;

  const data = { name, phone, note, avatarColor };
  const result = validate('employer', data);
  if (!result.valid) {
    if (result.errors.name) { showToast('نام کارفرما الزامی است (حداقل ۲ کاراکتر)', 'error'); return; }
    if (result.errors.phone) { showToast('شماره تماس نامعتبر است', 'error'); return; }
    showToast('اطلاعات نامعتبر است', 'error');
    return;
  }

  try {
    if (employerFormState.id) {
      const updated = await repo.employers.update(employerFormState.id, data);
      state.updateEntity('employers', updated);
      showToast('کارفرما به‌روزرسانی شد', 'success');
    } else {
      const created = await repo.employers.create(data);
      state.updateEntity('employers', created);
      const order = state.data.customOrders?.employers || [];
      state.updateCustomOrder('employers', [created.id, ...order]);
      showToast('کارفرما ایجاد شد', 'success');
    }
    closeSheet();
    renderEmployersPage();
  } catch (e) {
    console.error('Save employer failed:', e);
    showToast('خطا در ذخیره کارفرما', 'error');
  }
}

function deleteEmployer(id) {
  const employer = (state.data.employers || []).find(e => e.id === id);
  if (!employer) return;

  confirmDialog({
    title: 'حذف کارفرما',
    message: `آیا از حذف «${employer.name}» مطمئن هستید؟ این عمل قابل بازگشت نیست.`,
    confirmText: 'حذف',
    danger: true,
    onConfirm: async () => {
      try {
        await repo.employers.delete(id);
        state.removeEntity('employers', id);
        const order = state.data.customOrders?.employers || [];
        state.updateCustomOrder('employers', order.filter(i => i !== id));
        showToast('کارفرما حذف شد', 'success');
        renderEmployersPage();
      } catch (e) {
        console.error('Delete employer failed:', e);
        showToast('خطا در حذف کارفرما', 'error');
      }
    }
  });
}
