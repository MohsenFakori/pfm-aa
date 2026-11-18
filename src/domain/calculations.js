// src/domain/calculations.js
// محاسبات تراز و گزارش‌ها — فاز 5 و 6 PRD

import { repo } from '../core/repository.js';

// === کش محاسبات ===
// برای جلوگیری از محاسبه مجدد ترازها در هر رندر، نتایج توابع پراستفاده کش می‌شود.
// هر تغییری در داده‌ها (updateEntity/removeEntity در state.js) کش را پاک می‌کند.
const _cache = new Map();

export function clearCalcCache() {
  _cache.clear();
}

// فقط وقتی data پاس داده نشده (یعنی از state پیش‌فرض استفاده می‌کنیم) کش می‌کنیم.
// در صورت پاس دادن data سفارشی، محاسبه مستقیم انجام می‌شود.
function cached(key, useCache, fn) {
  if (!useCache) return fn();
  if (_cache.has(key)) {
    // clone عمیق برای جلوگیری از mutate شدن کش توسط فراخوان
    return JSON.parse(JSON.stringify(_cache.get(key)));
  }
  const result = fn();
  const snapshot = JSON.parse(JSON.stringify(result));
  _cache.set(key, snapshot);
  return JSON.parse(JSON.stringify(snapshot));
}

// === تراز کارفرما ===
// تراز = بدهی - دریافتی
// مثبت = کارفرما بدهکار، منفی = کارفرما بستانکار (علی‌الحساب دارد)
// totalCredit = مبلغ علی‌الحساب (مازاد دریافتی‌های قبلی که به پروژه‌ای تخصیص نیافته‌اند)
export function getEmployerBalance(employerId, data = null) {
  const useCache = !data;
  return cached(`employer:${employerId}`, useCache, () => {
  const state = data || (window.__state && window.__state.data) || { projects: [], receipts: [], receiptAllocations: [], employerCredits: [] };

  // بایگانی صرفاً وضعیت مدیریتی است؛ تا وقتی پروژه حذف نشده، بدهی آن در تراز باقی می‌ماند.
  // مبلغ پروژه‌های نامشخص وارد جمع عددی نمی‌شود و وضعیت تراز را نامطمئن می‌کند.
  const projects = (state.projects || []).filter(p =>
    p.employerId === employerId && !p.deletedAt
  );
  const unknownProjects = projects.filter(p => p.amountUndetermined === true || p.amount == null);
  const totalDebt = projects.reduce((sum, p) => {
    if (p.amountUndetermined === true || p.amount == null) return sum;
    return sum + Number(p.amount || 0);
  }, 0);

  // مجموع دریافتی = مبلغ همه receiptهای این کارفرما
  const receipts = (state.receipts || []).filter(r =>
    r.employerId === employerId && !r.deletedAt
  );
  const totalReceived = receipts.reduce((s, r) => s + (r.amount || 0), 0);

  // علی‌الحساب کارفرما = مجموع مبالغ دریافتی منهای تخصیص‌های انجام‌شده به پروژه‌ها
  // این محاسبه دقیق‌تر از employerCredits است چون همه receiptها را در نظر می‌گیرد
  const allAllocationsForEmployer = (state.receiptAllocations || []).filter(a => {
    if (!a.amount) return false;
    const receipt = (state.receipts || []).find(r => r.id === a.receiptId);
    return receipt && !receipt.deletedAt && receipt.employerId === employerId;
  });
  const totalAllocated = allAllocationsForEmployer.reduce((s, a) => s + (a.amount || 0), 0);

  // علی‌الحساب = دریافتی - تخصیص‌شده (اگر مثبت باشد)
  const totalCredit = Math.max(0, totalReceived - totalAllocated);

  // تراز خالص = بدهی - (دریافتی) — اما چون علی‌الحساب هم برای تسویه پروژه‌ها قابل استفاده است
  // در واقع balance = totalDebt - totalReceived (چون totalReceived شامل علی‌الحساب هم هست)
  const balance = totalDebt - totalReceived;

  let status = 'settled';
  if (balance > 0) status = 'debtor';
  else if (balance < 0) status = 'creditor';
  if (unknownProjects.length > 0) status = 'uncertain';

  return {
    totalDebt,
    totalReceived,
    totalCredit,
    balance,
    status,
    unknownProjectCount: unknownProjects.length,
    hasUnknownProjectAmounts: unknownProjects.length > 0
  };
  });
}

