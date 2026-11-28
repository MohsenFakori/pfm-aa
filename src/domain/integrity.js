// بررسی فقط‌خواندنی یکپارچگی داده‌های مالی
// این ماژول هیچ رکوردی را تغییر، حذف یا اصلاح نمی‌کند.

const list = (value) => Array.isArray(value) ? value : [];
const active = (value) => list(value).filter(item => item && !item.deletedAt);
const isPositiveInteger = (value) => Number.isSafeInteger(value) && value > 0;

export function runIntegrityChecks(data = {}) {
  const employers = active(data.employers);
  const partners = active(data.partners);
  const projects = active(data.projects);
  const receipts = active(data.receipts);
  const allocations = active(data.receiptAllocations);
  const expenses = active(data.expenses);
  const transfers = active(data.partnerTransfers);
  const projectShares = active(data.projectShares);
  const activities = active(data.dailyActivities);
  const equipment = active(data.equipment);

  const employerIds = new Set(employers.map(item => item.id));
  const partnerIds = new Set(partners.map(item => item.id));
  const projectIds = new Set(projects.map(item => item.id));
  const receiptIds = new Set(receipts.map(item => item.id));
  const receiptById = new Map(receipts.map(item => [item.id, item]));
  const findings = [];

  const add = (severity, code, title, detail, recordId = null) => {
    findings.push({ severity, code, title, detail, recordId });
  };

  const allocationsByReceipt = new Map();
  const allocationsByProject = new Map();
  for (const allocation of allocations) {
    allocationsByReceipt.set(
      allocation.receiptId,
      (allocationsByReceipt.get(allocation.receiptId) || 0) + Number(allocation.amount || 0)
    );
    allocationsByProject.set(
      allocation.projectId,
      (allocationsByProject.get(allocation.projectId) || 0) + Number(allocation.amount || 0)
    );

    if (!receiptIds.has(allocation.receiptId)) {
      add('error', 'allocation-missing-receipt', 'تخصیص بدون دریافتی معتبر', 'یک تخصیص به دریافتی موجود یا فعال متصل نیست.', allocation.id);
    }
    if (!projectIds.has(allocation.projectId)) {
      add('error', 'allocation-missing-project', 'تخصیص بدون پروژه معتبر', 'یک تخصیص به پروژه موجود یا فعال متصل نیست.', allocation.id);
    }
    if (!isPositiveInteger(allocation.amount)) {
      add('error', 'allocation-invalid-amount', 'مبلغ تخصیص نامعتبر', 'مبلغ تخصیص باید عدد صحیح مثبت باشد.', allocation.id);
    }
  }

  for (const project of projects) {
    if (!employerIds.has(project.employerId)) {
      add('error', 'project-missing-employer', 'پروژه بدون کارفرمای معتبر', 'کارفرمای مرتبط با این پروژه پیدا نشد.', project.id);
    }
    if (project.amountUndetermined !== true && project.amount != null && !isPositiveInteger(project.amount)) {
      add('error', 'project-invalid-amount', 'مبلغ پروژه نامعتبر', 'مبلغ مشخص‌شده پروژه باید عدد صحیح مثبت باشد.', project.id);
    }

    const shares = projectShares.filter(share => share.projectId === project.id);
    for (const share of shares) {
      if (!partnerIds.has(share.partnerId)) {
        add('error', 'share-missing-partner', 'سهم با شریک نامعتبر', 'شریک مرتبط با یکی از سهم‌های پروژه پیدا نشد.', share.id);
      }
      if (!Number.isFinite(Number(share.percentage)) || Number(share.percentage) < 0 || Number(share.percentage) > 100) {
        add('error', 'share-invalid-percentage', 'درصد سهم نامعتبر', 'درصد سهم باید بین صفر تا صد باشد.', share.id);
      }
    }
    if (shares.length && shares.every(share => Number.isFinite(Number(share.percentage))) ) {
      const total = shares.reduce((sum, share) => sum + Number(share.percentage || 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        add('warning', 'project-share-total-mismatch', 'مجموع سهم شرکا برابر ۱۰۰٪ نیست', `مجموع درصد سهم‌های این پروژه ${total}٪ است.`, project.id);
      }
    }

    if ((project.status === 'completed' || project.status === 'archived') && project.amountUndetermined !== true && Number.isFinite(Number(project.amount))) {
      const received = allocationsByProject.get(project.id) || 0;
      const remaining = Math.max(0, Number(project.amount) - received);
      if (remaining > 0) {
        add('warning', 'completed-project-balance', 'پروژه تکمیل‌شده با مانده دریافت', `مانده قابل دریافت این پروژه ${remaining} واحد پولی است.`, project.id);
      }
    }
  }

  for (const receipt of receipts) {
    if (!employerIds.has(receipt.employerId)) {
      add('error', 'receipt-missing-employer', 'دریافتی بدون کارفرمای معتبر', 'کارفرمای مرتبط با این دریافتی پیدا نشد.', receipt.id);
    }
    if (receipt.receiverPartnerId && !partnerIds.has(receipt.receiverPartnerId)) {
      add('error', 'receipt-missing-partner', 'دریافتی با دریافت‌کننده نامعتبر', 'شریک دریافت‌کننده این دریافتی پیدا نشد.', receipt.id);
    }
    if (!isPositiveInteger(receipt.amount)) {
      add('error', 'receipt-invalid-amount', 'مبلغ دریافتی نامعتبر', 'مبلغ دریافتی باید عدد صحیح مثبت باشد.', receipt.id);
    }
    const allocated = allocationsByReceipt.get(receipt.id) || 0;
    if (allocated > Number(receipt.amount || 0)) {
      add('error', 'receipt-overallocated', 'تخصیص بیشتر از مبلغ دریافتی', `مجموع تخصیص‌ها ${allocated} و مبلغ دریافتی ${Number(receipt.amount || 0)} است.`, receipt.id);
    }
  }

  for (const expense of expenses) {
    if (!projectIds.has(expense.projectId)) {
      add('error', 'expense-missing-project', 'هزینه بدون پروژه معتبر', 'پروژه مرتبط با این هزینه پیدا نشد.', expense.id);
    }
    if (!partnerIds.has(expense.paidByPartnerId)) {
      add('error', 'expense-missing-payer', 'هزینه با پرداخت‌کننده نامعتبر', 'شریک پرداخت‌کننده این هزینه پیدا نشد.', expense.id);
    }
    if (!isPositiveInteger(expense.amount)) {
      add('error', 'expense-invalid-amount', 'مبلغ هزینه نامعتبر', 'مبلغ هزینه باید عدد صحیح مثبت باشد.', expense.id);
    }
    const distribution = list(expense.shareDistribution);
    for (const share of distribution) {
      if (!partnerIds.has(share.partnerId)) {
        add('error', 'expense-share-missing-partner', 'توزیع هزینه با شریک نامعتبر', 'شریک مرتبط با یکی از سهم‌های هزینه پیدا نشد.', expense.id);
      }
    }
    if (distribution.length) {
      const distributed = distribution.reduce((sum, share) => sum + Number(share.amount || 0), 0);
      if (distributed !== Number(expense.amount)) {
        add('warning', 'expense-share-total-mismatch', 'مجموع سهم هزینه با مبلغ آن برابر نیست', `مجموع سهم‌ها ${distributed} و مبلغ هزینه ${Number(expense.amount || 0)} است.`, expense.id);
      }
    }
  }

  for (const transfer of transfers) {
    if (!partnerIds.has(transfer.fromPartnerId) || !partnerIds.has(transfer.toPartnerId)) {
      add('error', 'transfer-missing-partner', 'انتقال با شریک نامعتبر', 'شریک مبدأ یا مقصد این انتقال پیدا نشد.', transfer.id);
    }
    if (transfer.fromPartnerId === transfer.toPartnerId) {
      add('error', 'transfer-same-partner', 'انتقال بین یک شریک', 'شریک مبدأ و مقصد انتقال یکسان هستند.', transfer.id);
    }
    if (!isPositiveInteger(transfer.amount)) {
      add('error', 'transfer-invalid-amount', 'مبلغ انتقال نامعتبر', 'مبلغ انتقال باید عدد صحیح مثبت باشد.', transfer.id);
    }
  }

  for (const activity of activities) {
    if (!projectIds.has(activity.projectId)) {
      add('warning', 'activity-missing-project', 'فعالیت روزانه با پروژه نامعتبر', 'پروژه مرتبط با این فعالیت پیدا نشد.', activity.id);
    }
    if (!partnerIds.has(activity.partnerId)) {
      add('warning', 'activity-missing-partner', 'فعالیت روزانه با شریک نامعتبر', 'شریک مرتبط با این فعالیت پیدا نشد.', activity.id);
    }
  }

  for (const item of equipment) {
    if (!partnerIds.has(item.ownerPartnerId)) {
      add('warning', 'equipment-missing-owner', 'ابزار بدون مالک معتبر', 'شریک مالک این ابزار پیدا نشد.', item.id);
    }
  }

  const errors = findings.filter(item => item.severity === 'error').length;
  const warnings = findings.filter(item => item.severity === 'warning').length;
  const checkedRecords = employers.length + partners.length + projects.length + receipts.length +
    allocations.length + expenses.length + transfers.length + projectShares.length + activities.length + equipment.length;

  return {
    checkedAt: new Date().toISOString(),
    checkedRecords,
    summary: { errors, warnings, total: findings.length },
    findings
  };
}
