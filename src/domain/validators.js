// src/domain/validators.js
// اعتبارسنجی موجودیت‌ها — فاز 3 PRD

export const AVATAR_COLORS = ['brand', 'cta', 'purple', 'cyan', 'pink', 'success', 'warning', 'info'];

export const PROJECT_COLORS = ['brand', 'cta', 'purple', 'cyan', 'pink', 'success', 'warning', 'info'];

export const PROJECT_STATUSES = ['active', 'completed', 'archived'];

export const PROJECT_STATUS_LABELS = {
  active: 'فعال',
  completed: 'تکمیل‌شده',
  archived: 'بایگانی‌شده'
};

export const PROJECT_STATUS_COLORS = {
  active: 'warning',      // آبی/زرد
  completed: 'success',   // سبز
  archived: 'fg-muted'    // خاکستری
};

export const validators = {
  employer: {
    name: (v) => typeof v === 'string' && v.trim().length >= 2 && v.trim().length <= 100,
    phone: (v) => !v || /^(\+98|0)?9\d{9}$/.test(v.replace(/[\s-]/g, '')),
    note: (v) => !v || (typeof v === 'string' && v.length <= 500),
    avatarColor: (v) => !v || AVATAR_COLORS.includes(v)
  },

  partner: {
    name: (v) => typeof v === 'string' && v.trim().length >= 2 && v.trim().length <= 100,
    phone: (v) => !v || /^(\+98|0)?9\d{9}$/.test(v.replace(/[\s-]/g, '')),
    email: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    note: (v) => !v || (typeof v === 'string' && v.length <= 500),
    avatarColor: (v) => !v || AVATAR_COLORS.includes(v)
  },

  project: {
    title: (v) => typeof v === 'string' && v.trim().length >= 2 && v.trim().length <= 200,
    employerId: (v) => !!v,
    amount: (v) => Number.isInteger(v) && v > 0,
    amountType: (v) => ['fixed_start', 'fixed_end'].includes(v),
    startDate: (v) => !!v,
    endDate: (v, all) => {
      if (!v) return true;
      if (!all.startDate) return true;
      return new Date(v) >= new Date(all.startDate);
    },
    status: (v) => PROJECT_STATUSES.includes(v),
    color: (v) => !v || PROJECT_COLORS.includes(v),
    note: (v) => !v || (typeof v === 'string' && v.length <= 500)
  },

  projectShare: {
    projectId: (v) => !!v,
    partnerId: (v) => !!v,
    percentage: (v) => typeof v === 'number' && v >= 0 && v <= 100
  },

  tag: {
    name: (v) => typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= 30,
    color: (v) => !v || AVATAR_COLORS.includes(v)
  },

  receipt: {
    employerId: (v) => !!v,
    receiverPartnerId: (v) => !!v,
    amount: (v) => Number.isInteger(v) && v > 0,
    date: (v) => !!v,
    note: (v) => !v || (typeof v === 'string' && v.length <= 500)
  },

  expense: {
    projectId: (v) => !!v,
    title: (v) => typeof v === 'string' && v.trim().length >= 2 && v.trim().length <= 200,
    amount: (v) => Number.isInteger(v) && v > 0,
    paidByPartnerId: (v) => !!v,
    date: (v) => !!v,
    note: (v) => !v || (typeof v === 'string' && v.length <= 500)
  },

  partnerTransfer: {
    fromPartnerId: (v) => !!v,
    toPartnerId: (v, all) => !!v && v !== all.fromPartnerId,
    amount: (v) => Number.isInteger(v) && v > 0,
    date: (v) => !!v,
    note: (v) => !v || (typeof v === 'string' && v.length <= 500)
  },

  dailyActivity: {
    date: (v) => !!v,
    projectId: (v) => !!v,
    partnerId: (v) => !!v,
    startTime: (v) => /^\d{2}:\d{2}$/.test(v),
    endTime: (v, all) => /^\d{2}:\d{2}$/.test(v),
    note: (v) => !v || (typeof v === 'string' && v.length <= 500)
  },

  equipment: {
    name: (v) => typeof v === 'string' && v.trim().length >= 2 && v.trim().length <= 100,
    ownerPartnerId: (v) => !!v,
    amount: (v) => !v || (Number.isInteger(v) && v > 0),
    note: (v) => !v || (typeof v === 'string' && v.length <= 500)
  }
};

// اعتبارسنجی یک موجودیت کامل
export function validate(entityType, data) {
  const entityValidators = validators[entityType];
  if (!entityValidators) return { valid: true, errors: {} };

  const errors = {};
  for (const [field, validator] of Object.entries(entityValidators)) {
    try {
      if (!validator(data[field], data)) {
        errors[field] = 'invalid';
      }
    } catch (e) {
      errors[field] = 'invalid';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

// اعتبارسنجی جمع سهم شرکا = 100
export function validateSharesSum(shares) {
  if (!shares || shares.length === 0) return false;
  const sum = shares.reduce((s, share) => s + Number(share.percentage || 0), 0);
  return Math.abs(sum - 100) < 0.01;
}

// اعتبارسنجی جمع توزیع سهم هزینه = مبلغ
export function validateExpenseShareSum(amount, shareDistribution) {
  if (!shareDistribution || shareDistribution.length === 0) return false;
  const sum = shareDistribution.reduce((s, share) => s + Number(share.amount || 0), 0);
  return sum === amount;
}
