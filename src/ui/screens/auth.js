// src/ui/screens/auth.js
// رابط ورود و عضویت متصل به قرارداد سرویس احراز هویت

import { navigate } from '../../core/router.js';
import { authService } from '../../core/auth.js';
import { showToast } from '../components/toast.js';

let authMode = 'login';

export function renderAuthPage() {
  const ready = authService.isConfigured();
  document.getElementById('page-content').innerHTML = `
    <div class="px-4 pt-6 pb-28">
      <section class="glass rounded-2xl p-5">
        <div class="flex items-center gap-2 mb-4"><i data-lucide="shield-check" class="w-5 h-5 text-brand"></i><h2 class="text-base font-bold">حساب کاربری</h2></div>
        <div class="grid grid-cols-2 gap-2 p-1 rounded-xl bg-ink-soft mb-5">
          <button onclick="window.__authMode('login')" class="h-9 rounded-lg text-xs ${authMode === 'login' ? 'bg-brand text-white' : 'text-fg-muted'}">ورود</button>
          <button onclick="window.__authMode('register')" class="h-9 rounded-lg text-xs ${authMode === 'register' ? 'bg-brand text-white' : 'text-fg-muted'}">عضویت</button>
        </div>
        <label class="block text-xs text-fg-muted mb-1.5" for="auth-email">ایمیل</label>
        <input id="auth-email" type="email" autocomplete="email" placeholder="name@example.com" ${ready ? '' : 'disabled'} class="w-full h-11 px-3 rounded-xl bg-ink-soft border border-line text-sm mb-3" />
        <label class="block text-xs text-fg-muted mb-1.5" for="auth-password">رمز عبور</label>
        <input id="auth-password" type="password" autocomplete="current-password" placeholder="رمز عبور" ${ready ? '' : 'disabled'} class="w-full h-11 px-3 rounded-xl bg-ink-soft border border-line text-sm mb-4" />
        <button onclick="window.__submitAuth()" ${ready ? '' : 'disabled'} class="w-full h-11 rounded-xl bg-brand text-white text-sm ${ready ? '' : 'opacity-50'}">${ready ? (authMode === 'login' ? 'ورود به حساب' : 'ایجاد حساب کاربری') : 'پس از اتصال بک‌اند فعال می‌شود'}</button>
        <p class="text-[11px] text-fg-muted leading-6 mt-4">${ready ? 'سرویس احراز هویت فعال است. اطلاعات ورود مستقیماً به سرویس متصل ارسال می‌شوند.' : 'ساختار ورود و عضویت و قرارداد اتصال به API آماده است. تا زمان اتصال سرویس احراز هویت، ورود و عضویت غیرفعال می‌ماند. رمز یا اطلاعات ورود در مرورگر ذخیره نمی‌شود.'}</p>
      </section>
      <button onclick="window.__navigate('/profile')" class="w-full mt-4 h-10 rounded-xl glass text-xs">بازگشت به پروفایل</button>
    </div>
  `;
  window.__authMode = mode => { authMode = mode; renderAuthPage(); };
  window.__submitAuth = submitAuth;
  window.__navigate = path => navigate(path);
  if (window.lucide) window.lucide.createIcons();
}

async function submitAuth() {
  if (!authService.isConfigured()) {
    showToast('سرویس ورود هنوز به بک‌اند متصل نشده است', 'warning');
    return;
  }
  const email = document.getElementById('auth-email')?.value?.trim() || '';
  const password = document.getElementById('auth-password')?.value || '';
  if (!email || !password) {
    showToast('ایمیل و رمز عبور را وارد کنید', 'error');
    return;
  }
  try {
    if (authMode === 'login') await authService.login({ email, password });
    else await authService.register({ email, password });
    showToast(authMode === 'login' ? 'ورود با موفقیت انجام شد' : 'حساب کاربری ایجاد شد', 'success');
    navigate('/dashboard');
  } catch (error) {
    console.error('Authentication failed:', error);
    showToast(error.message || 'خطا در احراز هویت', 'error');
  }
}
