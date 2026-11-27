// src/core/auth.js
// مرز احراز هویت برای اتصال آینده به بک‌اند.
// این ماژول هیچ رمز عبور یا توکنی را در localStorage ذخیره نمی‌کند.

let provider = null;

const REQUIRED_METHODS = ['login', 'register', 'logout', 'getSession', 'changePassword'];

export const authService = {
  configure(authProvider) {
    if (!authProvider || REQUIRED_METHODS.some(method => typeof authProvider[method] !== 'function')) {
      throw new Error('Auth provider must implement login, register, logout, getSession and changePassword.');
    }
    provider = authProvider;
  },

  isConfigured() {
    return Boolean(provider);
  },

  async login(credentials) {
    return this.invoke('login', credentials);
  },

  async register(details) {
    return this.invoke('register', details);
  },

  async logout() {
    return this.invoke('logout');
  },

  async getSession() {
    return this.invoke('getSession');
  },

  async changePassword(details) {
    return this.invoke('changePassword', details);
  },

  async invoke(method, payload) {
    if (!provider) {
      throw new Error('Authentication backend is not configured.');
    }
    return provider[method](payload);
  }
};
