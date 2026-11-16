// src/domain/allocation.js
// الگوریتم تخصیص دریافتی چندپروژه‌ای — فاز 5 PRD

import { getProjectRemaining } from './calculations.js';

// پیشنهاد تخصیص به نسبت بدهی باقیمانده
export function suggestAllocation(receiptAmount, projectDebts, options = {}) {
  const { includeCredits = false, employerCredit = 0 } = options;

  // فیلتر پروژه‌هایی که بدهی دارند (یا اعتبار قابل استفاده)
  const eligible = projectDebts.filter(p => p.remaining > 0);
  const totalDebt = eligible.reduce((s, p) => s + p.remaining, 0);

  // اگر هیچ بدهی‌ای وجود ندارد، همه به علی‌الحساب
  if (totalDebt === 0) {
    return {
      allocations: [],
      surplus: receiptAmount,
      surplusReason: 'no_debt'
    };
  }

  // اگر مبلغ دریافتی بزرگ‌تر مساوی کل بدهی + اعتبار قبلی
  const availableForAllocation = receiptAmount;
  if (availableForAllocation >= totalDebt) {
    // همه پروژه‌ها کامل تسویه، مازاد → علی‌الحساب
    return {
      allocations: eligible.map(p => ({
        projectId: p.id,
        amount: p.remaining,
        maxAmount: p.remaining
      })),
      surplus: availableForAllocation - totalDebt,
      surplusReason: availableForAllocation > totalDebt ? 'overpaid' : 'exact'
    };
  }

  // تخصیص به نسبت بدهی
  const allocations = eligible.map(p => ({
    projectId: p.id,
    amount: Math.floor((p.remaining / totalDebt) * availableForAllocation),
    maxAmount: p.remaining
  }));

  // اصلاح خطای گرد کردن: تفاضل به اولین پروژه اضافه شود
  const allocated = allocations.reduce((s, a) => s + a.amount, 0);
  const diff = availableForAllocation - allocated;
  if (diff !== 0 && allocations.length > 0) {
    allocations[0].amount += diff;
  }

  return {
    allocations,
    surplus: 0,
    surplusReason: 'allocated'
  };
}

// اعتبارسنجی تخصیص دستی کاربر
export function validateManualAllocation(receiptAmount, allocations, projectDebts, employerCredit = 0) {
  const errors = [];

  // جمع تخصیص‌ها
  const totalAllocated = allocations.reduce((s, a) => s + (a.amount || 0), 0);

  // هر تخصیص نباید از بدهی پروژه بیشتر باشد (مگر با اعتبار)
  for (const alloc of allocations) {
    if (alloc.amount < 0) {
      errors.push({ projectId: alloc.projectId, message: 'مبلغ منفی مجاز نیست' });
    }
    const projectDebt = projectDebts.find(p => p.id === alloc.projectId);
    if (projectDebt && alloc.amount > projectDebt.remaining) {
      errors.push({
        projectId: alloc.projectId,
        message: `مبلغ تخصیص (${alloc.amount}) بیش از بدهی پروژه (${projectDebt.remaining}) است`
      });
    }
  }

  // جمع تخصیص نباید از مبلغ دریافتی + اعتبار بیشتر شود
  if (totalAllocated > receiptAmount + employerCredit) {
    errors.push({ message: 'جمع تخصیص‌ها بیش از مبلغ دریافتی است' });
  }

  // مازاد
  const surplus = receiptAmount - totalAllocated;

  return {
    valid: errors.length === 0,
    errors,
    surplus: surplus > 0 ? surplus : 0,
    shortfall: surplus < 0 ? -surplus : 0
  };
}

// پیشنهاد سهم هزینه بر اساس درصد سهم شرکا در پروژه
export function suggestExpenseShare(expenseAmount, projectShares) {
  if (!projectShares || projectShares.length === 0) return [];

  const shares = projectShares.map(s => ({
    partnerId: s.partnerId,
    amount: Math.floor(expenseAmount * s.percentage / 100)
  }));

  // اصلاح خطای گرد کردن: تفاضل به پرداخت‌کننده اضافه شود
  // (پرداخت‌کننده در فرم مشخص می‌شود، اینجا فقط پیشنهاد کلی)
  const allocated = shares.reduce((s, sh) => s + sh.amount, 0);
  const diff = expenseAmount - allocated;
  if (diff !== 0 && shares.length > 0) {
    shares[0].amount += diff;
  }

  return shares;
}
