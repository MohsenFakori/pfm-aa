// src/ui/screens/partners.js
// صفحه شرکا — فاز 3 PRD

import { repo } from '../../core/repository.js';
import { state } from '../../core/state.js';
import { showToast } from '../components/toast.js';
import { openSheet, closeSheet, confirmDialog } from '../components/sheet.js';
import { Avatar, Input, Textarea, EmptyState, Badge } from '../components/ui.js';
import { formatToman, formatTomanShort } from '../../utils/number.js';
import { formatJalali, toPersianDigits, today } from '../../utils/date.js';
import { getPartnerBalance } from '../../domain/calculations.js';
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
let partnerFormState = { id: null, color: 'brand' };
let partnerTab = 'summary'; // summary | transactions
let txFilterPartner = ''; // فیلتر بر اساس شریک
let txFilterType = 'all'; // all | expenses | transfers

export function renderPartnersPage() {
  const allPartners = (state.data.partners || []).filter(p => !p.deletedAt);

  if (!orderInitialized && allPartners.length > 0) {
    const existingOrder = state.data.customOrders?.partners || [];
    if (existingOrder.length === 0) {
      const sorted = [...allPartners].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      state.updateCustomOrder('partners', sorted.map(p => p.id));
    }
    orderInitialized = true;
  }

  const main = document.getElementById('page-content');

  if (allPartners.length === 0) {
    main.innerHTML = `
      <div class="px-4 pt-6">
        ${EmptyState({ icon: 'users', title: 'هنوز شریکی ثبت نشده', description: 'برای شروع، اولین شریک خود را ثبت کنید.', actionLabel: 'افزودن شریک', actionOnClick: 'window.__openPartnerForm()' })}
      </div>
      ${renderFab()}
    `;
    if (window.lucide) window.lucide.createIcons();
    window.__openPartnerForm = () => openPartnerForm();
    return;
  }

  // تب‌ها: خلاصه | تراکنش‌ها
  const tabsHtml = `
    <div class="flex rounded-xl glass p-1 mb-3">
      <button onclick="window.__setPartnerTab('summary')" class="flex-1 h-9 rounded-lg text-xs font-medium transition ${partnerTab === 'summary' ? 'tab-active' : 'text-fg-muted hover:bg-white/5'}">خلاصه شرکا</button>
      <button onclick="window.__setPartnerTab('transactions')" class="flex-1 h-9 rounded-lg text-xs font-medium transition ${partnerTab === 'transactions' ? 'tab-active' : 'text-fg-muted hover:bg-white/5'}">انتقال‌ها و هزینه‌ها</button>
    </div>
  `;

  let contentHtml = '';
  if (partnerTab === 'summary') {
    contentHtml = renderSummaryTab(allPartners);
  } else {
    contentHtml = renderTransactionsTab(allPartners);
  }

  main.innerHTML = `
    <div class="px-4 pt-4 pb-32">
      ${tabsHtml}
      ${contentHtml}
    </div>
    ${renderFab()}
  `;

  if (window.lucide) window.lucide.createIcons();

  // listener جستجوی خلاصه
  if (partnerTab === 'summary') {
    const searchInput = document.getElementById('partner-search');
    if (searchInput) {
      searchInput.value = searchTerm;
      searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        const listEl = document.getElementById('partner-list');
        if (listEl) {
          const filtered = getFilteredPartners(allPartners);
          listEl.innerHTML = filtered.length === 0
            ? `<div class="glass rounded-2xl p-6 text-center text-fg-muted text-sm">نتیجه‌ای یافت نشد</div>`
            : filtered.map(renderPartnerCard).join('');
          if (window.lucide) window.lucide.createIcons();
        }
      });
    }
  }

  window.__openPartnerForm = () => openPartnerForm();
  window.__editPartner = (id) => openPartnerForm(id);
  window.__deletePartner = (id) => deletePartner(id);
  window.__setPartnerTab = (tab) => { partnerTab = tab; renderPartnersPage(); };
  window.__setTxFilterPartner = (pid) => { txFilterPartner = pid; renderPartnersPage(); };
  window.__setTxFilterType = (type) => { txFilterType = type; renderPartnersPage(); };
}

