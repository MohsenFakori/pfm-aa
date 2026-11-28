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

let storageScope = 'default';

export function setStorageScope(scope = 'default') {
  storageScope = String(scope || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function scopedKey(name) {
  const key = KEYS[name];
  return storageScope === 'default' ? key : `pfm:user:${storageScope}:${key}`;
}

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
      const raw = localStorage.getItem(scopedKey('SETTINGS'));
      return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
    } catch (e) {
      console.warn('Failed to read settings:', e);
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(settings) {
    try {
      const merged = { ...this.getSettings(), ...settings };
      localStorage.setItem(scopedKey('SETTINGS'), JSON.stringify(merged));
      return merged;
    } catch (e) {
      console.error('Failed to save settings:', e);
      throw e;
    }
  },

  // === Custom Orders (مرتب‌سازی دستی) ===
  getCustomOrders() {
    try {
      const raw = localStorage.getItem(scopedKey('CUSTOM_ORDERS'));
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
    localStorage.setItem(scopedKey('CUSTOM_ORDERS'), JSON.stringify(orders));
    return orders;
  },

  getAllCustomOrders() {
    return this.getCustomOrders();
  },

  // === Onboarding ===
  getOnboardingState() {
    try {
      const raw = localStorage.getItem(scopedKey('ONBOARDING'));
      return raw ? JSON.parse(raw) : { completed: false, step: 0 };
    } catch (e) {
      return { completed: false, step: 0 };
    }
  },

  saveOnboardingState(state) {
    localStorage.setItem(scopedKey('ONBOARDING'), JSON.stringify(state));
  },

  // === Dashboard Shortcuts ===
  getDashboardShortcuts() {
    try {
      const raw = localStorage.getItem(scopedKey('DASHBOARD_SHORTCUTS'));
      return raw ? JSON.parse(raw) : DEFAULT_DASHBOARD_SHORTCUTS;
    } catch (e) {
      return DEFAULT_DASHBOARD_SHORTCUTS;
    }
  },

  saveDashboardShortcuts(ids) {
    localStorage.setItem(scopedKey('DASHBOARD_SHORTCUTS'), JSON.stringify(ids));
  },

  // === Auto Backup ===
  getAutoBackup() {
    try {
      const raw = localStorage.getItem(scopedKey('AUTO_BACKUP'));
      return raw ? JSON.parse(raw) : { enabled: false, lastBackup: null, data: null };
    } catch (e) {
      return { enabled: false, lastBackup: null, data: null };
    }
  },

  saveAutoBackup(state) {
    localStorage.setItem(scopedKey('AUTO_BACKUP'), JSON.stringify(state));
  },

  // === Clear all ===
  clearAll() {
    Object.keys(KEYS).forEach(name => localStorage.removeItem(scopedKey(name)));
  },

  // === Export all localStorage data (for backup) ===
  exportAll() {
    const result = {};
    for (const [name] of Object.entries(KEYS)) {
      const raw = localStorage.getItem(scopedKey(name));
      result[name] = raw ? JSON.parse(raw) : null;
    }
    return result;
  },

  // === Import all localStorage data (from backup) ===
  importAll(data) {
    for (const [name] of Object.entries(KEYS)) {
      if (data[name] !== undefined && data[name] !== null) {
        localStorage.setItem(scopedKey(name), JSON.stringify(data[name]));
      }
    }
  }
};