// === بدهی باقیمانده یک پروژه ===
export function getProjectRemaining(projectId, data = null) {
  const useCache = !data;
  return cached(`projectRemaining:${projectId}`, useCache, () => {
  const state = data || (window.__state && window.__state.data) || { projects: [], receipts: [], receiptAllocations: [] };

  const project = (state.projects || []).find(p => p.id === projectId);
  if (!project) return 0;

  const allocations = (state.receiptAllocations || []).filter(a => {
    if (a.projectId !== projectId) return false;
    const receipt = (state.receipts || []).find(r => r.id === a.receiptId);
    return receipt && !receipt.deletedAt;
  });

  const received = allocations.reduce((s, a) => s + (a.amount || 0), 0);
  return Math.max(0, project.amount - received);
  });
}

// === مجموع دریافتی یک پروژه ===
export function getProjectReceived(projectId, data = null) {
  const useCache = !data;
  return cached(`projectReceived:${projectId}`, useCache, () => {
  const state = data || (window.__state && window.__state.data) || { receipts: [], receiptAllocations: [] };

  const allocations = (state.receiptAllocations || []).filter(a => {
    if (a.projectId !== projectId) return false;
    const receipt = (state.receipts || []).find(r => r.id === a.receiptId);
    return receipt && !receipt.deletedAt;
  });

  return allocations.reduce((s, a) => s + (a.amount || 0), 0);
  });
}

// === درصد تسویه یک پروژه ===
export function getProjectProgressPercent(projectId, data = null) {
  const state = data || (window.__state && window.__state.data) || { projects: [] };
  const project = (state.projects || []).find(p => p.id === projectId);
  if (!project || !project.amount) return 0;

  const received = getProjectReceived(projectId, state);
  return Math.min(100, Math.round((received / project.amount) * 100));
}

// === تراز شریک ===
// هزینه‌ها از درآمد کم نمی‌شوند — فقط طلب/بدهی بین شرکا ایجاد می‌کنند
// انتقال‌ها نیز طلب/بدهی را تسویه می‌کنند (نه ایجاد می‌کنند)
//
// طلب از هزینه‌ها = مبلغی که برای دیگران پرداخته (paidForOthers)
// بدهی از هزینه‌ها = سهم خودش از هزینه‌های دیگران (owedToOthers)
// طلب خالص از هزینه‌ها = paidForOthers - owedToOthers
//
// انتقال دریافتی = پولی که از شرکا گرفته (طلبی را تسویه می‌کند یا بدهی ایجاد می‌کند)
// انتقال پرداختی = پولی که به شرکا داده (بدهی را تسویه می‌کند یا طلب ایجاد می‌کند)
// انتقال خالص = transferredIn - transferredOut (مثبت = پول دریافت کرده)
//
// وضعیت نهایی = طلب خالص از هزینه‌ها - انتقال خالص دریافتی
// مثبت = طلبکار (بیشتر پرداخته تا دریافتی)
// منفی = بدهکار (بیشتر دریافت کرده تا پرداخته)
// صفر = تسویه
export function getPartnerBalance(partnerId, data = null) {
  const useCache = !data;
  return cached(`partner:${partnerId}`, useCache, () => {
  const state = data || (window.__state && window.__state.data) || {
    projects: [], projectShares: [], receipts: [], expenses: [],
    partnerTransfers: []
  };

  // سهم انتظاری از پروژه‌ها؛ پروژه‌های با مبلغ نامشخص نباید صفر فرض شوند.
  const shares = (state.projectShares || []).filter(s => s.partnerId === partnerId);
  const unknownProjectIds = [...new Set(shares.reduce((ids, share) => {
    const project = (state.projects || []).find(p => p.id === share.projectId);
    if (!project || project.deletedAt || project.status === 'archived') return ids;
    if (project.amountUndetermined === true || project.amount == null) ids.push(project.id);
    return ids;
  }, []))];
  const expectedShare = shares.reduce((s, share) => {
    const project = (state.projects || []).find(p => p.id === share.projectId);
    if (!project || project.deletedAt || project.status === 'archived') return s;
    if (project.amountUndetermined === true || project.amount == null) return s;
    return s + Math.round(project.amount * share.percentage / 100);
  }, 0);

  // دریافتی از کارفرماها
  const receipts = (state.receipts || []).filter(r =>
    r.receiverPartnerId === partnerId && !r.deletedAt
  );
  const actualReceivedFromEmployers = receipts.reduce((s, r) => s + (r.amount || 0), 0);

  // هزینه‌ها: طلب/بدهی بین شرکا
  const allExpenses = (state.expenses || []).filter(e => !e.deletedAt);
  let paidForOthers = 0;   // طلب: برای دیگران پرداخته
  let owedToOthers = 0;    // بدهی: به دیگران بدهکار

  for (const expense of allExpenses) {
    const myShare = (expense.shareDistribution || []).find(s => s.partnerId === partnerId);
    const myShareAmount = myShare ? myShare.amount : 0;

    if (expense.paidByPartnerId === partnerId) {
      paidForOthers += (expense.amount - myShareAmount);
    } else {
      owedToOthers += myShareAmount;
    }
  }

  // طلب خالص از هزینه‌ها (مثبت = دیگران به من بدهکار)
  const netClaimFromExpenses = paidForOthers - owedToOthers;

  // انتقال‌ها
  const transferredIn = (state.partnerTransfers || [])
    .filter(t => t.toPartnerId === partnerId && !t.deletedAt)
    .reduce((s, t) => s + (t.amount || 0), 0);
  const transferredOut = (state.partnerTransfers || [])
    .filter(t => t.fromPartnerId === partnerId && !t.deletedAt)
    .reduce((s, t) => s + (t.amount || 0), 0);

  // انتقال خالص (مثبت = پول دریافت کرده)
  const netTransfer = transferredIn - transferredOut;

  // وضعیت نهایی:
  // طلب از هزینه‌ها - پول دریافتی از انتقال
  // مثبت = طلبکار (بیشتر برای دیگران خرج کرده تا پول گرفته)
  // منفی = بدهکار (بیشتر پول گرفته تا برای دیگران خرج کرده)
  // صفر = تسویه
  const netPosition = netClaimFromExpenses - netTransfer;

  // تراز در برابر سهم انتظاری
  const difference = actualReceivedFromEmployers + netPosition - expectedShare;

  let status = 'even';
  if (netPosition > 0) status = 'creditor';
  else if (netPosition < 0) status = 'debtor';

  return {
    expectedShare,
    unknownProjectCount: unknownProjectIds.length,
    hasUnknownProjectAmounts: unknownProjectIds.length > 0,
    actualReceivedFromEmployers,
    paidForOthers,
    owedToOthers,
    netClaimFromExpenses,
    transferredIn,
    transferredOut,
    netTransfer,
    netPosition,
    difference,
    status
  };
  });
}