function getFilteredPartners(allPartners) {
  const order = state.data.customOrders?.partners || [];
  const sorted = [...allPartners].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    if (ia === -1 && ib === -1) return new Date(b.createdAt) - new Date(a.createdAt);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  const q = searchTerm.trim().toLowerCase();
  if (!q) return sorted;
  return sorted.filter(p => (p.name || '').toLowerCase().includes(q) || (p.phone || '').includes(q) || (p.email || '').toLowerCase().includes(q));
}

function renderSummaryTab(allPartners) {
  const filtered = getFilteredPartners(allPartners);
  return `
    ${renderSearch('partner-search', 'جستجوی شریک...')}
    ${renderAutoSettleButton(allPartners)}
    <div id="partner-list" class="space-y-2.5 mt-4">
      ${filtered.length === 0 ? `<div class="glass rounded-2xl p-6 text-center text-fg-muted text-sm">نتیجه‌ای یافت نشد</div>` : filtered.map(renderPartnerCard).join('')}
    </div>
  `;
}

// === تسویه خودکار شرکا ===
// الگوریتم حریصانه: بزرگ‌ترین بدهکار به بزرگ‌ترین طلبکار پرداخت می‌کند تا تسویه شود.
function calculateSettlements(partners) {
  const balances = partners.map(p => ({ partner: p, balance: getPartnerBalance(p.id, state.data) }));
  const creditors = balances.filter(b => b.balance.netPosition > 0).sort((a, b) => b.balance.netPosition - a.balance.netPosition);
  const debtors = balances.filter(b => b.balance.netPosition < 0).sort((a, b) => a.balance.netPosition - b.balance.netPosition);

  const settlements = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].balance.netPosition, -debtors[di].balance.netPosition);
    if (amount > 0) {
      settlements.push({
        fromId: debtors[di].partner.id,
        fromName: debtors[di].partner.name,
        toId: creditors[ci].partner.id,
        toName: creditors[ci].partner.name,
        amount
      });
    }
    creditors[ci].balance.netPosition -= amount;
    debtors[di].balance.netPosition += amount;
    if (creditors[ci].balance.netPosition <= 0) ci++;
    if (debtors[di].balance.netPosition >= 0) di++;
  }
  return settlements;
}

function renderAutoSettleButton(allPartners) {
  // دکمه فقط اگر حداقل یک موقعیت غیر صفر وجود داشته باشد نشان داده می‌شود
  const hasNonZero = allPartners.some(p => {
    const b = getPartnerBalance(p.id, state.data);
    return b.netPosition !== 0;
  });
  if (!hasNonZero) return '';
  return `
    <div class="mt-3">
      <button onclick="window.__autoSettle()" class="w-full h-11 rounded-xl bg-gradient-to-l from-success to-emerald-700 hover:opacity-90 text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-success/30">
        <i data-lucide="zap" class="w-4 h-4"></i>
        تسویه خودکار
      </button>
    </div>
  `;
}

window.__autoSettle = function() {
  const allPartners = (state.data.partners || []).filter(p => !p.deletedAt);
  if (allPartners.length === 0) return;

  const settlements = calculateSettlements(allPartners);
  if (settlements.length === 0) {
    showToast('همه شرکا تسویه هستند', 'success');
    return;
  }

  const listHtml = settlements.map((s, i) => `
    <div class="glass rounded-xl p-3 flex items-center gap-2.5">
      <div class="w-7 h-7 rounded-lg bg-success-soft text-success flex items-center justify-center shrink-0 text-xs font-bold">
        ${toPersianDigits(i + 1)}
      </div>
      <div class="flex-1 min-w-0 text-xs">
        <p class="font-bold truncate">${s.fromName} → ${s.toName}</p>
        <p class="text-[10px] text-fg-muted">انتقال بین شرکا</p>
      </div>
      <p class="text-xs font-bold text-success tabular-nums shrink-0">${formatTomanShort(s.amount)}</p>
    </div>
  `).join('');

  const content = `
    <div class="pb-2">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold">تسویه خودکار</h3>
        <button onclick="window.__cancelAutoSettle()" class="w-8 h-8 rounded-lg glass flex items-center justify-center">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <p class="text-xs text-fg-muted mb-3">${toPersianDigits(settlements.length)} انتقال برای تسویه کامل پیشنهاد می‌شود:</p>
      <div class="space-y-2 max-h-[40vh] overflow-y-auto mb-4">${listHtml}</div>
      <div class="flex gap-2">
        <button onclick="window.__cancelAutoSettle()" class="flex-1 h-11 rounded-xl glass text-sm font-medium hover:bg-white/10 transition">انصراف</button>
        <button onclick="window.__confirmAutoSettle()" class="flex-1 h-11 rounded-xl bg-success hover:bg-success/90 text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-success/30">
          <i data-lucide="check" class="w-4 h-4"></i> ثبت تسویه
        </button>
      </div>
    </div>
  `;

  openSheet(content, {
    onMount: () => {
      window.__cancelAutoSettle = () => closeSheet();
      window.__confirmAutoSettle = async () => {
        try {
          const dateIso = today();
          for (const s of settlements) {
            const transfer = await repo.partnerTransfers.create({
              fromPartnerId: s.fromId,
              toPartnerId: s.toId,
              amount: s.amount,
              date: dateIso,
              note: 'تسویه خودکار'
            });
            state.updateEntity('partnerTransfers', transfer);
          }
          closeSheet();
          showToast(`${toPersianDigits(settlements.length)} انتقال ثبت شد`, 'success');
          renderPartnersPage();
        } catch (e) {
          console.error('Auto settle failed:', e);
          showToast('خطا در تسویه خودکار', 'error');
        }
      };
    }
  });
};

