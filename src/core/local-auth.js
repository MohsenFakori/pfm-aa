// احراز هویت محلی موقت برای توسعه چندکاربری
// رمز عبور هرگز به‌صورت متن ساده ذخیره نمی‌شود؛ از PBKDF2 و salt تصادفی استفاده می‌شود.
// این راهکار برای توسعه محلی است و جایگزین احراز هویت سمت سرور نیست.

import { authService } from './auth.js';

const ACCOUNTS_KEY = 'pfm:localAuth:accounts';
const SESSION_KEY = 'pfm:localAuth:session';
const ITERATIONS = 210000;

function readAccounts() {
  try {
    const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    return Array.isArray(accounts) ? accounts : [];
  } catch { return []; }
}
function writeAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}
function toBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
function fromBase64(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}
async function derivePassword(password, salt) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('برای استفاده از رمز عبور، مرورگر باید در localhost یا بستر امن اجرا شود.');
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return toBase64(bits);
}
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('رمز عبور باید حداقل ۸ کاراکتر باشد.');
  }
}
function publicAccount(account) {
  return { id: account.id, email: account.email, name: account.name, dataScope: account.dataScope };
}
function saveSession(account) {
  const session = { userId: account.id, dataScope: account.dataScope, email: account.email, name: account.name, createdAt: new Date().toISOString() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export const localAuthProvider = {
  async register({ email, password, name = '' }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('ایمیل معتبر وارد کنید.');
    validatePassword(password);
    const accounts = readAccounts();
    if (accounts.some(account => account.email === normalizedEmail)) throw new Error('برای این ایمیل قبلاً حساب ساخته شده است.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const passwordHash = await derivePassword(password, salt);
    const id = crypto.randomUUID();
    // اولین حساب، داده‌های قبلی نسخه تک‌کاربره را حفظ می‌کند.
    const dataScope = accounts.length === 0 ? 'default' : id;
    const account = {
      id, email: normalizedEmail, name: String(name || '').trim(),
      salt: toBase64(salt), passwordHash, iterations: ITERATIONS, dataScope,
      createdAt: new Date().toISOString()
    };
    accounts.push(account);
    writeAccounts(accounts);
    return { user: publicAccount(account), session: saveSession(account) };
  },

  async login({ email, password }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const account = readAccounts().find(item => item.email === normalizedEmail);
    if (!account) throw new Error('ایمیل یا رمز عبور نادرست است.');
    const hash = await derivePassword(String(password || ''), fromBase64(account.salt));
    if (hash !== account.passwordHash) throw new Error('ایمیل یا رمز عبور نادرست است.');
    return { user: publicAccount(account), session: saveSession(account) };
  },

  async logout() {
    localStorage.removeItem(SESSION_KEY);
    return true;
  },

  async getSession() {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!session) return null;
      const account = readAccounts().find(item => item.id === session.userId);
      return account ? { user: publicAccount(account), session } : null;
    } catch { return null; }
  },

  async changePassword({ currentPassword, newPassword }) {
    validatePassword(newPassword);
    const session = await this.getSession();
    if (!session) throw new Error('ابتدا وارد حساب کاربری شوید.');
    const accounts = readAccounts();
    const index = accounts.findIndex(item => item.id === session.user.id);
    const account = accounts[index];
    const currentHash = await derivePassword(String(currentPassword || ''), fromBase64(account.salt));
    if (currentHash !== account.passwordHash) throw new Error('رمز عبور فعلی صحیح نیست.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    account.salt = toBase64(salt);
    account.passwordHash = await derivePassword(newPassword, salt);
    account.iterations = ITERATIONS;
    accounts[index] = account;
    writeAccounts(accounts);
    return true;
  }
};

authService.configure(localAuthProvider);
