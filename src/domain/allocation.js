// src/domain/allocation.js
// الگوریتم تخصیص دریافتی چندپروژه‌ای — فاز 5 PRD

import { getProjectRemaining } from './calculations.js';

// پیشنهاد تخصیص ترتیبی بر اساس ترتیب انتخاب پروژه‌ها
export function suggestAllocation(receiptAmount, projectDebts, options = {}) {
  const eligible = projectDebts.filter(p => p.remaining > 0);
  let remainingAmount = Math.max(0, Number(receiptAmount) || 0);
  const allocations = [];

  for (const project of eligible) {
    const amount = Math.min(project.remaining, remainingAmount);
    allocations.push({ projectId: project.id, amount, maxAmount: project.remaining });
    remainingAmount -= amount;
  }

  return {
    allocations,
    surplus: remainingAmount,
    surplusReason: eligible.length === 0 ? 'no_debt' : remainingAmount > 0 ? 'overpaid' : 'allocated'
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