function renderTransactionsTab(allPartners) {
  // جمع‌آوری همه هزینه‌ها و انتقال‌ها
  const expenses = (state.data.expenses || []).filter(e => !e.deletedAt);
  const transfers = (state.data.partnerTransfers || []).filter(t => !t.deletedAt);

  const allItems = [];

  for (const e of expenses) {
    const payer = (state.data.partners || []).find(p => p.id === e.paidByPartnerId);
    // شرکای ذی‌نفع در هزینه
    const sharePartners = (e.shareDistribution || []).map(s => {
      const p = (state.data.partners || []).find(pp => pp.id === s.partnerId);
      return p ? p.name : '—';
    }).join('، ');

    allItems.push({
      id: e.id,
      type: 'expense',
      date: e.date,
      amount: e.amount,
      title: e.title,
      payerName: payer ? payer.name : '—',
      payerId: e.paidByPartnerId,
      partnerIds: (e.shareDistribution || []).map(s => s.partnerId).concat([e.paidByPartnerId]),
      detail: sharePartners
    });
  }

  for (const t of transfers) {
    const fromP = (state.data.partners || []).find(p => p.id === t.fromPartnerId);
    const toP = (state.data.partners || []).find(p => p.id === t.toPartnerId);
    allItems.push({
      id: t.id,
      type: 'transfer',
      date: t.date,
      amount: t.amount,
      title: `انتقال از ${fromP ? fromP.name : '—'} به ${toP ? toP.name : '—'}`,
      fromName: fromP ? fromP.name : '—',
      toName: toP ? toP.name : '—',
      fromId: t.fromPartnerId,
      toId: t.toPartnerId,
      partnerIds: [t.fromPartnerId, t.toPartnerId]
    });
  }

  // فیلتر بر اساس نوع
  let filtered = allItems;
  if (txFilterType === 'expenses') filtered = filtered.filter(i => i.type === 'expense');
  else if (txFilterType === 'transfers') filtered = filtered.filter(i => i.type === 'transfer');

  // فیلتر بر اساس شریک
  if (txFilterPartner) {
    filtered = filtered.filter(i => i.partnerIds && i.partnerIds.includes(txFilterPartner));
  }

  // sort by date desc
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  // فیلتر نوع
  const typeChips = `
    <div class="flex gap-1.5 mb-2">
      <button onclick="window.__setTxFilterType('all')" class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${txFilterType === 'all' ? 'bg-brand text-white' : 'glass text-fg-muted'}">همه</button>
      <button onclick="window.__setTxFilterType('expenses')" class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${txFilterType === 'expenses' ? 'bg-brand text-white' : 'glass text-fg-muted'}">هزینه‌ها</button>
      <button onclick="window.__setTxFilterType('transfers')" class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${txFilterType === 'transfers' ? 'bg-brand text-white' : 'glass text-fg-muted'}">انتقال‌ها</button>
    </div>
  `;

  // فیلتر شریک
  const partnerChips = `
    <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-3">
      <button onclick="window.__setTxFilterPartner('')" class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${!txFilterPartner ? 'bg-brand text-white' : 'glass text-fg-muted'}">همه شرکا</button>
      ${allPartners.map(p => `
        <button onclick="window.__setTxFilterPartner('${p.id}')" class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${txFilterPartner === p.id ? 'bg-brand text-white' : 'glass text-fg-muted'}">${p.name}</button>
      `).join('')}
    </div>
  `;

  const listHtml = filtered.length === 0
    ? `<div class="glass rounded-2xl p-6 text-center text-fg-muted text-sm">موردی یافت نشد</div>`
    : filtered.map(item => {
        if (item.type === 'expense') {
          return `
            <div class="glass rounded-xl p-3 flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-danger-soft text-danger flex items-center justify-center shrink-0">
                <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-xs font-bold truncate">${item.title}</p>
                  ${Badge({ variant: 'danger', label: 'هزینه', classes: 'shrink-0' })}
                </div>
                <p class="text-[10px] text-fg-muted mt-0.5">
                  ${formatJalali(item.date)} · پرداخت: ${item.payerName} · شرکا: ${item.detail}
                </p>
              </div>
              <p class="text-xs font-bold text-danger tabular-nums shrink-0">${formatTomanShort(item.amount)}</p>
            </div>
          `;
        } else {
          return `
            <div class="glass rounded-xl p-3 flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-info-soft text-purple-300 flex items-center justify-center shrink-0">
                <i data-lucide="arrow-right-left" class="w-4 h-4"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-xs font-bold truncate">${item.fromName} → ${item.toName}</p>
                  ${Badge({ variant: 'info', label: 'انتقال', classes: 'shrink-0' })}
                </div>
                <p class="text-[10px] text-fg-muted mt-0.5">${formatJalali(item.date)}</p>
              </div>
              <p class="text-xs font-bold text-fg-muted tabular-nums shrink-0">${formatTomanShort(item.amount)}</p>
            </div>
          `;
        }
      }).join('');

  return `
    ${typeChips}
    ${partnerChips}
    <div class="space-y-2">${listHtml}</div>
  `;
}

