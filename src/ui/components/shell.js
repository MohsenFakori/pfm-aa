// src/ui/components/shell.js
// Shell اصلی اپ: Header + Bottom Nav + Drawer — فاز 2 PRD

import { navigate, getCurrentRoute } from '../../core/router.js';
import { state } from '../../core/state.js';
import { openDrawer, closeDrawer, openSheet, closeSheet } from './sheet.js';
import { icon } from './icons.js';

const PAGE_TITLES = {
  '/dashboard': 'داشبورد',
  '/projects': 'پروژه‌ها',
  '/activity': 'فعالیت روزانه',
  '/reports': 'گزارش‌ها',
  '/employers': 'کارفرماها',
  '/partners': 'شرکا',
  '/equipment': 'ابزارآلات',
  '/settings': 'تنظیمات',
  '/profile': 'پروفایل کاربری',
  '/auth': 'ورود و عضویت',
  '/backup': 'بکاپ و بازگردانی',
  '/onboarding': 'خوش‌آمدید'
};

// نوار پایین: 4 دکمه + FAB مرکزی برای ثبت تراکنش
const NAV_ITEMS_LEFT = [
  { path: '/dashboard', icon: 'home', label: 'خانه' },
  { path: '/projects', icon: 'briefcase', label: 'پروژه‌ها' }
];
const NAV_ITEMS_RIGHT = [
  { path: '/activity', icon: 'calendar', label: 'فعالیت' },
  { path: '/reports', icon: 'chart-pie', label: 'گزارش' }
];

const DRAWER_ITEMS = [
  { path: '/transactions', icon: 'arrow-left-right', label: 'تراکنش‌ها' },
  { path: '/employers', icon: 'briefcase', label: 'کارفرماها' },
  { path: '/partners', icon: 'users', label: 'شرکا' },
  { path: '/equipment', icon: 'tool', label: 'ابزارآلات' },
  { path: '/backup', icon: 'database', label: 'بکاپ و بازگردانی' },
  { path: '/settings', icon: 'settings', label: 'تنظیمات' }
];

function renderHeader() {
  const current = getCurrentRoute() || '/dashboard';
  let title = PAGE_TITLES[current];
  if (!title) {
    // برای routeهای با پارامتر
    if (current.startsWith('/project/')) title = 'جزئیات پروژه';
    else if (current === '/transaction/add') title = 'تراکنش جدید';
    else if (current === '/expense/add') title = 'ثبت هزینه';
    else if (current === '/transfer/add') title = 'انتقال بین شرکا';
    else if (current === '/activity/add') title = 'ثبت فعالیت';
    else if (current === '/expense/add') title = 'افزودن هزینه';
    else if (current === '/project/add') title = 'پروژه جدید';
    else title = 'مدیریت مالی';
  }

  const backRoutes = {
    '/transaction/add': '/transactions',
    '/expense/add': '/transactions',
    '/transfer/add': '/transactions',
    '/activity/add': '/activity',
    '/project/add': '/projects'
  };
  const backPath = current.startsWith('/project/') ? '/projects' : backRoutes[current];
  const showBack = Boolean(backPath);

  return `
    <header class="sticky top-0 z-40 bg-ink/80 backdrop-blur-xl border-b border-line">
      <div class="px-4 h-16 flex items-center justify-between">
        ${showBack
          ? `<button onclick="window.__navigate('${backPath}')" class="w-10 h-10 rounded-xl glass flex items-center justify-center" aria-label="بازگشت">
              <i data-lucide="chevron-right" class="w-5 h-5"></i>
            </button>`
          : `<button onclick="window.__openDrawer()" class="w-10 h-10 rounded-xl glass flex items-center justify-center" aria-label="منو">
              <i data-lucide="menu" class="w-5 h-5"></i>
            </button>`
        }
        <h1 class="text-sm font-bold">${title}</h1>
        <button onclick="window.__openSearch()" class="w-10 h-10 rounded-xl glass flex items-center justify-center" aria-label="جستجو">
          <i data-lucide="search" class="w-5 h-5"></i>
        </button>
      </div>
    </header>
  `;
}

function renderBottomNav() {
  const current = getCurrentRoute() || '/dashboard';

  const renderItem = (item) => {
    const isActive = current === item.path || (item.path === '/projects' && current.startsWith('/project'));
    return `
      <button onclick="window.__navigate('${item.path}')" class="flex flex-col items-center gap-0.5 px-3 py-1.5 ${isActive ? 'text-brand' : 'text-fg-muted'} transition">
        <i data-lucide="${item.icon}" class="w-5 h-5"></i>
        <span class="text-[9px] ${isActive ? 'font-medium' : ''}">${item.label}</span>
      </button>
    `;
  };

  // FAB مرکزی برای ثبت تراکنش
  const fab = `
    <button onclick="window.__navigate('/transaction/add')" class="flex flex-col items-center gap-0.5 -mt-6 transition">
      <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-cta to-cta-dark flex items-center justify-center shadow-xl shadow-cta/40 border-4 border-ink-soft active:scale-95 transition">
        <i data-lucide="plus" class="w-6 h-6 text-white"></i>
      </div>
      <span class="text-[9px] text-cta font-medium">تراکنش</span>
    </button>
  `;

  return `
    <nav class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-ink-soft/95 backdrop-blur-xl border-t border-line p-2 flex items-center justify-around z-40">
      ${NAV_ITEMS_LEFT.map(renderItem).join('')}
      ${fab}
      ${NAV_ITEMS_RIGHT.map(renderItem).join('')}
    </nav>
  `;
}

