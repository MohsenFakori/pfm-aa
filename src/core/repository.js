// src/core/repository.js
// لایه Repository — فاز 1 PRD
// API یکنواخت برای تمام موجودیت‌ها

import { db } from './db.js';
import { uuid, now } from './id.js';

// ساخت Repository عمومی برای یک store
function createRepository(storeName) {
  return {
    async getAll(opts) {
      return db.getAll(storeName, opts);
    },

    async getById(id) {
      const record = await db.getById(storeName, id);
      if (record && record.deletedAt) return null;
      return record;
    },

    async create(data) {
      const timestamp = now();
      const record = {
        ...data,
        id: data.id || uuid(),
        createdAt: timestamp,
        updatedAt: timestamp
      };
      return db.create(storeName, record);
    },

    async update(id, patch) {
      const existing = await db.getById(storeName, id, true);
      if (!existing) throw new Error(`Record not found in ${storeName}: ${id}`);
      const updated = {
        ...existing,
        ...patch,
        id,
        updatedAt: now()
      };
      return db.update(storeName, updated);
    },

    async save(record) {
      // اگر id داشته باشد و موجود باشد → update، در غیر این صورت → create
      if (record.id) {
        const existing = await db.getById(storeName, record.id, true);
        if (existing) {
          return this.update(record.id, record);
        }
      }
      return this.create(record);
    },

    async delete(id, { soft = true } = {}) {
      if (soft) {
        return db.softDelete(storeName, id);
      }
      return db.hardDelete(storeName, id);
    },

    async query(predicate, opts) {
      return db.query(storeName, predicate, opts);
    },

    async bulkInsert(records) {
      return db.bulkInsert(storeName, records);
    }
  };
}

export const repo = {
  employers:          createRepository('employers'),
  partners:           createRepository('partners'),
  projects:           createRepository('projects'),
  projectShares:      createRepository('projectShares'),
  receipts:           createRepository('receipts'),
  receiptAllocations: createRepository('receiptAllocations'),
  employerCredits:    createRepository('employerCredits'),
  expenses:           createRepository('expenses'),
  partnerTransfers:   createRepository('partnerTransfers'),
  dailyActivities:    createRepository('dailyActivities'),
  equipment:          createRepository('equipment'),
  tags:               createRepository('tags')
};
