import test from 'node:test';
import assert from 'node:assert/strict';
import { runIntegrityChecks } from '../src/domain/integrity.js';
import {
  getEmployerBalance,
  getPartnerBalance,
  getProjectRemaining,
  getCashFlow
} from '../src/domain/calculations.js';

function validData() {
  return {
    employers: [{ id: 'e1', name: 'کارفرما' }],
    partners: [{ id: 'p1', name: 'شریک اول' }, { id: 'p2', name: 'شریک دوم' }],
    projects: [{ id: 'pr1', employerId: 'e1', amount: 1000, status: 'active' }],
    projectShares: [
      { id: 's1', projectId: 'pr1', partnerId: 'p1', percentage: 60 },
      { id: 's2', projectId: 'pr1', partnerId: 'p2', percentage: 40 }
    ],
    receipts: [{ id: 'r1', employerId: 'e1', receiverPartnerId: 'p1', amount: 600, date: '2026-11-10' }],
    receiptAllocations: [{ id: 'a1', receiptId: 'r1', projectId: 'pr1', amount: 600 }],
    expenses: [{
      id: 'x1', projectId: 'pr1', paidByPartnerId: 'p1', amount: 200, date: '2026-11-12',
      shareDistribution: [{ partnerId: 'p1', amount: 120 }, { partnerId: 'p2', amount: 80 }]
    }],
    partnerTransfers: [{ id: 't1', fromPartnerId: 'p1', toPartnerId: 'p2', amount: 50, date: '2026-11-11' }],
    dailyActivities: [],
    equipment: []
  };
}

test('financial calculations preserve employer and project balances', () => {
  const data = validData();
  assert.equal(getEmployerBalance('e1', data).balance, 400);
  assert.equal(getProjectRemaining('pr1', data), 400);
});

test('partner balance includes expense shares and partner transfers', () => {
  const result = getPartnerBalance('p1', validData());
  assert.equal(result.expectedShare, 600);
  assert.equal(result.actualReceivedFromEmployers, 600);
  assert.equal(result.paidForOthers, 80);
  assert.equal(result.transferredOut, 50);
  assert.equal(result.netPosition, 80);
  assert.equal(result.projectTransferredOut, 50);
  assert.equal(result.expenseTransferredOut, 0);
});

test('partner settlement positions are opposite for a two-partner project', () => {
  const data = validData();
  const first = getPartnerBalance('p1', data);
  const second = getPartnerBalance('p2', data);

  assert.equal(first.allocatedReceivedFromEmployers, 600);
  assert.equal(first.collectedShare, 360);
  assert.equal(first.shareDifference, 240);
  assert.equal(first.netClaimFromExpenses, 80);
  assert.equal(first.netTransfer, -50);
  assert.equal(first.overallPosition, 110);

  assert.equal(second.allocatedReceivedFromEmployers, 0);
  assert.equal(second.collectedShare, 240);
  assert.equal(second.shareDifference, -240);
  assert.equal(second.netClaimFromExpenses, -80);
  assert.equal(second.netTransfer, 50);
  assert.equal(second.overallPosition, -110);

  assert.equal(first.overallPosition + second.overallPosition, 0);
});

test('partner balance ignores soft-deleted expenses and transfers', () => {
  const data = validData();
  data.expenses.push({
    id: 'x-deleted', projectId: 'pr1', paidByPartnerId: 'p1',
    amount: 900, date: '2026-11-12', deletedAt: '2026-11-13',
    shareDistribution: [{ partnerId: 'p1', amount: 100 }, { partnerId: 'p2', amount: 800 }]
  });
  data.partnerTransfers.push({
    id: 't-deleted', fromPartnerId: 'p1', toPartnerId: 'p2',
    amount: 700, date: '2026-11-12', deletedAt: '2026-11-13'
  });

  const result = getPartnerBalance('p1', data);
  assert.equal(result.paidForOthers, 80);
  assert.equal(result.transferredOut, 50);
  assert.equal(result.netPosition, 80);
});

test('partner balance flags shares linked to projects with unknown amounts', () => {
  const data = validData();
  data.projects.push({
    id: 'pr-unknown', employerId: 'e1', amountUndetermined: true, status: 'active'
  });
  data.projectShares.push({
    id: 's-unknown', projectId: 'pr-unknown', partnerId: 'p1', percentage: 25
  });

  const result = getPartnerBalance('p1', data);
  assert.equal(result.hasUnknownProjectAmounts, true);
  assert.equal(result.unknownProjectCount, 1);
  assert.equal(result.expectedShare, 600);
});

test('cash flow includes receipts and expenses within the selected date range', () => {
  const data = validData();
  const result = getCashFlow('2026-11-01', '2026-11-30', data);
  assert.equal(result.inflow, 600);
  assert.equal(result.outflow, 200);
  assert.equal(result.receiptsCount, 1);
  assert.equal(result.expensesCount, 1);
});

test('integrity check reports no issues for a consistent data set', () => {
  const result = runIntegrityChecks(validData());
  assert.deepEqual(result.summary, { errors: 0, warnings: 0, total: 0 });
});

test('integrity check detects receipt over-allocation', () => {
  const data = validData();
  data.receiptAllocations[0].amount = 1200;
  const result = runIntegrityChecks(data);
  assert.ok(result.findings.some(item => item.code === 'receipt-overallocated'));
});

test('integrity check detects a completed project with an outstanding balance', () => {
  const data = validData();
  data.projects[0].status = 'completed';
  const result = runIntegrityChecks(data);
  assert.ok(result.findings.some(item => item.code === 'completed-project-balance'));
});

test('integrity check detects missing references and inconsistent shares', () => {
  const data = validData();
  data.projects[0].employerId = 'missing-employer';
  data.projectShares[0].percentage = 70;
  const result = runIntegrityChecks(data);
  assert.ok(result.findings.some(item => item.code === 'project-missing-employer'));
  assert.ok(result.findings.some(item => item.code === 'project-share-total-mismatch'));
});


test('project and expense transfers affect only their own settlement category', () => {
  const data = validData();
  data.partnerTransfers = [
    { id: 'tp', fromPartnerId: 'p1', toPartnerId: 'p2', amount: 50, date: '2026-11-11', purpose: 'project_settlement' },
    { id: 'te', fromPartnerId: 'p1', toPartnerId: 'p2', amount: 30, date: '2026-11-12', purpose: 'expense_settlement' }
  ];
  const first = getPartnerBalance('p1', data);
  const second = getPartnerBalance('p2', data);
  assert.equal(first.projectTransferredOut, 50);
  assert.equal(first.expenseTransferredOut, 30);
  assert.equal(first.projectSettlementPosition, 190);
  assert.equal(first.expenseSettlementPosition, -110);
  assert.equal(first.overallPosition, 80);
  assert.equal(second.expenseSettlementPosition, 110);
  assert.equal(second.overallPosition, -80);
  assert.equal(first.overallPosition + second.overallPosition, 0);
});

test('legacy transfers without purpose remain project settlement transfers', () => {
  const result = getPartnerBalance('p1', validData());
  assert.equal(result.projectTransferredOut, 50);
  assert.equal(result.expenseTransferredOut, 0);
});
