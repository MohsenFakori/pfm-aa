// src/domain/reports.js
// توابع گزارش‌گیری — فاز 9 PRD

import jalaali from 'jalaali-js';
import { state } from '../core/state.js';
import { repo } from '../core/repository.js';
import { storage } from '../core/storage.js';
import { getEmployerBalance, getPartnerBalance, getCashFlow } from './calculations.js';
import { toJalali, toGregorian, getMonthName, toPersianDigits } from '../utils/date.js';

function getState() {
  return (window.__state && window.__state.data) || state.data;
}

function jalaliMonthRange(jy, jm) {
  const startIso = toGregorian({ year: jy, month: jm, day: 1 });
  const start = new Date(startIso);
  start.setHours(0, 0, 0, 0);
  const daysInMonth = jalaali.jalaaliMonthLength(jy, jm);
  const endIso = toGregorian({ year: jy, month: jm, day: daysInMonth });
  const end = new Date(endIso);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function jalaliYearRange(jy) {
  const startIso = toGregorian({ year: jy, month: 1, day: 1 });
  const start = new Date(startIso);
  start.setHours(0, 0, 0, 0);
  const daysInLastMonth = jalaali.jalaaliMonthLength(jy, 12);
  const endIso = toGregorian({ year: jy, month: 12, day: daysInLastMonth });
  const end = new Date(endIso);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export const reports = {
  employerBalances: () => {
    const data = getState();
    const employers = (data.employers || []).filter(e => !e.deletedAt);
    return employers.map(e => ({ employer: e, ...getEmployerBalance(e.id, data) }));
  },

  partnerBalances: () => {
    const data = getState();
    const partners = (data.partners || []).filter(p => !p.deletedAt);
    return partners.map(p => ({ partner: p, ...getPartnerBalance(p.id, data) }));
  },

  cashFlow: (startDate, endDate) => getCashFlow(startDate, endDate, getState()),

  cashFlowByMonth: (months = 6) => {
    const data = getState();
    const now = new Date();
    const currentJ = toJalali(now.toISOString());
    if (!currentJ) return [];
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      let jy = currentJ.jy;
      let jm = currentJ.jm - i;
      while (jm <= 0) { jm += 12; jy--; }
      const { start, end } = jalaliMonthRange(jy, jm);
      const cf = getCashFlow(start.toISOString(), end.toISOString(), data);
      result.push({
        period: `${getMonthName(jm)} ${toPersianDigits(jy)}`,
        inflow: cf.inflow, outflow: cf.outflow, net: cf.inflow - cf.outflow,
        receiptsCount: cf.receiptsCount, expensesCount: cf.expensesCount
      });
    }
    return result;
  },

  cashFlowByYear: (years = 3) => {
    const data = getState();
    const now = new Date();
    const currentJ = toJalali(now.toISOString());
    if (!currentJ) return [];
    const result = [];
    for (let i = years - 1; i >= 0; i--) {
      const jy = currentJ.jy - i;
      const { start, end } = jalaliYearRange(jy);
      const cf = getCashFlow(start.toISOString(), end.toISOString(), data);
      result.push({
        period: toPersianDigits(jy),
        inflow: cf.inflow, outflow: cf.outflow, net: cf.inflow - cf.outflow,
        receiptsCount: cf.receiptsCount, expensesCount: cf.expensesCount
      });
    }
    return result;
  },

  exportAll: async () => {
    const [employers, partners, projects, projectShares, receipts, receiptAllocations, employerCredits, expenses, partnerTransfers, dailyActivities, equipment, tags] = await Promise.all([
      repo.employers.getAll(), repo.partners.getAll(), repo.projects.getAll(), repo.projectShares.getAll(),
      repo.receipts.getAll(), repo.receiptAllocations.getAll(), repo.employerCredits.getAll(),
      repo.expenses.getAll(), repo.partnerTransfers.getAll(), repo.dailyActivities.getAll(),
      repo.equipment.getAll(), repo.tags.getAll()
    ]);
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        employers, partners, projects, projectShares, receipts, receiptAllocations,
        employerCredits, expenses, partnerTransfers, dailyActivities, equipment, tags,
        settings: storage.getSettings ? storage.getSettings() : {},
        customOrders: storage.getAllCustomOrders ? storage.getAllCustomOrders() : (storage.getCustomOrders ? storage.getCustomOrders() : {}),
        dashboardShortcuts: storage.getDashboardShortcuts ? storage.getDashboardShortcuts() : [],
        autoBackup: storage.getAutoBackup ? storage.getAutoBackup() : null
      }
    };
  }
};
