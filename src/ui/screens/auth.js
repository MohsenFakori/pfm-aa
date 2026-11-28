// صفحه ورود و عضویت محلی؛ provider فعلی برای توسعه چندکاربری است.
import { navigate } from '../../core/router.js';
import { authService } from '../../core/auth.js';
import { activateUserSession } from '../../core/user-session.js';
import { state } from '../../core/state.js';
import { showToast } from '../components/toast.js';

let authMode = 'login';

export function renderAuthPage() {
  document.getElementById('page-content').innerHTML = `
    <div class="px-4 pt-6 pb-28">
      <section class="glass rounded-2xl p-5">
        <div class="flex items-center gap-2 mb-4"><i data-lucide="shield-check" class="w-5 h-5 text-brand"></i><h2 class="text-base font-bold">حساب کاربری</h2></div>
        <div class="grid grid-cols-2 gap-2 p-1 rounded-xl bg-ink-soft mb-5">
          <button onclick="window.__authMode('login')" class="h-9 rounded-lg text-xs ${authMode === 'login' ? 'bg-brand text-white' : 'text-fg-muted'}">ورود</button>
          <button onclick="window.__authMode('register')" class="h-9 rounded-lg text-xs ${authMode === 'register' ? 'bg-brand text-white' : 'text-fg-muted'}">ثبت‌نام</button>
        </div>
        <div id="auth-name-wrap" class="${authMode === 'register' ? '' : 'hidden'}">
          <label class="block text-xs text-fg-muted mb-1.5" for="auth-name">نام</label>
          <input id="auth-name" type="text" autocomplete="name" placeholder="نام شما" class="w-full h-11 px-3 rounded-xl bg-ink-soft border border-line text-sm mb-3" />
        </div>
        <label class="block text-xs text-fg-muted mb-1.5" for="auth-email">ایمیل</label>
        <input id="auth-email" type="email" autocomplete="email" placeholder="name@example.com" class="w-full h-11 px-3 rounded-xl bg-ink-soft border border-line text-sm mb-3" />
        <label class="block text-xs text-fg-muted mb-1.5" for="auth-password">رمز عبور</label>
        <input id="auth-password" type="password" autocomplete="${authMode === 'login' ? 'current-password' : 'new-password'}" placeholder="حداقل ۸ کاراکتر" class="w-full h-11 px-3 rounded-xl bg-ink-soft border border-line text-sm mb-3" />
        <div id="auth-confirm-wrap" class="${authMode === 'register' ? '' : 'hidden'}">
          <label class="block text-xs text-fg-muted mb-1.5" for="auth-confirm">تکرار رمز عبور</label>
          <input id="auth-confirm" type="password" autocomplete="new-password" placeholder="رمز عبور را تکرار کنید" class="w-full h-11 px-3 rounded-xl bg-ink-soft border border-line text-sm mb-4" />
        </div>
        <button onclick="window.__submitAuth()" class="w-full h-11 rounded-xl bg-brand text-white text-sm">${authMode === 'login' ? 'ورود به حساب' : 'ایجاد حساب کاربری'}</button>
        <p class="text-[11px] text-fg-muted leading-6 mt-4">حساب‌ها و داده‌ها فعلاً فقط در همین مرورگر ذخیره می‌شوند. رمز عبور به‌صورت هش‌شده ذخیره می‌شود؛ این نسخه برای آزمایش است و هنوز احراز هویت سروری یا همگام‌سازی بین دستگاه‌ها ندارد.</p>
      </section>
    </div>
  `;
  window.__authMode = mode => { authMode = mode; renderAuthPage(); };
  window.__submitAuth = submitAuth;
  if (window.lucide) window.lucide.createIcons();
}

async function submitAuth() {
  const email = document.getElementById('auth-email')?.value?.trim() || '';
  const password = document.getElementById('auth-password')?.value || '';
  const name = document.getElementById('auth-name')?.value?.trim() || '';
  if (!email || !password) { showToast('ایمیل و رمز عبور را وارد کنید', 'error'); return; }
  if (authMode === 'register') {
    const confirm = document.getElementById('auth-confirm')?.value || '';
    if (password !== confirm) { showToast('تکرار رمز عبور مطابقت ندارد', 'error'); return; }
  }
  try {
    const result = authMode === 'login'
      ? await authService.login({ email, password })
      : await authService.register({ email, password, name });
    await activateUserSession(result);
    if (name && authMode === 'register') state.updateSettings({ userName: name });
    showToast(authMode === 'login' ? 'با موفقیت وارد شدید' : 'حساب کاربری ایجاد شد', 'success');
    navigate(state.data.settings.onboardingCompleted ? '/dashboard' : '/onboarding');
  } catch (error) {
    console.error('Authentication failed:', error);
    showToast(error.message || 'خطا در ورود یا ثبت‌نام', 'error');
  }
}
