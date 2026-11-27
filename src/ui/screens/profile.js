// src/ui/screens/profile.js
// پروفایل محلی کاربر؛ رمز عبور پس از اتصال سرویس احراز هویت فعال می‌شود.

import { state } from '../../core/state.js';
import { navigate } from '../../core/router.js';
import { showToast } from '../components/toast.js';
import { AVATAR_COLORS } from '../../domain/validators.js';

const COLOR_GRADIENTS = {
  brand: 'from-brand to-brand-dark',
  cta: 'from-cta to-cta-dark',
  purple: 'from-purple-500 to-pink-500',
  cyan: 'from-cyan-500 to-blue-500',
  pink: 'from-pink-500 to-rose-500',
  success: 'from-success to-emerald-700',
  warning: 'from-warning to-cta',
  info: 'from-info to-purple-500'
};

const AVATAR_ICONS = [
  { value: '', label: 'بدون آیکن', icon: '' },
  { value: 'user-round', label: 'کاربر', icon: 'user-round' },
  { value: 'briefcase-business', label: 'کیف', icon: 'briefcase-business' },
  { value: 'wallet', label: 'کیف پول', icon: 'wallet' },
  { value: 'rocket', label: 'موشک', icon: 'rocket' },
  { value: 'star', label: 'ستاره', icon: 'star' },
  { value: 'leaf', label: 'برگ', icon: 'leaf' },
  { value: 'coffee', label: 'قهوه', icon: 'coffee' },
  { value: 'code', label: 'کدنویسی', icon: 'code' },
  { value: 'heart', label: 'قلب', icon: 'heart' }
];

let selectedColor = 'brand';
let selectedIcon = '';

