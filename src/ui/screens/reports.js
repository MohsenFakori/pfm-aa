// src/ui/screens/reports.js
// صفحه گزارش‌گیری — فاز 9 PRD

import { state } from '../../core/state.js';
import { navigate } from '../../core/router.js';
import { showToast } from '../components/toast.js';
import { Badge, EmptyState } from '../components/ui.js';
import { formatToman, formatTomanShort, formatNumber } from '../../utils/number.js';
import { formatJalali, toPersianDigits, today } from '../../utils/date.js';
import { reports } from '../../domain/reports.js';
import { getEmployerReceipts, getEmployerBalance, getProjectReceived } from '../../domain/calculations.js';

const COLOR_GRADIENTS = {
  brand: 'from-brand to-brand-dark', cta: 'from-cta to-cta-dark',
  purple: 'from-purple-500 to-pink-500', cyan: 'from-cyan-500 to-blue-500',
  pink: 'from-pink-500 to-rose-500', success: 'from-success to-emerald-700',
  warning: 'from-warning to-cta', info: 'from-info to-purple-500'
};

let activeReportTab = 'employers';
let cashFlowPeriod = 'month';
let expandedEmployerId = null;
let reportDateFilter = 'all'; // all | thisMonth | thisYear | custom
let customDateFrom = '';
let customDateTo = '';

