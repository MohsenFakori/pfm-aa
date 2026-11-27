// src/ui/screens/auth.js
// رابط ورود و عضویت؛ عملیات واقعی پس از اتصال API احراز هویت فعال می‌شود.

import { navigate } from '../../core/router.js';

let authMode = 'login';

export function renderAuthPage() {
  document.getElementById('page-content').innerHTML = `
    <div class="px-4 pt-6 pb-28">
      <section class="glass rounded-2xl p-5">
        <div class="flex items-center gap-2 mb-4"><i data-lucide="shield-check" class="w-5 h-5 text-brand"></i><h2 class="text-base font-bold">حساب کاربری</h2></div>
        <div class="grid grid-cols-2 gap-2 p-1 rounded-xl bg-ink-soft mb-5">
          <button onclick="window.__authMode('login')" class="h-9 rounded-lg text-xs ${authMode === 'login' ? 'bg-brand text-white' : 'text-fg-muted'}">ورود</button>
          <button onclick="window.__authMode('register')" class="h-9 rounded-lg text-xs ${authMode === 'register' ? 'bg-brand text-white' : 'text-fg-muted'}">عضویت</button>
        </div>
        <label class="block text-xs text-fg-muted mb-1.5" for="auth-email">ایمیل</label>
        <input id="auth-email" type="email" autocomplete="email" placeholder="name@example.com" class="w-full h-11 px-3 rounded-xl bg-ink-soft border border-line text-sm mb-3" disabled />
        <label class="block text-xs text-fg-muted mb-1.5" for="auth-password">رمز عبور</label>
        <input id="auth-password" type="password" autocomplete="current-password" placeholder="رمز عبور" class="w-full h-11 px-3 rounded-xl bg-ink-soft border border-line text-sm mb-4" disabled />
        <button disabled class="w-full h-11 rounded-xl bg-brand text-white text-sm opacity-50">پس از اتصال بک‌اند فعال می‌شود</button>
        <p class="text-[11px] text-fg-muted leading-6 mt-4">این صفحه فعلاً فقط چارچوب رابط کاربری است. هیچ رمز یا اطلاعات ورود به‌صورت محلی ذخیره نمی‌شود و ورود/عضویت تا زمان آماده‌شدن API غیرفعال است.</p>
      </section>
      <button onclick="window.__navigate('/profile')" class="w-full mt-4 h-10 rounded-xl glass text-xs">بازگشت به پروفایل</button>
    </div>
  `;
  window.__authMode = mode => { authMode = mode; renderAuthPage(); };
  window.__navigate = path => navigate(path);
  if (window.lucide) window.lucide.createIcons();
}