// === تمام رویدادهای مالی یک شریک (timeline) ===
export function getPartnerTimeline(partnerId, data = null) {
  const state = data || (window.__state && window.__state.data) || {
    receipts: [], expenses: [], partnerTransfers: [], projects: [], receiptAllocations: []
  };
  const timeline = [];

  // دریافتی‌ها از کارفرماها
  for (const receipt of (state.receipts || [])) {
    if (receipt.deletedAt) continue;
    if (receipt.receiverPartnerId !== partnerId) continue;

    const allocations = (state.receiptAllocations || []).filter(a => a.receiptId === receipt.id);
    const employer = (state.employers || []).find(e => e.id === receipt.employerId);

    timeline.push({
      id: receipt.id,
      type: 'receipt',
      amount: receipt.amount,
      date: receipt.date,
      label: `دریافتی از ${employer ? employer.name : 'کارفرما'}`,
      detail: `${allocations.length} پروژه`,
      isInflow: true
    });
  }

  // هزینه‌هایی که پرداخت کرده
  for (const expense of (state.expenses || [])) {
    if (expense.deletedAt) continue;
    if (expense.paidByPartnerId !== partnerId) continue;

    const project = (state.projects || []).find(p => p.id === expense.projectId);

    timeline.push({
      id: expense.id,
      type: 'expense_paid',
      amount: expense.amount,
      date: expense.date,
      label: `پرداخت هزینه: ${expense.title}`,
      detail: project ? project.title : '',
      isInflow: false,
      isInfo: true
    });
  }

  // سهم شریک از هزینه‌های دیگران
  for (const expense of (state.expenses || [])) {
    if (expense.deletedAt) continue;
    if (expense.paidByPartnerId === partnerId) continue;

    const myShare = (expense.shareDistribution || []).find(s => s.partnerId === partnerId);
    if (!myShare || myShare.amount === 0) continue;

    const project = (state.projects || []).find(p => p.id === expense.projectId);
    const payer = (state.partners || []).find(p => p.id === expense.paidByPartnerId);

    timeline.push({
      id: expense.id + '_share',
      type: 'expense_share',
      amount: myShare.amount,
      date: expense.date,
      label: `سهم از هزینه: ${expense.title}`,
      detail: `${project ? project.title : ''} · پرداخت توسط ${payer ? payer.name : 'شریک'}`,
      isInflow: false,
      isOwed: true
    });
  }

  // انتقال‌های ورودی
  for (const transfer of (state.partnerTransfers || [])) {
    if (transfer.deletedAt) continue;
    if (transfer.toPartnerId !== partnerId) continue;

    const fromPartner = (state.partners || []).find(p => p.id === transfer.fromPartnerId);

    timeline.push({
      id: transfer.id + '_in',
      type: 'transfer_in',
      amount: transfer.amount,
      date: transfer.date,
      label: `انتقال دریافتی`,
      detail: `از ${fromPartner ? fromPartner.name : 'شریک'}`,
      isInflow: true
    });
  }

  // انتقال‌های خروجی
  for (const transfer of (state.partnerTransfers || [])) {
    if (transfer.deletedAt) continue;
    if (transfer.fromPartnerId !== partnerId) continue;

    const toPartner = (state.partners || []).find(p => p.id === transfer.toPartnerId);

    timeline.push({
      id: transfer.id + '_out',
      type: 'transfer_out',
      amount: transfer.amount,
      date: transfer.date,
      label: `انتقال به ${toPartner ? toPartner.name : 'شریک'}`,
      detail: '',
      isInflow: false
    });
  }

  // sort by date desc
  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  return timeline;
}