export function renderReportsPage() {
  const main = document.getElementById('page-content');

  // فیلتر تاریخ فقط برای تب کارفرماها و جریان نقدی نمایش داده شود
  const showDateFilter = activeReportTab === 'employers' || activeReportTab === 'cashflow';

  main.innerHTML = `
    <div class="px-4 pt-4 pb-32">
      <h2 class="text-base font-bold mb-4">گزارش‌ها</h2>
      ${renderTabs()}
      ${showDateFilter ? renderDateFilter() : ''}
      <div class="mt-4" id="report-content">${renderTabContent()}</div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  window.__setReportTab = (tab) => {
    activeReportTab = tab;
    document.querySelectorAll('[data-report-tab]').forEach(t => {
      const isActive = t.dataset.reportTab === activeReportTab;
      t.className = `flex-1 h-9 rounded-lg text-xs font-medium transition ${isActive ? 'tab-active' : 'text-fg-muted hover:bg-white/5'}`;
    });
    renderReportsPage();
  };
  window.__setCashFlowPeriod = (p) => { cashFlowPeriod = p; renderReportContent(); };
  window.__exportJson = exportJson;
  window.__navigate = (path) => navigate(path);
  window.__toggleEmployerDetails = (employerId) => {
    expandedEmployerId = (expandedEmployerId === employerId) ? null : employerId;
    renderReportContent();
  };
  window.__downloadEmployerPdf = downloadEmployerPdf;
  window.__setDateFilter = (filter) => {
    reportDateFilter = filter;
    renderReportsPage();
  };
  window.__openDateFrom = () => {
    import('../components/datepicker.js').then(({ openDatePicker }) => {
      openDatePicker({
        value: customDateFrom || undefined,
        onSelect: (iso) => {
          customDateFrom = iso;
          renderReportsPage();
        }
      });
    });
  };
  window.__openDateTo = () => {
    import('../components/datepicker.js').then(({ openDatePicker }) => {
      openDatePicker({
        value: customDateTo || undefined,
        onSelect: (iso) => {
          customDateTo = iso;
          renderReportsPage();
        }
      });
    });
  };
  if (activeReportTab === 'export') attachExportListeners();
}

// === رندر فیلتر تاریخ ===
function renderDateFilter() {
  const filters = [
    { id: 'all', label: 'همه' },
    { id: 'thisMonth', label: 'این ماه' },
    { id: 'thisYear', label: 'امسال' },
    { id: 'custom', label: 'بازه دلخواه' }
  ];
  return `
    <div class="mt-3">
      <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        ${filters.map(f => `
          <button data-filter="${f.id}" onclick="window.__setDateFilter('${f.id}')"
            class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${reportDateFilter === f.id ? 'bg-brand text-white' : 'glass text-fg-muted hover:bg-white/10'}">
            ${f.label}
          </button>
        `).join('')}
      </div>
      ${reportDateFilter === 'custom' ? `
        <div class="flex gap-2 mt-2">
          <button onclick="window.__openDateFrom()" class="flex-1 h-10 px-3 rounded-xl bg-ink-soft border border-line focus:border-brand outline-none text-xs transition flex items-center justify-between">
            <span class="${customDateFrom ? '' : 'text-fg-muted'}">${customDateFrom ? formatJalali(customDateFrom) : 'از تاریخ'}</span>
            <i data-lucide="calendar" class="w-3.5 h-3.5 text-fg-muted"></i>
          </button>
          <button onclick="window.__openDateTo()" class="flex-1 h-10 px-3 rounded-xl bg-ink-soft border border-line focus:border-brand outline-none text-xs transition flex items-center justify-between">
            <span class="${customDateTo ? '' : 'text-fg-muted'}">${customDateTo ? formatJalali(customDateTo) : 'تا تاریخ'}</span>
            <i data-lucide="calendar" class="w-3.5 h-3.5 text-fg-muted"></i>
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

// === محاسبه بازه تاریخ بر اساس فیلتر ===
function getDateRange() {
  const now = new Date();
  if (reportDateFilter === 'thisMonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (reportDateFilter === 'thisYear') {
    const start = new Date(now.getFullYear(), 0, 1);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (reportDateFilter === 'custom' && customDateFrom && customDateTo) {
    return { from: customDateFrom, to: customDateTo };
  }
  return null; // all
}

// === فیلتر receipts بر اساس بازه تاریخ ===
function filterReceiptsByDate(receipts, range) {
  if (!range) return receipts;
  return receipts.filter(r => {
    const d = new Date(r.date);
    return d >= new Date(range.from) && d <= new Date(range.to);
  });
}

function renderReportContent() {
  const contentEl = document.getElementById('report-content');
  if (contentEl) {
    contentEl.innerHTML = renderTabContent();
    if (window.lucide) window.lucide.createIcons();
    if (activeReportTab === 'export') attachExportListeners();
  }
}

function renderTabs() {
  const tabs = [
    { id: 'employers', label: 'کارفرماها' },
    { id: 'partners', label: 'شرکا' },
    { id: 'cashflow', label: 'جریان نقدی' },
    { id: 'export', label: 'خروجی' }
  ];
  return `
    <div class="flex rounded-xl glass p-1">
      ${tabs.map(t => `
        <button data-report-tab="${t.id}" onclick="window.__setReportTab('${t.id}')" class="flex-1 h-9 rounded-lg text-xs font-medium transition ${t.id === activeReportTab ? 'tab-active' : 'text-fg-muted hover:bg-white/5'}">${t.label}</button>
      `).join('')}
    </div>
  `;
}

function renderTabContent() {
  if (activeReportTab === 'employers') return renderEmployerBalances();
  if (activeReportTab === 'partners') return renderPartnerBalances();
  if (activeReportTab === 'cashflow') return renderCashFlow();
  return renderExportTab();
}

function renderEmployerBalances() {
  const balances = reports.employerBalances();
  if (balances.length === 0) return EmptyState({ icon: 'briefcase', title: 'هنوز کارفرمایی ثبت نشده', description: 'برای مشاهده گزارش تراز کارفرماها، ابتدا کارفرما و پروژه ثبت کنید.' });
  const totalDebt = balances.reduce((s, b) => s + b.totalDebt, 0);
  const totalReceived = balances.reduce((s, b) => s + b.totalReceived, 0);
  const totalCredit = balances.reduce((s, b) => s + b.totalCredit, 0);
  const netBalance = totalDebt - totalReceived;
  const unknownProjectCount = balances.reduce((s, b) => s + (b.unknownProjectCount || 0), 0);
  const warning = unknownProjectCount > 0 ? `
    <div class="rounded-xl border border-warning/30 bg-warning/10 p-3 flex items-start gap-2">
      <i data-lucide="alert-triangle" class="w-4 h-4 text-warning shrink-0 mt-0.5"></i>
      <p class="text-[10px] text-fg-muted leading-5">${toPersianDigits(unknownProjectCount)} پروژه مبلغ نامشخص دارد؛ ارقام بدهی و تراز زیر فقط بر اساس پروژه‌های دارای مبلغ مشخص محاسبه شده‌اند و وضعیت نهایی قطعی نیست.</p>
    </div>` : '';
  const sorted = [...balances].sort((a, b) => b.balance - a.balance);
  return `<div class="space-y-4">${warning}${renderEmployerSummary(totalDebt, totalReceived, totalCredit, netBalance)}<div class="space-y-2.5">${sorted.map(renderEmployerBalanceRow).join('')}</div></div>`;
}

function renderEmployerSummary(totalDebt, totalReceived, totalCredit, netBalance) {
  return `
    <div class="glass-strong rounded-2xl p-4">
      <div class="grid grid-cols-2 gap-3">
        <div><p class="text-[10px] text-fg-muted mb-1">مجموع بدهی</p><p class="text-sm font-bold tabular-nums">${formatTomanShort(totalDebt)}</p></div>
        <div><p class="text-[10px] text-fg-muted mb-1">مجموع دریافتی</p><p class="text-sm font-bold tabular-nums text-success">${formatTomanShort(totalReceived)}</p></div>
        <div><p class="text-[10px] text-fg-muted mb-1">علی‌الحساب کل</p><p class="text-sm font-bold tabular-nums text-purple-300">${formatTomanShort(totalCredit)}</p></div>
        <div><p class="text-[10px] text-fg-muted mb-1">بدهی خالص</p><p class="text-sm font-bold tabular-nums ${netBalance > 0 ? 'text-danger' : netBalance < 0 ? 'text-success' : 'text-fg-muted'}">${formatTomanShort(netBalance)}</p></div>
      </div>
    </div>
  `;
}

function renderEmployerBalanceRow(b) {
  const firstLetter = (b.employer.name || '').charAt(0);
  const color = b.employer.avatarColor || 'brand';
  let statusBadge;
  if (b.hasUnknownProjectAmounts) statusBadge = Badge({ variant: 'warning', label: 'نیازمند بررسی' });
  else if (b.status === 'debtor') statusBadge = Badge({ variant: 'danger', label: 'بدهکار' });
  else if (b.status === 'creditor') statusBadge = Badge({ variant: 'success', label: 'بستانکار' });
  else statusBadge = Badge({ variant: 'default', label: 'تسویه' });

  const isExpanded = expandedEmployerId === b.employer.id;
  const range = getDateRange();
  const allReceipts = getEmployerReceipts(b.employer.id, state.data);
  const receipts = isExpanded ? filterReceiptsByDate(allReceipts, range) : [];

  // محاسبه دریافتی در بازه انتخاب‌شده
  const filteredReceipts = filterReceiptsByDate(allReceipts, range);
  const receivedInPeriod = filteredReceipts.reduce((s, r) => s + r.amount, 0);

  return `
    <div class="glass rounded-2xl overflow-hidden">
      <div onclick="window.__toggleEmployerDetails('${b.employer.id}')" class="p-3.5 flex items-center gap-3 hover:bg-white/8 transition active:scale-[0.98]">
        <div class="shrink-0"><div class="w-10 h-10 rounded-full bg-gradient-to-br ${COLOR_GRADIENTS[color]} flex items-center justify-center text-white font-bold text-sm">${firstLetter}</div></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2 mb-1"><p class="text-sm font-bold truncate">${b.employer.name}</p>${statusBadge}</div>
          <div class="grid grid-cols-3 gap-1 text-center">
            <div><p class="text-[9px] text-fg-muted">بدهی</p><p class="text-[11px] font-bold tabular-nums">${formatTomanShort(b.totalDebt)}</p></div>
            <div><p class="text-[9px] text-fg-muted">دریافتی ${range ? 'بازه' : 'کل'}</p><p class="text-[11px] font-bold tabular-nums text-success">${formatTomanShort(range ? receivedInPeriod : b.totalReceived)}</p></div>
            <div><p class="text-[9px] text-fg-muted">علی‌الحساب</p><p class="text-[11px] font-bold tabular-nums text-purple-300">${formatTomanShort(b.totalCredit)}</p></div>
          </div>
          <div class="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-fg-muted flex items-center gap-1">
                <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-3 h-3"></i>
                ${isExpanded ? 'بستن ریز' : 'ریز پرداختی‌ها'}
              </span>
              <button onclick="event.stopPropagation(); window.__downloadEmployerPdf('${b.employer.id}')" class="text-[10px] text-brand font-medium flex items-center gap-1 hover:underline">
                <i data-lucide="download" class="w-3 h-3"></i> PDF
              </button>
            </div>
            <span class="text-xs font-bold tabular-nums ${b.hasUnknownProjectAmounts ? 'text-warning' : b.balance > 0 ? 'text-danger' : b.balance < 0 ? 'text-success' : 'text-fg-muted'}">${b.hasUnknownProjectAmounts ? 'تراز موقت: ' : ''}${formatToman(b.balance)}</span>
          </div>
        </div>
      </div>
      ${isExpanded ? renderEmployerReceiptsList(receipts) : ''}
    </div>
  `;
}

function renderEmployerReceiptsList(receipts) {
  if (receipts.length === 0) {
    return `
      <div class="px-4 pb-4 pt-2 border-t border-white/5">
        <p class="text-xs text-fg-muted text-center py-3">هیچ پرداختی ثبت نشده</p>
      </div>
    `;
  }
  return `
    <div class="px-4 pb-4 pt-3 border-t border-white/5 space-y-2">
      <p class="text-[10px] text-fg-muted mb-2">ریز پرداختی‌ها (${toPersianDigits(receipts.length)} مورد)</p>
      ${receipts.map(r => `
        <div class="glass rounded-xl p-2.5">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-lg bg-success-soft text-success flex items-center justify-center shrink-0">
                <i data-lucide="arrow-down-left" class="w-3 h-3"></i>
              </div>
              <div>
                <p class="text-[10px] font-bold">${formatJalali(r.date)}</p>
                <p class="text-[9px] text-fg-muted">${r.receiverName}</p>
              </div>
            </div>
            <p class="text-xs font-bold text-success tabular-nums">${formatTomanShort(r.amount)}</p>
          </div>
          ${r.allocations.length > 0 ? `
            <div class="mt-1.5 pt-1.5 border-t border-white/5 space-y-0.5">
              ${r.allocations.map(a => `
                <div class="flex items-center justify-between text-[9px]">
                  <span class="text-fg-muted truncate">${a.projectName}</span>
                  <span class="tabular-nums">${formatTomanShort(a.amount)}</span>
                </div>
              `).join('')}
              ${r.surplus > 0 ? `
                <div class="flex items-center justify-between text-[9px] pt-0.5">
                  <span class="text-purple-300">علی‌الحساب</span>
                  <span class="tabular-nums text-purple-300">${formatTomanShort(r.surplus)}</span>
                </div>
              ` : ''}
            </div>
          ` : `<p class="text-[9px] text-purple-300 mt-1">کل مبلغ علی‌الحساب</p>`}
        </div>
      `).join('')}
    </div>
  `;
}

function renderPartnerBalances() {
  const balances = reports.partnerBalances();
  if (balances.length === 0) return EmptyState({ icon: 'users', title: 'هنوز شریکی ثبت نشده', description: 'برای مشاهده گزارش تراز شرکا، ابتدا شریک و پروژه ثبت کنید.' });

  const totalExpectedShare = balances.reduce((s, b) => s + b.expectedShare, 0);
  const totalReceived = balances.reduce((s, b) => s + b.actualReceivedFromEmployers, 0);
  const totalAllocatedReceived = balances.reduce((s, b) => s + b.allocatedReceivedFromEmployers, 0);
  const totalOverShare = balances.reduce((s, b) => s + b.overShare, 0);
  const totalUnderShare = balances.reduce((s, b) => s + b.underShare, 0);
  const totalCreditorClaims = balances.reduce((s, b) => s + Math.max(0, -b.overallPosition), 0);
  const totalDebtorObligations = balances.reduce((s, b) => s + Math.max(0, b.overallPosition), 0);
  const sorted = [...balances].sort((a, b) => b.overallPosition - a.overallPosition);
  const unknownProjects = (state.data.projects || []).filter(p =>
    !p.deletedAt && (p.amountUndetermined === true || p.amount == null)
  );
  const warning = unknownProjects.length > 0 ? `
    <div class="rounded-xl border border-warning/30 bg-warning/10 p-3.5 flex items-start gap-2.5">
      <i data-lucide="alert-triangle" class="w-4 h-4 text-warning shrink-0 mt-0.5"></i>
      <div class="min-w-0">
        <p class="text-xs font-bold text-warning">محاسبه حق‌السهم هنوز کامل نیست</p>
        <p class="text-[10px] text-fg-muted mt-1 leading-5">${toPersianDigits(unknownProjects.length)} پروژه مبلغ نامشخص دارد؛ مجموع حق‌السهم‌ها و مقایسه دریافتی با سهم نهایی ممکن است کمتر از مقدار واقعی باشد. تراز هزینه‌ها و انتقال‌های ثبت‌شده جداگانه محاسبه شده است.</p>
        <button onclick="window.__navigate('/projects')" class="text-[10px] text-warning font-bold mt-2">مشاهده پروژه‌ها</button>
      </div>
    </div>` : '';

  return `
    <div class="space-y-4">
      ${warning}
      <div class="glass-strong rounded-2xl p-4">
        <p class="text-xs font-bold mb-3">خلاصه حق‌السهم و دریافتی</p>
        <div class="grid grid-cols-2 gap-3">
          <div><p class="text-[10px] text-fg-muted mb-1">مجموع حق‌السهم</p><p class="text-sm font-bold tabular-nums">${formatTomanShort(totalExpectedShare)}</p></div>
          <div><p class="text-[10px] text-fg-muted mb-1">مجموع دریافتی ثبت‌شده</p><p class="text-sm font-bold text-success tabular-nums">${formatTomanShort(totalReceived)}</p></div>
          <div><p class="text-[10px] text-fg-muted mb-1">دریافتی تخصیص‌یافته به پروژه‌ها</p><p class="text-sm font-bold text-success tabular-nums">${formatTomanShort(totalAllocatedReceived)}</p></div>
          <div><p class="text-[10px] text-fg-muted mb-1">بیشتر از سهم مبالغ وصول‌شده</p><p class="text-sm font-bold text-danger tabular-nums">${formatTomanShort(totalOverShare)}</p></div>
          <div><p class="text-[10px] text-fg-muted mb-1">کمتر از سهم مبالغ وصول‌شده</p><p class="text-sm font-bold text-warning tabular-nums">${formatTomanShort(totalUnderShare)}</p></div>
        </div>
      </div>
      <div class="glass-strong rounded-2xl p-4">
        <p class="text-xs font-bold mb-3">خلاصه بدهی بین شرکا</p>
        <div class="grid grid-cols-2 gap-3">
          <div><p class="text-[10px] text-fg-muted mb-1">مجموع طلب شرکا</p><p class="text-sm font-bold text-success tabular-nums">${formatTomanShort(totalCreditorClaims)}</p></div>
          <div><p class="text-[10px] text-fg-muted mb-1">مجموع بدهی شرکا</p><p class="text-sm font-bold text-danger tabular-nums">${formatTomanShort(totalDebtorObligations)}</p></div>
        </div>
        <p class="text-[9px] text-fg-muted mt-2">تراز بین شرکا فقط بر اساس مبالغی محاسبه می‌شود که از کارفرما دریافت و به پروژه‌ها تخصیص یافته‌اند؛ مانده وصول‌نشده از کارفرما بدهی شریک دیگر محسوب نمی‌شود.</p>
      </div>
      <div class="space-y-2.5">${sorted.map(renderPartnerBalanceRow).join('')}</div>
    </div>
  `;
}

function renderPartnerBalanceRow(b) {
  const firstLetter = (b.partner.name || '').charAt(0);
  const color = b.partner.avatarColor || 'brand';
  let statusBadge;
  if (b.hasUnknownProjectAmounts) statusBadge = Badge({ variant: 'warning', label: 'سهم نامشخص' });
  else if (b.status === 'creditor') statusBadge = Badge({ variant: 'success', label: 'طلبکار' });
  else if (b.status === 'debtor') statusBadge = Badge({ variant: 'danger', label: 'بدهکار' });
  else statusBadge = Badge({ variant: 'default', label: 'تسویه' });

  const shareLabel = b.shareDifference > 0 ? 'بیشتر از سهم وصول‌شده' : b.shareDifference < 0 ? 'کمتر از سهم وصول‌شده' : 'مطابق سهم وصول‌شده';
  const shareColor = b.shareDifference > 0 ? 'text-danger' : b.shareDifference < 0 ? 'text-warning' : 'text-success';
  const positionLabel = b.overallPosition > 0 ? 'بدهکار به شرکا' : b.overallPosition < 0 ? 'طلبکار از شرکا' : 'تراز نهایی: تسویه';
  const positionColor = b.overallPosition > 0 ? 'text-danger' : b.overallPosition < 0 ? 'text-success' : 'text-fg-muted';

  return `
    <div class="glass rounded-2xl p-3.5">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br ${COLOR_GRADIENTS[color]} flex items-center justify-center text-white font-bold text-sm shrink-0">${firstLetter}</div>
        <div class="flex-1 min-w-0"><p class="text-sm font-bold truncate">${b.partner.name}</p></div>
        ${statusBadge}
      </div>
      <div class="grid grid-cols-2 gap-2 text-center">
        <div class="rounded-lg bg-white/5 py-2">
          <p class="text-[9px] text-fg-muted">حق‌السهم پروژه‌ها</p>
          <p class="text-xs font-bold tabular-nums">${formatTomanShort(b.expectedShare)}</p>
        </div>
        <div class="rounded-lg bg-white/5 py-2">
          <p class="text-[9px] text-fg-muted">دریافتی تخصیص‌یافته</p>
          <p class="text-xs font-bold text-success tabular-nums">${formatTomanShort(b.allocatedReceivedFromEmployers)}</p>
        </div>
        <div class="rounded-lg bg-white/5 py-2">
          <p class="text-[9px] text-fg-muted">${shareLabel}</p>
          <p class="text-xs font-bold ${shareColor} tabular-nums">${formatTomanShort(Math.abs(b.shareDifference))}</p>
        </div>
        <div class="rounded-lg bg-white/5 py-2">
          <p class="text-[9px] text-fg-muted">خالص هزینه‌ها و انتقال‌ها</p>
          <p class="text-xs font-bold tabular-nums">${formatTomanShort(Math.abs(b.netPosition))}</p>
        </div>
      </div>
      <div class="border-t border-white/5 pt-2 mt-2 flex items-center justify-between">
        <span class="text-[10px] ${positionColor}">${positionLabel}</span>
        <span class="text-xs font-bold tabular-nums ${positionColor}">${formatToman(Math.abs(b.overallPosition))}</span>
      </div>
      ${b.hasUnknownProjectAmounts ? `<p class="text-[10px] text-warning mt-2">حق‌السهم این شریک به دلیل وجود پروژه با مبلغ نامشخص، قطعی نیست.</p>` : ''}
    </div>
  `;
}

function renderCashFlow() {
  let data, periodLabel;
  if (cashFlowPeriod === 'month') { data = reports.cashFlowByMonth(6); periodLabel = 'ماه'; }
  else { data = reports.cashFlowByYear(3); periodLabel = 'سال'; }
  const totalInflow = data.reduce((s, d) => s + d.inflow, 0);
  const totalOutflow = data.reduce((s, d) => s + d.outflow, 0);
  const totalNet = totalInflow - totalOutflow;
  return `
    <div class="space-y-4">
      <div class="flex rounded-xl glass p-1">
        <button onclick="window.__setCashFlowPeriod('month')" class="flex-1 h-9 rounded-lg text-xs font-medium transition ${cashFlowPeriod === 'month' ? 'tab-active' : 'text-fg-muted hover:bg-white/5'}">ماهانه</button>
        <button onclick="window.__setCashFlowPeriod('year')" class="flex-1 h-9 rounded-lg text-xs font-medium transition ${cashFlowPeriod === 'year' ? 'tab-active' : 'text-fg-muted hover:bg-white/5'}">سالانه</button>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div class="glass-strong rounded-xl p-3 text-center"><p class="text-[9px] text-fg-muted mb-1">ورودی</p><p class="text-xs font-bold text-success tabular-nums">${formatTomanShort(totalInflow)}</p></div>
        <div class="glass-strong rounded-xl p-3 text-center"><p class="text-[9px] text-fg-muted mb-1">خروجی</p><p class="text-xs font-bold text-danger tabular-nums">${formatTomanShort(totalOutflow)}</p></div>
        <div class="glass-strong rounded-xl p-3 text-center"><p class="text-[9px] text-fg-muted mb-1">خالص</p><p class="text-xs font-bold tabular-nums ${totalNet >= 0 ? 'text-success' : 'text-danger'}">${formatTomanShort(totalNet)}</p></div>
      </div>
      ${renderCashFlowChart(data, periodLabel)}
    </div>
  `;
}

function renderCashFlowChart(data, periodLabel) {
  const maxVal = Math.max(1, ...data.map(d => Math.max(d.inflow, d.outflow)));
  return `
    <div class="glass-strong rounded-2xl p-4">
      <p class="text-xs font-bold mb-4">جریان نقدی ${toPersianDigits(data.length)} ${periodLabel} اخیر</p>
      ${data.length === 0 ? `<div class="text-center py-6 text-xs text-fg-muted">داده‌ای موجود نیست</div>` : `
        <div class="flex items-end justify-between gap-2 h-40">
          ${data.map(d => {
            const inflowHeight = Math.max(2, Math.round((d.inflow / maxVal) * 100));
            const outflowHeight = Math.max(2, Math.round((d.outflow / maxVal) * 100));
            return `
              <div class="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div class="text-[9px] text-fg-muted tabular-nums truncate w-full text-center" title="${formatTomanShort(d.net)}">${d.net >= 0 ? '+' : ''}${formatTomanShort(d.net)}</div>
                <div class="flex items-end gap-0.5 h-24 w-full justify-center">
                  <div class="w-2 rounded-t bg-success" style="height: ${inflowHeight}%;" title="ورودی: ${formatToman(d.inflow)}"></div>
                  <div class="w-2 rounded-t bg-danger" style="height: ${outflowHeight}%;" title="خروجی: ${formatToman(d.outflow)}"></div>
                </div>
                <p class="text-[9px] text-fg-muted truncate w-full text-center">${d.period}</p>
              </div>
            `;
          }).join('')}
        </div>
        <div class="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-white/5">
          <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-success"></span><span class="text-[10px] text-fg-muted">ورودی</span></div>
          <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-danger"></span><span class="text-[10px] text-fg-muted">خروجی</span></div>
        </div>
      `}
    </div>
  `;
}

function renderExportTab() {
  const lastExport = state.data.settings?.lastExportAt;
  const employersCount = (state.data.employers || []).filter(e => !e.deletedAt).length;
  const projectsCount = (state.data.projects || []).filter(p => !p.deletedAt).length;
  const txCount = (state.data.receipts || []).filter(r => !r.deletedAt).length
    + (state.data.expenses || []).filter(e => !e.deletedAt).length
    + (state.data.partnerTransfers || []).filter(t => !t.deletedAt).length;
  return `
    <div class="space-y-4">
      <div class="glass-strong rounded-2xl p-4">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl bg-success-soft text-success flex items-center justify-center"><i data-lucide="download" class="w-5 h-5"></i></div>
          <div class="flex-1"><p class="text-sm font-bold">خروجی JSON کامل</p><p class="text-[11px] text-fg-muted">دانلود تمام داده‌ها در یک فایل JSON</p></div>
        </div>
        <button onclick="window.__exportJson()" class="w-full h-11 rounded-xl bg-success hover:bg-success/90 text-white text-sm font-medium transition flex items-center justify-center gap-2">
          <i data-lucide="download" class="w-4 h-4"></i> دانلود فایل پشتیبان
        </button>
      </div>
      <div class="glass-strong rounded-2xl p-4">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl bg-warning-soft text-warning flex items-center justify-center"><i data-lucide="upload" class="w-5 h-5"></i></div>
          <div class="flex-1"><p class="text-sm font-bold">بازگردانی از JSON</p><p class="text-[11px] text-fg-muted">آپلود فایل پشتیبان و بازگردانی داده‌ها</p></div>
        </div>
        <label class="block">
          <input type="file" id="restore-file-input" accept=".json" class="hidden" />
          <span class="block w-full h-11 rounded-xl glass text-sm font-medium hover:bg-white/10 transition flex items-center justify-center gap-2 cursor-pointer">
            <i data-lucide="file-up" class="w-4 h-4"></i> انتخاب فایل
          </span>
        </label>
        <p class="text-[10px] text-fg-muted mt-2">این قابلیت در فاز ۱۲ به‌طور کامل پیاده‌سازی می‌شود.</p>
      </div>
      <div class="glass rounded-2xl p-4">
        <p class="text-xs font-bold mb-2">اطلاعات نسخه</p>
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-[11px]"><span class="text-fg-muted">نسخه فرمت</span><span class="tabular-nums">${toPersianDigits(1)}</span></div>
          <div class="flex items-center justify-between text-[11px]"><span class="text-fg-muted">آخرین خروجی</span><span class="tabular-nums">${lastExport ? formatJalali(lastExport) : '—'}</span></div>
          <div class="flex items-center justify-between text-[11px]"><span class="text-fg-muted">تعداد کارفرماها</span><span class="tabular-nums">${toPersianDigits(employersCount)}</span></div>
          <div class="flex items-center justify-between text-[11px]"><span class="text-fg-muted">تعداد پروژه‌ها</span><span class="tabular-nums">${toPersianDigits(projectsCount)}</span></div>
          <div class="flex items-center justify-between text-[11px]"><span class="text-fg-muted">تعداد تراکنش‌ها</span><span class="tabular-nums">${toPersianDigits(txCount)}</span></div>
        </div>
      </div>
    </div>
  `;
}

function attachExportListeners() {
  const fileInput = document.getElementById('restore-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      showToast('بازگردانی در فاز ۱۲ پیاده‌سازی می‌شود', 'info');
      fileInput.value = '';
    });
  }
}

async function exportJson() {
  try {
    showToast('در حال آماده‌سازی فایل پشتیبان...', 'info');
    const payload = await reports.exportAll();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pfm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (state.updateSettings) state.updateSettings({ lastExportAt: new Date().toISOString() });
    showToast('فایل پشتیبان دانلود شد', 'success');
    renderReportContent();
  } catch (e) {
    console.error('Export failed:', e);
    showToast('خطا در خروجی گرفتن', 'error');
  }
}

// === دانلود PDF گزارش یک کارفرما ===
// یک گزارش زیبا و ساختاریافته برای هر کارفرما تولید می‌کند
function downloadEmployerPdf(employerId) {
  const employer = (state.data.employers || []).find(e => e.id === employerId);
  if (!employer) { showToast('کارفرما یافت نشد', 'error'); return; }

  const balance = getEmployerBalance(employerId, state.data);
  const range = getDateRange();
  const allReceipts = getEmployerReceipts(employerId, state.data);
  const receipts = filterReceiptsByDate(allReceipts, range);
  const projects = (state.data.projects || []).filter(p =>
    p.employerId === employerId && !p.deletedAt
  );

  const now = new Date();
  const reportDate = formatJalali(now.toISOString());

  // برچسب بازه تاریخ
  let periodLabel = 'همه زمان‌ها';
  if (range) {
    periodLabel = `از ${formatJalali(range.from)} تا ${formatJalali(range.to)}`;
  }

  // مجموع دریافتی در بازه
  const totalReceivedInPeriod = receipts.reduce((s, r) => s + r.amount, 0);

  // تولید HTML پروژه‌ها
  const projectsHtml = projects.map(p => {
    const received = getProjectReceived(p.id, state.data);
    const percent = p.amount > 0 ? Math.min(100, Math.round((received / p.amount) * 100)) : 0;
    const statusLabels = { active: 'فعال', completed: 'تکمیل‌شده', archived: 'بایگانی‌شده' };
    return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${p.title}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: left; font-variant-numeric: tabular-nums;">${formatToman(p.amount)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: left; font-variant-numeric: tabular-nums; color: #2d8659;">${formatToman(received)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center;">${toPersianDigits(percent)}٪</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center;">${statusLabels[p.status] || p.status}</td>
      </tr>
    `;
  }).join('');

  // تولید HTML ریز پرداختی‌ها
  const receiptsHtml = receipts.length > 0 ? receipts.map(r => {
    const allocationsHtml = r.allocations.length > 0 ? r.allocations.map(a => `
      <div style="display: flex; justify-content: space-between; padding: 4px 12px; font-size: 11px; color: #555;">
        <span>↳ ${a.projectName}</span>
        <span style="font-variant-numeric: tabular-nums;">${formatToman(a.amount)}</span>
      </div>
    `).join('') : '';

    const surplusHtml = r.surplus > 0 ? `
      <div style="display: flex; justify-content: space-between; padding: 4px 12px; font-size: 11px; color: #6554c0;">
        <span>↳ علی‌الحساب</span>
        <span style="font-variant-numeric: tabular-nums;">${formatToman(r.surplus)}</span>
      </div>
    ` : '';

    return `
      <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px; margin-bottom: 8px; background: #fcfcfc;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-weight: bold; font-size: 13px;">${formatJalali(r.date)}</span>
            <span style="font-size: 11px; color: #888; margin-right: 8px;">دریافت‌کننده: ${r.receiverName}</span>
          </div>
          <span style="font-weight: bold; color: #2d8659; font-variant-numeric: tabular-nums;">${formatToman(r.amount)}</span>
        </div>
        ${allocationsHtml}
        ${surplusHtml}
      </div>
    `;
  }).join('') : '<p style="text-align: center; color: #888; padding: 16px;">در این بازه پرداختی ثبت نشده است</p>';

  // وضعیت تراز
  let statusText = 'تسویه';
  let statusColor = '#666';
  if (balance.balance > 0) { statusText = 'بدهکار'; statusColor = '#c53030'; }
  else if (balance.balance < 0) { statusText = 'بستانکار'; statusColor = '#2d8659'; }

  const html = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>گزارش مالی ${employer.name} - ${reportDate}</title>
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
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 3px solid #0080ff;
    }
    .header h1 {
      font-size: 24px;
      color: #0080ff;
      margin-bottom: 8px;
    }
    .header .subtitle {
      font-size: 13px;
      color: #666;
    }
    .section {
      margin-bottom: 28px;
    }
    .section-title {
      font-size: 15px;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid #e0e0e0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 16px;
      background: #0080ff;
      border-radius: 2px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .info-card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px 16px;
      background: #fafafa;
    }
    .info-card .label {
      font-size: 11px;
      color: #666;
      margin-bottom: 4px;
    }
    .info-card .value {
      font-size: 16px;
      font-weight: bold;
      font-variant-numeric: tabular-nums;
    }
    .info-card .value.success { color: #2d8659; }
    .info-card .value.danger { color: #c53030; }
    .info-card .value.purple { color: #6554c0; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th {
      background: #0080ff;
      color: white;
      padding: 10px 8px;
      text-align: right;
      font-weight: bold;
    }
    th.center { text-align: center; }
    th.left { text-align: left; }
    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
      color: white;
      background: ${statusColor};
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      font-size: 10px;
      color: #999;
    }
    @media print {
      body { padding: 16px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>گزارش مالی کارفرما</h1>
    <div class="subtitle">
      <strong>${employer.name}</strong>
      ${employer.phone ? ` · ${toPersianDigits(employer.phone)}` : ''}
    </div>
    <div class="subtitle" style="margin-top: 4px;">
      تاریخ گزارش: ${reportDate} · بازه: ${periodLabel}
    </div>
  </div>

  <div class="section">
    <div class="section-title">خلاصه تراز</div>
    <div class="info-grid">
      <div class="info-card">
        <div class="label">مجموع بدهی (پروژه‌ها)</div>
        <div class="value">${formatToman(balance.totalDebt)}</div>
      </div>
      <div class="info-card">
        <div class="label">مجموع دریافتی (کل)</div>
        <div class="value success">${formatToman(balance.totalReceived)}</div>
      </div>
      <div class="info-card">
        <div class="label">دریافتی در بازه انتخاب‌شده</div>
        <div class="value success">${formatToman(totalReceivedInPeriod)}</div>
      </div>
      <div class="info-card">
        <div class="label">علی‌الحساب</div>
        <div class="value purple">${formatToman(balance.totalCredit)}</div>
      </div>
      <div class="info-card">
        <div class="label">تراز خالص</div>
        <div class="value ${balance.balance > 0 ? 'danger' : balance.balance < 0 ? 'success' : ''}">${formatToman(balance.balance)}</div>
      </div>
      <div class="info-card">
        <div class="label">وضعیت</div>
        <div class="value"><span class="status-badge">${statusText}</span></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">پروژه‌ها (${toPersianDigits(projects.length)} مورد)</div>
    ${projects.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>عنوان پروژه</th>
            <th class="left">مبلغ</th>
            <th class="left">دریافتی</th>
            <th class="center">پیشرفت</th>
            <th class="center">وضعیت</th>
          </tr>
        </thead>
        <tbody>
          ${projectsHtml}
        </tbody>
      </table>
    ` : '<p style="color: #888; padding: 12px;">پروژه‌ای ثبت نشده</p>'}
  </div>

  <div class="section">
    <div class="section-title">ریز پرداختی‌ها (${toPersianDigits(receipts.length)} مورد در بازه)</div>
    ${receiptsHtml}
  </div>

  <div class="footer">
    این گزارش توسط اپ مدیریت مالی پروژه‌های شخصی تولید شده · ${reportDate}
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
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