function renderPartnerCard(partner) {
  const balance = getPartnerBalance(partner.id, state.data);
  const firstLetter = (partner.name || '').charAt(0);

  let posColor = 'text-fg-muted';
  let posLabel = 'تسویه';
  if (balance.netPosition > 0) { posColor = 'text-success'; posLabel = 'طلبکار'; }
  else if (balance.netPosition < 0) { posColor = 'text-danger'; posLabel = 'بدهکار'; }

  return `
    <div onclick="window.__editPartner('${partner.id}')"
      class="glass rounded-2xl p-3.5 flex items-center gap-3 hover:bg-white/8 transition active:scale-[0.98]">
      <div class="shrink-0">
        ${Avatar({ text: firstLetter, color: partner.avatarColor || 'brand', size: 'md' })}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold truncate">${partner.name}</p>
        ${partner.phone ? `
          <p class="text-[11px] text-fg-muted flex items-center gap-1 mt-0.5">
            <i data-lucide="phone" class="w-3 h-3"></i>
            ${toPersianDigits(partner.phone)}
          </p>
        ` : ''}
        <div class="flex items-center gap-1.5 mt-1.5">
          <span class="text-[10px] ${posColor}">${posLabel}</span>
          <span class="text-xs font-bold ${posColor} tabular-nums">${formatToman(Math.abs(balance.netPosition))}</span>
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
        <button onclick="window.__openPartnerForm()"
          class="pointer-events-auto w-14 h-14 rounded-2xl bg-cta hover:bg-cta-dark text-white shadow-xl shadow-cta/40 flex items-center justify-center transition active:scale-95">
          <i data-lucide="plus" class="w-6 h-6"></i>
        </button>
      </div>
    </div>
  `;
}

function openPartnerForm(id = null) {
  const partner = id ? (state.data.partners || []).find(p => p.id === id) : null;
  partnerFormState = { id: id, color: partner?.avatarColor || 'brand' };

  const content = renderPartnerForm(partner);
  openSheet(content, {
    onMount: () => {
      window.__closePartnerForm = () => closeSheet();
      window.__savePartner = savePartner;
      window.__deletePartner = (pid) => deletePartner(pid);
      window.__pickPartnerColor = (color) => {
        partnerFormState.color = color;
        refreshPartnerColorPicker();
      };
    }
  });
}