// === خلاصه داشبورد ===
export function getDashboardSummary(data = null) {
  const state = data || (window.__state && window.__state.data) || {
    projects: [], receipts: [], expenses: [], employers: [], partners: []
  };

  const allProjects = (state.projects || []).filter(p => !p.deletedAt);
  const knownAmountProjects = allProjects.filter(p => p.amountUndetermined !== true && p.amount != null);
  const activeProjects = allProjects.filter(p => p.status === 'active');

  // جمع مالی همه پروژه‌های حذف‌نشده، مستقل از وضعیت فعال/تکمیل/بایگانی
  const totalExpected = knownAmountProjects.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalReceived = knownAmountProjects.reduce((s, p) => s + getProjectReceived(p.id, state), 0);
  const totalRemaining = totalExpected - totalReceived;
  const unknownProjectCount = allProjects.filter(p => p.amountUndetermined === true || p.amount == null).length;

  // ماه جاری شمسی — برای سادگی از ماه میلادی استفاده می‌کنیم
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthReceipts = (state.receipts || []).filter(r =>
    !r.deletedAt && new Date(r.date) >= monthStart
  );
  const monthInflow = monthReceipts.reduce((s, r) => s + (r.amount || 0), 0);

  const monthExpenses = (state.expenses || []).filter(e =>
    !e.deletedAt && new Date(e.date) >= monthStart
  );
  const monthOutflow = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  // بدهکاران برتر
  const debtors = (state.employers || [])
    .filter(e => !e.deletedAt)
    .map(e => ({ employer: e, ...getEmployerBalance(e.id, state) }))
    .filter(b => b.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  return {
    totalExpected,
    totalReceived,
    totalRemaining,
    unknownProjectCount,
    activeProjectsCount: activeProjects.length,
    monthInflow,
    monthOutflow,
    monthNet: monthInflow - monthOutflow,
    debtors: debtors.slice(0, 3),
    allDebtorsCount: debtors.length
  };
}

// === جریان نقدی ===
export function getCashFlow(startDate, endDate, data = null) {
  const state = data || (window.__state && window.__state.data) || { receipts: [], expenses: [] };

  const receipts = (state.receipts || []).filter(r =>
    !r.deletedAt && new Date(r.date) >= new Date(startDate) && new Date(r.date) <= new Date(endDate)
  );
  const expenses = (state.expenses || []).filter(e =>
    !e.deletedAt && new Date(e.date) >= new Date(startDate) && new Date(e.date) <= new Date(endDate)
  );

  return {
    inflow: receipts.reduce((s, r) => s + (r.amount || 0), 0),
    outflow: expenses.reduce((s, e) => s + (e.amount || 0), 0),
    receiptsCount: receipts.length,
    expensesCount: expenses.length
  };
}

// === ریز پرداختی‌های یک کارفرما ===
// تمام receiptهای یک کارفرما به همراه تخصیص هر کدام به پروژه‌ها
export function getEmployerReceipts(employerId, data = null) {
  const state = data || (window.__state && window.__state.data) || { receipts: [], receiptAllocations: [], projects: [], partners: [] };

  const receipts = (state.receipts || []).filter(r =>
    r.employerId === employerId && !r.deletedAt
  );

  return receipts.map(r => {
    const allocations = (state.receiptAllocations || []).filter(a => {
      if (a.receiptId !== r.id) return false;
      // اعتبارسنجی receipt هنوز موجود است
      const receipt = (state.receipts || []).find(rr => rr.id === a.receiptId);
      return receipt && !receipt.deletedAt;
    });

    const allocationDetails = allocations.map(a => {
      const project = (state.projects || []).find(p => p.id === a.projectId);
      return {
        projectId: a.projectId,
        projectName: project ? project.title : 'نامشخص',
        amount: a.amount
      };
    });

    const receiver = (state.partners || []).find(p => p.id === r.receiverPartnerId);
    const totalAllocated = allocations.reduce((s, a) => s + (a.amount || 0), 0);
    const surplus = r.amount - totalAllocated;

    return {
      id: r.id,
      date: r.date,
      amount: r.amount,
      receiverName: receiver ? receiver.name : '—',
      note: r.note || '',
      allocations: allocationDetails,
      totalAllocated,
      surplus: surplus > 0 ? surplus : 0
    };
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}
