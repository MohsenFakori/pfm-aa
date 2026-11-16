// src/core/db.js
// لایه IndexedDB — فاز 1 PRD

const DB_NAME = 'pfm_db';
const DB_VERSION = 1;

// تعریف تمام storeها طبق PRD فاز 1
const STORES = {
  employers:          { keyPath: 'id', indexes: [['name', { unique: false }], ['createdAt'], ['deletedAt']] },
  partners:           { keyPath: 'id', indexes: [['name'], ['createdAt'], ['deletedAt']] },
  projects:           { keyPath: 'id', indexes: [['employerId'], ['status'], ['createdAt'], ['startDate'], ['endDate'], ['deletedAt']] },
  projectShares:      { keyPath: 'id', indexes: [['projectId'], ['partnerId']] },
  receipts:           { keyPath: 'id', indexes: [['employerId'], ['date'], ['createdAt'], ['deletedAt']] },
  receiptAllocations: { keyPath: 'id', indexes: [['receiptId'], ['projectId']] },
  employerCredits:    { keyPath: 'id', indexes: [['employerId']] },
  expenses:           { keyPath: 'id', indexes: [['projectId'], ['paidByPartnerId'], ['date'], ['deletedAt']] },
  partnerTransfers:   { keyPath: 'id', indexes: [['fromPartnerId'], ['toPartnerId'], ['date'], ['deletedAt']] },
  dailyActivities:    { keyPath: 'id', indexes: [['date'], ['projectId'], ['partnerId']] },
  equipment:          { keyPath: 'id', indexes: [['ownerPartnerId'], ['purchaseDate'], ['deletedAt']] },
  tags:               { keyPath: 'id', indexes: [['name', { unique: true }]] }
};

let dbInstance = null;

export function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      // اگر در آینده schema تغییر کرد، migrationها اینجا اضافه شوند
      if (event.oldVersion < 1) {
        // ایجاد همه storeها در نسخه اول
        for (const [storeName, config] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: config.keyPath });
            for (const idx of config.indexes) {
              const idxName = Array.isArray(idx) ? idx[0] : idx;
              const idxOpts = Array.isArray(idx) ? idx[1] : {};
              store.createIndex(idxName, idxName, idxOpts);
            }
          }
        }
      }
    };

    req.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    req.onerror = (event) => {
      console.error('DB open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// اجرای تراکنش عمومی
export async function transaction(storeNames, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const stores = {};
    if (Array.isArray(storeNames)) {
      storeNames.forEach(name => {
        stores[name] = tx.objectStore(name);
      });
    } else {
      stores[storeNames] = tx.objectStore(storeNames);
    }

    let result;
    Promise.resolve(callback(stores)).then(r => {
      result = r;
    }).catch(err => {
      tx.error = err;
      reject(err);
    });

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

// عملیات CRUD عمومی روی یک store
export const db = {
  stores: STORES,

  async create(storeName, record) {
    return transaction(storeName, 'readwrite', (stores) => {
      return new Promise((resolve, reject) => {
        const req = stores[storeName].add(record);
        req.onsuccess = () => resolve(record);
        req.onerror = () => reject(req.error);
      });
    });
  },

  async update(storeName, record) {
    return transaction(storeName, 'readwrite', (stores) => {
      return new Promise((resolve, reject) => {
        const req = stores[storeName].put(record);
        req.onsuccess = () => resolve(record);
        req.onerror = () => reject(req.error);
      });
    });
  },

  async getById(storeName, id) {
    return transaction(storeName, 'readonly', (stores) => {
      return new Promise((resolve, reject) => {
        const req = stores[storeName].get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });
  },

  async getAll(storeName, { includeDeleted = false } = {}) {
    return transaction(storeName, 'readonly', (stores) => {
      return new Promise((resolve, reject) => {
        const req = stores[storeName].getAll();
        req.onsuccess = () => {
          const results = req.result || [];
          resolve(includeDeleted ? results : results.filter(r => !r.deletedAt));
        };
        req.onerror = () => reject(req.error);
      });
    });
  },

  async query(storeName, predicate, { includeDeleted = false } = {}) {
    const all = await this.getAll(storeName, { includeDeleted });
    return all.filter(predicate);
  },

  async softDelete(storeName, id) {
    const record = await this.getById(storeName, id, true);
    if (!record) throw new Error('Record not found: ' + id);
    record.deletedAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    return this.update(storeName, record);
  },

  async hardDelete(storeName, id) {
    return transaction(storeName, 'readwrite', (stores) => {
      return new Promise((resolve, reject) => {
        const req = stores[storeName].delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    });
  },

  async clearAll() {
    const storeNames = Object.keys(STORES);
    return transaction(storeNames, 'readwrite', (stores) => {
      return Promise.all(storeNames.map(name => {
        return new Promise((resolve, reject) => {
          const req = stores[name].clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }));
    });
  },

  async bulkInsert(storeName, records) {
    return transaction(storeName, 'readwrite', (stores) => {
      return Promise.all(records.map(record => {
        return new Promise((resolve, reject) => {
          const req = stores[storeName].put(record);
          req.onsuccess = () => resolve(record);
          req.onerror = () => reject(req.error);
        });
      }));
    });
  }
};