function renderPartnerForm(partner) {
  const isEdit = !!partner;
  return `
    <div class="pb-2">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold">${isEdit ? 'ویرایش شریک' : 'شریک جدید'}</h3>
        <button onclick="window.__closePartnerForm()" class="w-8 h-8 rounded-lg glass flex items-center justify-center">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <div class="space-y-3">
        ${Input({ name: 'name', label: 'نام', placeholder: 'نام شریک', value: partner?.name || '', required: true, icon: 'user' })}
        ${Input({ name: 'phone', label: 'شماره تماس', placeholder: '۰۹۱۲...', value: partner?.phone || '', icon: 'phone', inputmode: 'tel' })}
        ${Input({ name: 'email', label: 'ایمیل', placeholder: 'example@mail.com', value: partner?.email || '', icon: 'mail', inputmode: 'email' })}
        ${Textarea({ name: 'note', label: 'یادداشت', placeholder: 'یادداشت اختیاری...', value: partner?.note || '', rows: 2 })}

        <div>
          <label class="text-xs text-fg-muted mb-1.5 block">رنگ آواتار</label>
          <div class="flex flex-wrap gap-2" id="partner-color-picker">
            ${renderColorPickerButtons(partnerFormState.color, '__pickPartnerColor')}
          </div>
        </div>
      </div>

      <div class="flex gap-2 mt-6">
        ${isEdit ? `
          <button onclick="window.__deletePartner('${partner.id}')"
            class="h-11 px-4 rounded-xl glass text-danger text-sm font-medium hover:bg-danger/10 transition flex items-center gap-2">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        ` : ''}
        <button onclick="window.__savePartner()"
          class="flex-1 h-11 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-brand/30">
          <i data-lucide="check" class="w-4 h-4"></i>
          ${isEdit ? 'ذخیره تغییرات' : 'ثبت شریک'}
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

function refreshPartnerColorPicker() {
  const picker = document.getElementById('partner-color-picker');
  if (picker) {
    picker.innerHTML = renderColorPickerButtons(partnerFormState.color, '__pickPartnerColor');
    if (window.lucide) window.lucide.createIcons();
  }
}

async function savePartner() {
  const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (!sheet) return;

  const name = sheet.querySelector('[name="name"]')?.value?.trim() || '';
  const phone = sheet.querySelector('[name="phone"]')?.value?.trim() || '';
  const email = sheet.querySelector('[name="email"]')?.value?.trim() || '';
  const note = sheet.querySelector('[name="note"]')?.value?.trim() || '';
  const avatarColor = partnerFormState.color;

  const data = { name, phone, email, note, avatarColor };
  const result = validate('partner', data);
  if (!result.valid) {
    if (result.errors.name) { showToast('نام شریک الزامی است (حداقل ۲ کاراکتر)', 'error'); return; }
    if (result.errors.phone) { showToast('شماره تماس نامعتبر است', 'error'); return; }
    if (result.errors.email) { showToast('ایمیل نامعتبر است', 'error'); return; }
    showToast('اطلاعات نامعتبر است', 'error');
    return;
  }

  try {
    if (partnerFormState.id) {
      const updated = await repo.partners.update(partnerFormState.id, data);
      state.updateEntity('partners', updated);
      showToast('شریک به‌روزرسانی شد', 'success');
    } else {
      const created = await repo.partners.create(data);
      state.updateEntity('partners', created);
      const order = state.data.customOrders?.partners || [];
      state.updateCustomOrder('partners', [created.id, ...order]);
      showToast('شریک ایجاد شد', 'success');
    }
    closeSheet();
    renderPartnersPage();
  } catch (e) {
    console.error('Save partner failed:', e);
    showToast('خطا در ذخیره شریک', 'error');
  }
}

function deletePartner(id) {
  const partner = (state.data.partners || []).find(p => p.id === id);
  if (!partner) return;

  confirmDialog({
    title: 'حذف شریک',
    message: `آیا از حذف «${partner.name}» مطمئن هستید؟ این عمل قابل بازگشت نیست.`,
    confirmText: 'حذف',
    danger: true,
    onConfirm: async () => {
      try {
        await repo.partners.delete(id);
        state.removeEntity('partners', id);
        const order = state.data.customOrders?.partners || [];
        state.updateCustomOrder('partners', order.filter(i => i !== id));
        showToast('شریک حذف شد', 'success');
        renderPartnersPage();
      } catch (e) {
        console.error('Delete partner failed:', e);
        showToast('خطا در حذف شریک', 'error');
      }
    }
  });
}
