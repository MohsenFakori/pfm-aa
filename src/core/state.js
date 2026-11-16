// src/core/state.js
// State Manager مرکزی — فاز 1 PRD
// State ساده با pub/sub برای به‌روزرسانی لحظه‌ای UI

import { repo } from './repository.js';
import { storage } from './storage.js';
import { events, EVENT_TYPES } from './events.js';
import { clearCalcCache } from '../domain/calculations.js';

const state = {
  data: {
    employers: [],
    partners: [],
    projects: [],
    projectShares: [],
    receipts: [],
    receiptAllocations: [],
    employerCredits: [],
    expenses: [],
    partnerTransfers: [],
    dailyActivities: [],
    equipment: [],
    tags: [],
    settings: storage.getSettings(),
    customOrders: storage.getCustomOrders(),
    dashboardShortcuts: storage.getDashboardShortcuts()
  },

  hydrated: false,
  subscribers: new Map(),

  // subscribe به تغییرات یک path
  subscribe(path, callback) {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set());
    }
    this.subscribers.get(path).add(callback);

    // فوراً مقدار فعلی را پاس بده
    callback(this.get(path));

    return () => {
      const set = this.subscribers.get(path);
      if (set) set.delete(callback);
    };
  },

  // emit تغییرات
  emit(path) {
    const set = this.subscribers.get(path);
    if (!set) return;
    const value = this.get(path);
    for (const cb of set) {
      try {
        cb(value);
      } catch (e) {
        console.error(`State subscriber error for "${path}":`, e);
      }
    }
  },

  // دریافت مقدار با path (مثلاً 'employers' یا 'settings.userName')
  get(path) {
    const parts = path.split('.');
    let current = this.data;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  },

  // تنظیم مقدار با path
  set(path, value) {
    const parts = path.split('.');
    let current = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    this.emit(path);

    // emit parent path too
    if (parts.length > 1) {
      this.emit(parts[0]);
    }
  },

  // بارگذاری اولیه همه داده‌ها از IndexedDB
  async hydrate() {
    try {
      const [
        employers,
        partners,
        projects,
        projectShares,
        receipts,
        receiptAllocations,
        employerCredits,
        expenses,
        partnerTransfers,
        dailyActivities,
        equipment,
        tags
      ] = await Promise.all([
        repo.employers.getAll(),
        repo.partners.getAll(),
        repo.projects.getAll(),
        repo.projectShares.getAll(),
        repo.receipts.getAll(),
        repo.receiptAllocations.getAll(),
        repo.employerCredits.getAll(),
        repo.expenses.getAll(),
        repo.partnerTransfers.getAll(),
        repo.dailyActivities.getAll(),
        repo.equipment.getAll(),
        repo.tags.getAll()
      ]);

      this.data.employers = employers;
      this.data.partners = partners;
      this.data.projects = projects;
      this.data.projectShares = projectShares;
      this.data.receipts = receipts;
      this.data.receiptAllocations = receiptAllocations;
      this.data.employerCredits = employerCredits;
      this.data.expenses = expenses;
      this.data.partnerTransfers = partnerTransfers;
      this.data.dailyActivities = dailyActivities;
      this.data.equipment = equipment;
      this.data.tags = tags;
      this.data.settings = storage.getSettings();
      this.data.customOrders = storage.getCustomOrders();
      this.data.dashboardShortcuts = storage.getDashboardShortcuts();
      this.hydrated = true;

      events.emit(EVENT_TYPES.STATE_HYDRATED);
      return this.data;
    } catch (e) {
      console.error('State hydration failed:', e);
      throw e;
    }
  },

  // به‌روزرسانی یک موجودیت در state
  updateEntity(collectionName, entity) {
    const list = this.data[collectionName] || [];
    const idx = list.findIndex(item => item.id === entity.id);
    if (idx >= 0) {
      list[idx] = entity;
    } else {
      list.push(entity);
    }
    this.data[collectionName] = list;
    this.emit(collectionName);
    clearCalcCache();
  },

  // حذف یک موجودیت از state
  removeEntity(collectionName, id) {
    const list = this.data[collectionName] || [];
    this.data[collectionName] = list.filter(item => item.id !== id);
    this.emit(collectionName);
    clearCalcCache();
  },

  // به‌روزرسانی تنظیمات
  updateSettings(patch) {
    const newSettings = { ...this.data.settings, ...patch };
    this.data.settings = newSettings;
    storage.saveSettings(newSettings);
    this.emit('settings');
    events.emit(EVENT_TYPES.SETTINGS_UPDATED, newSettings);
  },

  // به‌روزرسانی ترتیب سفارشی
  updateCustomOrder(key, ids) {
    this.data.customOrders[key] = ids;
    storage.saveCustomOrder(key, ids);
    this.emit('customOrders');
  }
};

export { state };