function renderDrawer() {
  const settings = state.get('settings') || {};
  const userName = settings.userName || 'کاربر';

  const drawerAvatar = settings.userName ? settings.userName.charAt(0) : 'ک';

  const itemsHtml = DRAWER_ITEMS.map(item => {
    const isActive = (getCurrentRoute() || '').startsWith(item.path);
    return `
      <button onclick="window.__navigate('${item.path}'); window.closeDrawer();" class="w-full p-3 flex items-center gap-3 rounded-xl ${isActive ? 'bg-brand/15 text-brand' : 'hover:bg-white/5'} transition text-right">
        <div class="w-8 h-8 rounded-lg ${isActive ? 'bg-brand/20' : 'glass'} flex items-center justify-center">
          <i data-lucide="${item.icon}" class="w-4 h-4"></i>
        </div>
        <span class="flex-1 text-right text-sm font-medium">${item.label}</span>
        <i data-lucide="chevron-left" class="w-4 h-4 text-fg-muted"></i>
      </button>
    `;
  }).join('');

  const content = `
    <div class="p-5">
      <!-- Profile section -->
      <div class="flex items-center gap-3 mb-6 pb-5 border-b border-line">
        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-brand to-cta flex items-center justify-center text-white font-bold text-lg">${drawerAvatar}</div>
        <div class="flex-1">
          <p class="text-sm font-bold">${userName}</p>
          <p class="text-[10px] text-fg-muted">حساب شخصی</p>
        </div>
        <button onclick="window.closeDrawer()" class="w-8 h-8 rounded-lg glass flex items-center justify-center" aria-label="بستن">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <!-- Menu items -->
      <div class="space-y-1.5">
        ${itemsHtml}
      </div>

      <!-- Bottom info -->
      <div class="mt-8 pt-5 border-t border-line text-center">
        <p class="text-[10px] text-fg-subtle">نسخه ۱.۰.۰ · ۱۴۰۴</p>
      </div>
    </div>
  `;

  return content;
}

