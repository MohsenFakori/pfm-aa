// src/ui/screens/equipment.js
// صفحه ابزارآلات — فاز 8 PRD

import { repo } from '../../core/repository.js';
import { state } from '../../core/state.js';
import { showToast } from '../components/toast.js';
import { openSheet, closeSheet, confirmDialog } from '../components/sheet.js';
import { openDatePicker } from '../components/datepicker.js';
import { Avatar, Input, Select, Textarea, EmptyState } from '../components/ui.js';
import { formatToman, formatTomanShort, parseIntAmount } from '../../utils/number.js';
import { formatJalali, toPersianDigits, today } from '../../utils/date.js';
import { validate } from '../../domain/validators.js';

let searchTerm = '';
let selectedOwnerFilter = '';
let equipmentFormState = { id: null, purchaseDate: '' };

export function renderEquipmentPage() {
  const allEquipment = (state.data.equipment || []).filter(e => !e.deletedAt);
  const partners = (state.data.partners || []).filter(p => !p.deletedAt);
  const main = document.getElementById('page-content');

  if (allEquipment.length === 0) {
    main.innerHTML = `
      <div class="px-4 pt-6">
        ${EmptyState({ icon: 'tool', title: 'هنوز ابزاری ثبت نشده', description: 'برای شروع، اولین ابزار خود را ثبت کنید.', actionLabel: 'افزودن ابزار', actionOnClick: 'window.__openEquipmentForm()' })}
      </div>
      ${renderFab()}
    `;
    if (window.lucide) window.lucide.createIcons();
    window.__openEquipmentForm = () => openEquipmentForm();
    return;
  }

  function getFiltered() {
    const q = searchTerm.trim().toLowerCase();
    return allEquipment.filter(e => {
      if (selectedOwnerFilter && e.ownerPartnerId !== selectedOwnerFilter) return false;
      if (q && !(e.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function renderListHtml(list) {
    if (list.length === 0) return `<div class="glass rounded-2xl p-6 text-center text-fg-muted text-sm">نتیجه‌ای یافت نشد</div>`;
    return list.map(renderEquipmentCard).join('');
  }

  const ownerChipsHtml = partners.length > 0 ? `
    <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 mt-3">
      <button onclick="window.__setOwnerFilter('')" class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${!selectedOwnerFilter ? 'bg-brand text-white' : 'glass text-fg-muted'}">همه</button>
      ${partners.map(p => `
        <button onclick="window.__setOwnerFilter('${p.id}')" class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${selectedOwnerFilter === p.id ? 'bg-brand text-white' : 'glass text-fg-muted'}">${p.name}</button>
      `).join('')}
    </div>
  ` : '';

  main.innerHTML = `
    <div class="px-4 pt-4 pb-32">
      <div class="flex items-center justify-between mb-3">
        ${renderSearch('equipment-search', 'جستجوی ابزار...')}
        <button onclick="window.__downloadEquipmentPdf()" class="shrink-0 ml-2 h-11 w-11 rounded-xl glass-strong text-brand hover:bg-white/10 transition flex items-center justify-center" title="دانلود PDF">
          <i data-lucide="download" class="w-5 h-5"></i>
        </button>
      </div>
      ${ownerChipsHtml}
      <div id="equipment-list" class="space-y-2.5 mt-4">${renderListHtml(getFiltered())}</div>
    </div>
    ${renderFab()}
  `;

  if (window.lucide) window.lucide.createIcons();

  const searchInput = document.getElementById('equipment-search');
  if (searchInput) {
    searchInput.value = searchTerm;
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      const listEl = document.getElementById('equipment-list');
      if (listEl) {
        listEl.innerHTML = renderListHtml(getFiltered());
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  window.__openEquipmentForm = () => openEquipmentForm();
  window.__editEquipment = (id) => openEquipmentForm(id);
  window.__deleteEquipment = (id) => deleteEquipment(id);
  window.__setOwnerFilter = (id) => { selectedOwnerFilter = id; renderEquipmentPage(); };
  window.__downloadEquipmentPdf = downloadEquipmentPdf;
}

function renderEquipmentCard(eq) {
  const owner = (state.data.partners || []).find(p => p.id === eq.ownerPartnerId);
  const firstLetter = owner ? (owner.name || '').charAt(0) : '?';
  return `
    <div onclick="window.__editEquipment('${eq.id}')" class="glass rounded-2xl p-3.5 flex items-center gap-3 hover:bg-white/8 transition active:scale-[0.98]">
      <div class="w-11 h-11 rounded-xl bg-brand/15 flex items-center justify-center shrink-0">
        <i data-lucide="tool" class="w-5 h-5 text-brand"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold truncate">${eq.name}</p>
        <div class="flex items-center gap-1.5 mt-0.5">
          ${owner ? `
            <div class="w-5 h-5 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-[9px] text-white font-bold">${firstLetter}</div>
            <span class="text-[11px] text-fg-muted">${owner.name}</span>
          ` : '<span class="text-[11px] text-fg-muted">بدون مالک</span>'}
        </div>
        <div class="flex items-center gap-3 mt-1.5">
          ${eq.purchaseDate ? `<span class="text-[10px] text-fg-muted flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3"></i>${formatJalali(eq.purchaseDate)}</span>` : ''}
          ${eq.amount ? `<span class="text-[10px] text-fg-muted flex items-center gap-1"><i data-lucide="wallet" class="w-3 h-3"></i>${formatToman(eq.amount)}</span>` : ''}
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
      <input id="${inputId}" type="text" placeholder="${placeholder}" class="w-full h-11 pr-10 pl-4 rounded-xl bg-ink-soft border border-line focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-sm transition" />
    </div>
  `;
}

function renderFab() {
  return `
    <div class="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 pointer-events-none z-30">
      <div class="flex justify-end">
        <button onclick="window.__openEquipmentForm()" class="pointer-events-auto w-14 h-14 rounded-2xl bg-cta hover:bg-cta-dark text-white shadow-xl shadow-cta/40 flex items-center justify-center transition active:scale-95" aria-label="افزودن ابزار">
          <i data-lucide="plus" class="w-6 h-6"></i>
        </button>
      </div>
    </div>
  `;
}

function openEquipmentForm(id = null) {
  const equipment = id ? (state.data.equipment || []).find(e => e.id === id) : null;
  equipmentFormState = { id: id, purchaseDate: equipment?.purchaseDate || '' };
  const content = renderEquipmentForm(equipment);
  openSheet(content, {
    onMount: () => {
      window.__closeEquipmentForm = () => closeSheet();
      window.__saveEquipment = saveEquipment;
      window.__deleteEquipment = (eid) => deleteEquipment(eid);
      window.__openEquipmentPurchaseDate = openEquipmentPurchaseDate;
      window.__clearEquipmentPurchaseDate = () => { equipmentFormState.purchaseDate = ''; refreshEquipmentForm(); };
    }
  });
}

function renderEquipmentForm(equipment) {
  const isEdit = !!equipment;
  const partners = (state.data.partners || []).filter(p => !p.deletedAt);
  const partnerOptions = partners.map(p => ({ value: p.id, label: p.name }));
  const partnerWarning = partners.length === 0 ? `
    <div class="rounded-xl bg-warning-soft p-3 text-xs text-warning flex items-center gap-2">
      <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i><span class="flex-1">ابتدا یک شریک ثبت کنید.</span>
    </div>
  ` : '';

  return `
    <div class="pb-2">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold">${isEdit ? 'ویرایش ابزار' : 'ابزار جدید'}</h3>
        <button onclick="window.__closeEquipmentForm()" class="w-8 h-8 rounded-lg glass flex items-center justify-center" aria-label="بستن">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="space-y-3">
        ${Input({ name: 'name', label: 'نام ابزار', placeholder: 'مثلاً: دریل بوش', value: equipment?.name || '', required: true, icon: 'tool' })}
        ${partnerWarning}
        ${Select({ name: 'ownerPartnerId', label: 'مالک', options: partnerOptions, value: equipment?.ownerPartnerId || '', required: true, placeholder: 'انتخاب شریک', icon: 'user' })}
        <div>
          <label class="text-xs text-fg-muted mb-1.5 block">تاریخ خرید (اختیاری)</label>
          <div class="flex gap-2">
            <button onclick="window.__openEquipmentPurchaseDate()" class="flex-1 h-11 px-4 rounded-xl bg-ink-soft border border-line focus:border-brand outline-none text-sm transition flex items-center justify-between ${!equipmentFormState.purchaseDate ? 'text-fg-muted' : ''}">
              <span>${equipmentFormState.purchaseDate ? formatJalali(equipmentFormState.purchaseDate) : 'انتخاب تاریخ'}</span>
              <i data-lucide="calendar" class="w-4 h-4 text-fg-muted"></i>
            </button>
            ${equipmentFormState.purchaseDate ? `
              <button onclick="window.__clearEquipmentPurchaseDate()" class="w-11 h-11 rounded-xl glass text-fg-muted hover:text-danger flex items-center justify-center transition shrink-0" aria-label="پاک کردن">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
            ` : ''}
          </div>
        </div>
        ${Input({ name: 'amount', type: 'text', label: 'مبلغ (اختیاری)', placeholder: 'مبلغ به تومان', value: equipment?.amount ? String(equipment.amount) : '', suffix: 'تومان', inputmode: 'numeric' })}
        ${Textarea({ name: 'note', label: 'توضیحات (اختیاری)', placeholder: 'یادداشت اختیاری...', value: equipment?.note || '', rows: 2 })}
      </div>
      <div class="flex gap-2 mt-6">
        ${isEdit ? `
          <button onclick="window.__deleteEquipment('${equipment.id}')" class="h-11 px-4 rounded-xl glass text-danger text-sm font-medium hover:bg-danger/10 transition flex items-center gap-2" aria-label="حذف">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        ` : ''}
        <button onclick="window.__saveEquipment()" class="flex-1 h-11 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-brand/30">
          <i data-lucide="check" class="w-4 h-4"></i> ${isEdit ? 'ذخیره تغییرات' : 'ثبت ابزار'}
        </button>
      </div>
    </div>
  `;
}

function refreshEquipmentForm() {
  const formSheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (formSheet) {
    const contentEl = formSheet.querySelector('.sheet-content');
    if (contentEl) {
      const equipment = equipmentFormState.id ? (state.data.equipment || []).find(e => e.id === equipmentFormState.id) : null;
      contentEl.innerHTML = renderEquipmentForm(equipment);
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

function openEquipmentPurchaseDate() {
  openDatePicker({
    value: equipmentFormState.purchaseDate || undefined,
    onSelect: (iso) => { equipmentFormState.purchaseDate = iso; refreshEquipmentForm(); }
  });
}

async function saveEquipment() {
  const sheet = document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (!sheet) return;
  const name = sheet.querySelector('[name="name"]')?.value?.trim() || '';
  const ownerPartnerId = sheet.querySelector('[name="ownerPartnerId"]')?.value || '';
  const amountStr = sheet.querySelector('[name="amount"]')?.value?.trim() || '';
  const amount = amountStr ? parseIntAmount(amountStr) : undefined;
  const note = sheet.querySelector('[name="note"]')?.value?.trim() || '';
  const purchaseDate = equipmentFormState.purchaseDate || undefined;

  if (amountStr && (!amount || amount <= 0)) { showToast('مبلغ نامعتبر است', 'error'); return; }

  const data = { name, ownerPartnerId, purchaseDate, amount, note };
  const result = validate('equipment', data);
  if (!result.valid) {
    if (result.errors.name) { showToast('نام ابزار الزامی است (حداقل ۲ کاراکتر)', 'error'); return; }
    if (result.errors.ownerPartnerId) { showToast('مالک را انتخاب کنید', 'error'); return; }
    showToast('اطلاعات نامعتبر است', 'error');
    return;
  }

  try {
    if (equipmentFormState.id) {
      const updated = await repo.equipment.update(equipmentFormState.id, data);
      state.updateEntity('equipment', updated);
      showToast('ابزار به‌روزرسانی شد', 'success');
    } else {
      const created = await repo.equipment.create(data);
      state.updateEntity('equipment', created);
      showToast('ابزار ثبت شد', 'success');
    }
    closeSheet();
    renderEquipmentPage();
  } catch (e) {
    console.error('Save equipment failed:', e);
    showToast('خطا در ذخیره ابزار', 'error');
  }
}

function deleteEquipment(id) {
  const equipment = (state.data.equipment || []).find(e => e.id === id);
  if (!equipment) return;
  confirmDialog({
    title: 'حذف ابزار',
    message: `آیا از حذف «${equipment.name}» مطمئن هستید؟ این عمل قابل بازگشت نیست.`,
    confirmText: 'حذف', danger: true,
    onConfirm: async () => {
      try {
        await repo.equipment.delete(id);
        state.removeEntity('equipment', id);
        showToast('ابزار حذف شد', 'success');
        closeSheet();
        renderEquipmentPage();
      } catch (e) {
        console.error('Delete equipment failed:', e);
        showToast('خطا در حذف ابزار', 'error');
      }
    }
  });
}

// === دانلود PDF لیست ابزارآلات ===
function downloadEquipmentPdf() {
  const allEquipment = (state.data.equipment || []).filter(e => !e.deletedAt);
  const partners = (state.data.partners || []).filter(p => !p.deletedAt);

  if (allEquipment.length === 0) {
    showToast('ابزاری برای چاپ وجود ندارد', 'warning');
    return;
  }

  const now = new Date();
  const reportDate = formatJalali(now.toISOString());

  // فیلتر بر اساس selectedOwnerFilter اگر تنظیم شده
  const equipment = selectedOwnerFilter
    ? allEquipment.filter(e => e.ownerPartnerId === selectedOwnerFilter)
    : allEquipment;

  // گروه‌بندی بر اساس مالک
  const byOwner = new Map();
  for (const eq of equipment) {
    if (!byOwner.has(eq.ownerPartnerId)) byOwner.set(eq.ownerPartnerId, []);
    byOwner.get(eq.ownerPartnerId).push(eq);
  }

  // تولید HTML جدول برای هر مالک
  const ownerSectionsHtml = [...byOwner.entries()].map(([ownerId, items]) => {
    const owner = partners.find(p => p.id === ownerId);
    const ownerName = owner ? owner.name : 'نامشخص';
    const totalValue = items.reduce((s, e) => s + (e.amount || 0), 0);

    const rowsHtml = items.map((eq, idx) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center; color: #888;">${toPersianDigits(idx + 1)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-weight: bold;">${eq.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${eq.note || '—'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center;">${eq.purchaseDate ? formatJalali(eq.purchaseDate) : '—'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: left; font-variant-numeric: tabular-nums;">${eq.amount ? formatToman(eq.amount) : '—'}</td>
      </tr>
    `).join('');

    return `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 8px 12px; background: #f0f4ff; border-radius: 6px; border-right: 4px solid #0080ff;">
          <span style="font-weight: bold; font-size: 14px; color: #0080ff;">${ownerName}</span>
          <span style="font-size: 12px; color: #666;">${toPersianDigits(items.length)} مورد · مجموع: ${formatToman(totalValue)}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>نام ابزار</th>
              <th>توضیحات</th>
              <th style="text-align: center; width: 120px;">تاریخ خرید</th>
              <th style="text-align: left; width: 140px;">مبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  const totalAll = equipment.reduce((s, e) => s + (e.amount || 0), 0);

  const html = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>لیست ابزارآلات - ${reportDate}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Vazirmatn", sans-serif;
      background: white;
      color: #1a1a1a;
      padding: 32px;
      line-height: 1.7;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 28px;
      padding-bottom: 16px;
      border-bottom: 3px solid #0080ff;
    }
    .header h1 {
      font-size: 22px;
      color: #0080ff;
      margin-bottom: 4px;
    }
    .header p {
      font-size: 12px;
      color: #666;
    }
    .summary {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-bottom: 24px;
    }
    .summary-item {
      text-align: center;
    }
    .summary-item .num {
      font-size: 20px;
      font-weight: bold;
      color: #0080ff;
    }
    .summary-item .label {
      font-size: 11px;
      color: #666;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th {
      background: #0080ff;
      color: white;
      padding: 8px;
      text-align: right;
      font-weight: bold;
    }
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      font-size: 10px;
      color: #999;
    }
    @media print {
      body { padding: 16px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>لیست ابزارآلات</h1>
    <p>تاریخ گزارش: ${reportDate}</p>
  </div>

  <div class="summary">
    <div class="summary-item">
      <div class="num">${toPersianDigits(equipment.length)}</div>
      <div class="label">تعداد ابزار</div>
    </div>
    <div class="summary-item">
      <div class="num">${toPersianDigits(byOwner.size)}</div>
      <div class="label">تعداد مالک</div>
    </div>
    <div class="summary-item">
      <div class="num">${formatToman(totalAll)}</div>
      <div class="label">ارزش کل</div>
    </div>
  </div>

  ${ownerSectionsHtml}

  <div class="footer">
    این گزارش توسط اپ مدیریت مالی پروژه‌های شخصی تولید شده · ${reportDate}
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 500);
    };
  </${'script'}>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    showToast('لطفاً اجازه باز شدن پنجره popup را بدهید', 'error');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
}
