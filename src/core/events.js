// src/core/events.js
// Event Bus داخلی — فاز 1 PRD

const listeners = new Map();

export const events = {
  on(event, callback) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(callback);

    // returns unsubscribe function
    return () => {
      const set = listeners.get(event);
      if (set) set.delete(callback);
    };
  },

  emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(payload);
      } catch (e) {
        console.error(`Error in event listener for "${event}":`, e);
      }
    }
  },

  off(event, callback) {
    const set = listeners.get(event);
    if (set) set.delete(callback);
  },

  clear(event) {
    if (event) {
      listeners.delete(event);
    } else {
      listeners.clear();
    }
  }
};

// نام‌های رویدادهای استاندارد
export const EVENT_TYPES = {
  // Entity events
  EMPLOYER_CREATED: 'employer:created',
  EMPLOYER_UPDATED: 'employer:updated',
  EMPLOYER_DELETED: 'employer:deleted',

  PARTNER_CREATED: 'partner:created',
  PARTNER_UPDATED: 'partner:updated',
  PARTNER_DELETED: 'partner:deleted',

  PROJECT_CREATED: 'project:created',
  PROJECT_UPDATED: 'project:updated',
  PROJECT_DELETED: 'project:deleted',

  RECEIPT_CREATED: 'receipt:created',
  RECEIPT_UPDATED: 'receipt:updated',
  RECEIPT_DELETED: 'receipt:deleted',

  EXPENSE_CREATED: 'expense:created',
  EXPENSE_UPDATED: 'expense:updated',
  EXPENSE_DELETED: 'expense:deleted',

  TRANSFER_CREATED: 'transfer:created',
  TRANSFER_UPDATED: 'transfer:updated',
  TRANSFER_DELETED: 'transfer:deleted',

  ACTIVITY_CREATED: 'activity:created',
  ACTIVITY_UPDATED: 'activity:updated',
  ACTIVITY_DELETED: 'activity:deleted',

  EQUIPMENT_CREATED: 'equipment:created',
  EQUIPMENT_UPDATED: 'equipment:updated',
  EQUIPMENT_DELETED: 'equipment:deleted',

  TAG_CREATED: 'tag:created',
  TAG_UPDATED: 'tag:updated',
  TAG_DELETED: 'tag:deleted',

  // System events
  STATE_HYDRATED: 'state:hydrated',
  NAVIGATION_CHANGED: 'navigation:changed',
  SETTINGS_UPDATED: 'settings:updated'
};
