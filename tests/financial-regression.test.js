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
      id: 'x1', projectId: 'pr1', paidByPartnerId: 'p1', amount: 200,
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
  assert.equal(result.netPosition, 130);
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

test('integrity check detects over-allocation and a completed project balance', () => {
  const data = validData();
  data.projects[0].status = 'completed';
  data.receiptAllocations[0].amount = 1200;
  const result = runIntegrityChecks(data);
  assert.ok(result.findings.some(item => item.code === 'receipt-overallocated'));
  assert.ok(!result.findings.some(item => item.code === 'completed-project-balance'));
});

test('integrity check detects missing references and inconsistent shares', () => {
  const data = validData();
  data.projects[0].employerId = 'missing-employer';
  data.projectShares[0].percentage = 70;
  const result = runIntegrityChecks(data);
  assert.ok(result.findings.some(item => item.code === 'project-missing-employer'));
  assert.ok(result.findings.some(item => item.code === 'project-share-total-mismatch'));
});