export function renderProfilePage() {
  const settings = state.data.settings || {};
  const name = settings.userName || '';
  selectedColor = settings.avatarColor || 'brand';
  selectedIcon = settings.avatarIcon || '';
  const initial = name ? name.charAt(0) : 'ک';

  document.getElementById('page-content').innerHTML = `
    <div class="px-4 pt-4 pb-28 space-y-4">
      <section class="glass rounded-2xl p-4">
        <div class="flex items-center gap-3 mb-5">
          <div id="profile-avatar-preview" class="w-14 h-14 rounded-full bg-gradient-to-br ${COLOR_GRADIENTS[selectedColor] || COLOR_GRADIENTS.brand} flex items-center justify-center text-white text-lg font-bold">
            ${selectedIcon ? '<i data-lucide="' + selectedIcon + '" class="w-6 h-6"></i>' : initial}
          </div>
          <div><h2 class="text-sm font-bold">اطلاعات پروفایل</h2><p class="text-[10px] text-fg-muted">این اطلاعات فعلاً روی همین دستگاه ذخیره می‌شوند</p></div>
        </div>
        <label class="block text-xs text-fg-muted mb-1.5" for="profile-name">نام کاربر</label>
        <input id="profile-name" type="text" value="${escapeAttribute(name)}" maxlength="60" placeholder="نام شما" class="w-full h-11 px-3 rounded-xl bg-ink-soft border border-line focus:border-brand outline-none text-sm mb-4" />
        <p class="text-xs text-fg-muted mb-2">رنگ آواتار</p>
        <div class="flex flex-wrap gap-2 mb-5">
          ${AVATAR_COLORS.map(color => '<button type="button" onclick="window.__profileColor(\'' + color + '\')" aria-label="رنگ ' + color + '" class="w-9 h-9 rounded-full bg-gradient-to-br ' + COLOR_GRADIENTS[color] + ' ' + (selectedColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-ink-soft' : '') + '"></button>').join('')}
        </div>
        <p class="text-xs text-fg-muted mb-2">آیکن پروفایل</p>
        <div class="grid grid-cols-5 gap-2">
          ${AVATAR_ICONS.map(item => '<button type="button" onclick="window.__profileIcon(\'' + item.value + '\')" data-avatar-icon="' + item.value + '" class="aspect-square rounded-xl glass flex flex-col items-center justify-center gap-1 ' + (selectedIcon === item.value ? 'border border-brand text-brand bg-brand/10' : 'text-fg-muted') + '" aria-label="' + item.label + '">' + (item.value ? '<i data-lucide="' + item.icon + '" class="w-5 h-5"></i>' : '<span class="text-[9px]">بدون</span>') + '</button>').join('')}
        </div>
        <button onclick="window.__saveUserProfile()" class="w-full h-11 rounded-xl bg-brand text-white text-sm font-medium mt-5">ذخیره تغییرات</button>
      </section>

      <section class="glass rounded-2xl p-4">
        <div class="flex items-center gap-2 mb-2"><i data-lucide="lock-keyhole" class="w-4 h-4 text-fg-muted"></i><h3 class="text-sm font-bold">رمز عبور</h3></div>
        <p class="text-xs text-fg-muted leading-6">تغییر رمز عبور پس از اتصال بک‌اند و راه‌اندازی احراز هویت فعال می‌شود. برای حفظ امنیت، رمز عبور در نسخه فعلی روی دستگاه ذخیره نمی‌شود.</p>
        <button disabled class="w-full h-10 rounded-xl glass text-xs text-fg-subtle mt-3 opacity-60">تغییر رمز عبور در نسخه بعدی فعال می‌شود</button>
      </section>

      <section class="glass rounded-2xl p-4">
        <div class="flex items-center gap-2 mb-2"><i data-lucide="shield-check" class="w-4 h-4 text-fg-muted"></i><h3 class="text-sm font-bold">حساب کاربری</h3></div>
        <p class="text-xs text-fg-muted leading-6 mb-3">ساختار ورود و عضویت برای اتصال به سرویس احراز هویت آماده شده است. در حال حاضر برنامه در حالت محلی و بدون حساب سرور اجرا می‌شود.</p>
        <button onclick="window.__navigate('/auth')" class="w-full h-10 rounded-xl glass-strong text-xs font-medium">ورود و عضویت</button>
      </section>
    </div>
  `;
  window.__profileColor = color => { selectedColor = color; updateProfileChoices(); };
  window.__profileIcon = value => { selectedIcon = value; updateProfileChoices(); };
  window.__saveUserProfile = saveUserProfile;
  window.__navigate = path => navigate(path);
  if (window.lucide) window.lucide.createIcons();
}

function updateProfileChoices() {
  document.querySelectorAll('[data-avatar-color]').forEach(button => {
    const selected = button.dataset.avatarColor === selectedColor;
    button.classList.toggle('ring-2', selected);
    button.classList.toggle('ring-white', selected);
    button.classList.toggle('ring-offset-2', selected);
    button.classList.toggle('ring-offset-ink-soft', selected);
  });
  document.querySelectorAll('[data-avatar-icon]').forEach(button => {
    const selected = button.dataset.avatarIcon === selectedIcon;
    button.classList.toggle('border', selected);
    button.classList.toggle('border-brand', selected);
    button.classList.toggle('text-brand', selected);
    button.classList.toggle('bg-brand/10', selected);
  });
  const preview = document.getElementById('profile-avatar-preview');
  if (preview) {
    const name = document.getElementById('profile-name')?.value?.trim() || 'ک';
    preview.innerHTML = selectedIcon ? '<i data-lucide="' + selectedIcon + '" class="w-6 h-6"></i>' : name.charAt(0);
    if (window.lucide) window.lucide.createIcons();
  }
}

function saveUserProfile() {
  const input = document.getElementById('profile-name');
  const name = (input?.value || '').trim();
  if (!name) { showToast('نام را وارد کنید', 'error'); return; }
  state.updateSettings({ userName: name, avatarColor: selectedColor, avatarIcon: selectedIcon });
  showToast('پروفایل ذخیره شد', 'success');
  renderProfilePage();
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
