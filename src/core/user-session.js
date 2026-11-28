import { authService } from './auth.js';
import { setDatabaseScope } from './db.js';
import { setStorageScope } from './storage.js';
import { state } from './state.js';

let activeSession = null;

export async function restoreUserSession() {
  const result = await authService.getSession();
  if (!result?.session) { activeSession = null; return null; }
  activeSession = result.session;
  setDatabaseScope(activeSession.dataScope);
  setStorageScope(activeSession.dataScope);
  await state.hydrate();
  if (result.user?.name && !state.data.settings.userName) {
    state.updateSettings({ userName: result.user.name });
  }
  return activeSession;
}

export async function activateUserSession(result) {
  if (!result?.session) throw new Error('اطلاعات نشست کاربر معتبر نیست.');
  activeSession = result.session;
  setDatabaseScope(activeSession.dataScope);
  setStorageScope(activeSession.dataScope);
  await state.hydrate();
  if (result.user?.name && !state.data.settings.userName) {
    state.updateSettings({ userName: result.user.name });
  }
  return activeSession;
}

export function isSessionActive() {
  return Boolean(activeSession);
}

export function clearActiveSession() {
  activeSession = null;
}