export function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderHeader()}
    <main id="page-content" class="pb-24 page-enter"></main>
    ${renderBottomNav()}
  `;

  // expose navigation globally
  window.__navigate = (path) => navigate(path);
  window.__openDrawer = () => {
    openDrawer(renderDrawer(), {
      onMount: () => {
        if (window.lucide) window.lucide.createIcons();
      }
    });
  };
  window.closeDrawer = closeDrawer;
  window.__openSearch = openSearch;

  if (window.lucide) window.lucide.createIcons();
}

// === جستجوی سراسری ===
// جستجو در پروژه‌ها، کارفرماها، شرکا، ابزارآلات و تراکنش‌ها
function openSearch() {
  const content = `
    <div class="pb-2">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold">جستجو</h3>
        <button onclick="window.__closeSearch()" class="w-8 h-8 rounded-lg glass flex items-center justify-center">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="relative mb-3">
        <i data-lucide="search" class="w-4 h-4 text-fg-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
        <input id="global-search-input" type="text" placeholder="جستجوی پروژه، کارفرما، شریک..."
          class="w-full h-11 pr-10 pl-4 rounded-xl bg-ink-soft border border-line focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-sm transition" />
      </div>
      <div id="global-search-results" class="max-h-[55vh] overflow-y-auto">
        <p class="text-center text-xs text-fg-muted py-6">برای شروع، چیزی تایپ کنید...</p>
      </div>
    </div>
  `;

  openSheet(content, {
    onMount: () => {
      window.__closeSearch = () => closeSheet();
      const input = document.getElementById('global-search-input');
      if (input) {
        input.focus();
        input.addEventListener('input', (e) => {
          runSearch(e.target.value || '');
        });
      }
      if (window.lucide) window.lucide.createIcons();
    }
  });
}

function runSearch(query) {
  const resultsEl = document.getElementById('global-search-results');
  if (!resultsEl) return;

  const q = (query || '').trim().toLowerCase();
  if (!q) {
    resultsEl.innerHTML = `<p class="text-center text-xs text-fg-muted py-6">برای شروع، چیزی تایپ کنید...</p>`;
    return;
  }

  const sections = [];

  // پروژه‌ها
  const projects = (state.data.projects || []).filter(p =>
    !p.deletedAt && (p.title || '').toLowerCase().includes(q)
  );
  if (projects.length > 0) {
    sections.push({
      title: 'پروژه‌ها',
      icon: 'briefcase',
      items: projects.map(p => ({
        label: p.title,
        sub: p.amount ? String(p.amount) : '',
        path: `/project/${p.id}`
      }))
    });
  }

  // کارفرماها
  const employers = (state.data.employers || []).filter(e =>
    !e.deletedAt && (e.name || '').toLowerCase().includes(q)
  );
  if (employers.length > 0) {
    sections.push({
      title: 'کارفرماها',
      icon: 'user',
      items: employers.map(e => ({
        label: e.name,
        sub: e.phone || '',
        path: '/employers'
      }))
    });
  }

  // شرکا
  const partners = (state.data.partners || []).filter(p =>
    !p.deletedAt && (p.name || '').toLowerCase().includes(q)
  );
  if (partners.length > 0) {
    sections.push({
      title: 'شرکا',
      icon: 'users',
      items: partners.map(p => ({
        label: p.name,
        sub: p.phone || '',
        path: '/partners'
      }))
    });
  }

  // ابزارآلات
  const equipment = (state.data.equipment || []).filter(eq =>
    !eq.deletedAt && (eq.name || '').toLowerCase().includes(q)
  );
  if (equipment.length > 0) {
    sections.push({
      title: 'ابزارآلات',
      icon: 'tool',
      items: equipment.map(eq => ({
        label: eq.name,
        sub: eq.serialNumber || '',
        path: '/equipment'
      }))
    });
  }

  // تراکنش‌ها (دریافتی‌ها، هزینه‌ها، انتقال‌ها) — بر اساس عنوان یا مبلغ
  const txItems = [];
  for (const r of (state.data.receipts || [])) {
    if (r.deletedAt) continue;
    if (String(r.amount || '').includes(q) || (r.note || '').toLowerCase().includes(q)) {
      const employer = (state.data.employers || []).find(e => e.id === r.employerId);
      txItems.push({
        label: `دریافتی از ${employer ? employer.name : 'کارفرما'}`,
        sub: String(r.amount || ''),
        path: '/transactions'
      });
    }
  }
  for (const ex of (state.data.expenses || [])) {
    if (ex.deletedAt) continue;
    if ((ex.title || '').toLowerCase().includes(q) || String(ex.amount || '').includes(q)) {
      txItems.push({
        label: ex.title || 'هزینه',
        sub: String(ex.amount || ''),
        path: '/transactions'
      });
    }
  }
  for (const t of (state.data.partnerTransfers || [])) {
    if (t.deletedAt) continue;
    if (String(t.amount || '').includes(q) || (t.note || '').toLowerCase().includes(q)) {
      const toP = (state.data.partners || []).find(p => p.id === t.toPartnerId);
      txItems.push({
        label: `انتقال به ${toP ? toP.name : 'شریک'}`,
        sub: String(t.amount || ''),
        path: '/transactions'
      });
    }
  }
  if (txItems.length > 0) {
    sections.push({
      title: 'تراکنش‌ها',
      icon: 'arrow-left-right',
      items: txItems.slice(0, 10)
    });
  }

  if (sections.length === 0) {
    resultsEl.innerHTML = `
      <div class="text-center py-10">
        <div class="w-12 h-12 rounded-2xl glass-strong flex items-center justify-center mx-auto mb-3">
          <i data-lucide="search-x" class="w-6 h-6 text-fg-muted"></i>
        </div>
        <p class="text-xs text-fg-muted">نتیجه‌ای برای «${query}» یافت نشد</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  resultsEl.innerHTML = sections.map(section => `
    <div class="mb-4">
      <div class="flex items-center gap-1.5 mb-1.5 px-1">
        <i data-lucide="${section.icon}" class="w-3.5 h-3.5 text-fg-muted"></i>
        <p class="text-xs font-bold text-fg-muted">${section.title}</p>
        <span class="text-[10px] text-fg-subtle">${toPersianDigitsSearch(section.items.length)}</span>
      </div>
      <div class="space-y-1">
        ${section.items.map(item => `
          <button onclick="window.__searchNavigate('${item.path}')" class="w-full glass rounded-xl p-3 flex items-center gap-2.5 hover:bg-white/8 transition text-right">
            <i data-lucide="chevron-left" class="w-4 h-4 text-fg-muted shrink-0"></i>
            <span class="flex-1 text-xs font-medium truncate">${item.label}</span>
            ${item.sub ? `<span class="text-[10px] text-fg-muted tabular-nums shrink-0">${item.sub}</span>` : ''}
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');

  window.__searchNavigate = (path) => {
    closeSheet();
    navigate(path);
  };

  if (window.lucide) window.lucide.createIcons();
}

// تبدیل اعداد لاتین به فارسی (نسخه محلی برای shell.js)
function toPersianDigitsSearch(input) {
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(input).replace(/\d/g, d => persian[d]);
}

// به‌روزرسانی فقط header (وقتی route تغییر می‌کند)
export function refreshHeader() {
  const headerEl = document.querySelector('header');
  if (headerEl) {
    headerEl.outerHTML = renderHeader();
    if (window.lucide) window.lucide.createIcons();
  }

  // به‌روزرسانی bottom nav
  const navEl = document.querySelector('nav.fixed.bottom-0');
  if (navEl) {
    navEl.outerHTML = renderBottomNav();
    if (window.lucide) window.lucide.createIcons();
  }
}
