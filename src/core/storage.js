// src/core/storage.js
// لایه localStorage — فاز 1 PRD
// برای متادیتا و تنظیمات

const KEYS = {
  SETTINGS: 'pfm:settings',
  CUSTOM_ORDERS: 'pfm:customOrders',
  ONBOARDING: 'pfm:onboarding',
  DASHBOARD_SHORTCUTS: 'pfm:dashboardShortcuts',
  AUTO_BACKUP: 'pfm:autoBackup'
};

const DEFAULT_SETTINGS = {
  userName: '',
  avatarColor: 'brand',
  avatarIcon: '',
  unit: 'toman',
  calendar: 'jalali',
  theme: 'dark',
  autoBackup: false,
  lastBackup: null,
  onboardingCompleted: false
};

const DEFAULT_CUSTOM_ORDERS = {
  employers: [],
  partners: [],
  projects_active: [],
  projects_completed: [],
  projects_archived: []
};

const DEFAULT_DASHBOARD_SHORTCUTS = [
  'add_receipt',
  'add_expense',
  'add_activity',
  'export_json'
];

export const storage = {
  // === Settings ===
  getSettings() {
    try {
      const raw = localStorage.getItem(KEYS.SETTINGS);
      return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
    } catch (e) {
      console.warn('Failed to read settings:', e);
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(settings) {
    try {
      const merged = { ...this.getSettings(), ...settings };
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(merged));
      return merged;
    } catch (e) {
      console.error('Failed to save settings:', e);
      throw e;
    }
  },

  // === Custom Orders (مرتب‌سازی دستی) ===
  getCustomOrders() {
    try {
      const raw = localStorage.getItem(KEYS.CUSTOM_ORDERS);
      return { ...DEFAULT_CUSTOM_ORDERS, ...(raw ? JSON.parse(raw) : {}) };
    } catch (e) {
      return { ...DEFAULT_CUSTOM_ORDERS };
    }
  },

  getCustomOrder(key) {
    const orders = this.getCustomOrders();
    return orders[key] || [];
  },

  saveCustomOrder(key, ids) {
    const orders = this.getCustomOrders();
    orders[key] = ids;
    localStorage.setItem(KEYS.CUSTOM_ORDERS, JSON.stringify(orders));
    return orders;
  },

  getAllCustomOrders() {
    return this.getCustomOrders();
  },

  // === Onboarding ===
  getOnboardingState() {
    try {
      const raw = localStorage.getItem(KEYS.ONBOARDING);
      return raw ? JSON.parse(raw) : { completed: false, step: 0 };
    } catch (e) {
      return { completed: false, step: 0 };
    }
  },

  saveOnboardingState(state) {
    localStorage.setItem(KEYS.ONBOARDING, JSON.stringify(state));
  },

  // === Dashboard Shortcuts ===
  getDashboardShortcuts() {
    try {
      const raw = localStorage.getItem(KEYS.DASHBOARD_SHORTCUTS);
      return raw ? JSON.parse(raw) : DEFAULT_DASHBOARD_SHORTCUTS;
    } catch (e) {
      return DEFAULT_DASHBOARD_SHORTCUTS;
    }
  },

  saveDashboardShortcuts(ids) {
    localStorage.setItem(KEYS.DASHBOARD_SHORTCUTS, JSON.stringify(ids));
  },

  // === Auto Backup ===
  getAutoBackup() {
    try {
      const raw = localStorage.getItem(KEYS.AUTO_BACKUP);
      return raw ? JSON.parse(raw) : { enabled: false, lastBackup: null, data: null };
    } catch (e) {
      return { enabled: false, lastBackup: null, data: null };
    }
  },

  saveAutoBackup(state) {
    localStorage.setItem(KEYS.AUTO_BACKUP, JSON.stringify(state));
  },

  // === Clear all ===
  clearAll() {
    Object.values(KEYS).forEach(key => localStorage.removeItem(key));
  },

  // === Export all localStorage data (for backup) ===
  exportAll() {
    const result = {};
    for (const [name, key] of Object.entries(KEYS)) {
      const raw = localStorage.getItem(key);
      result[name] = raw ? JSON.parse(raw) : null;
    }
    return result;
  },

  // === Import all localStorage data (from backup) ===
  importAll(data) {
    for (const [name, key] of Object.entries(KEYS)) {
      if (data[name] !== undefined && data[name] !== null) {
        localStorage.setItem(key, JSON.stringify(data[name]));
      }
    }
  }
};
