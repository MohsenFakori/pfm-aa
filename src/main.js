// src/main.js
// نقطه ورود اپلیکیشن — فاز 0/2 PRD

import './styles/main.css';
import { createIcons } from 'lucide';
import { getIcons } from './ui/components/icons.js';

// Make lucide available globally for inline usage
if (typeof window !== 'undefined') {
  const icons = getIcons();
  const renderIcons = () => createIcons({ icons });
  window.lucide = { createIcons: renderIcons, icons };
}

import { state } from './core/state.js';
import './core/local-auth.js';
import { restoreUserSession, isSessionActive } from './core/user-session.js';
import { initRouter, registerRoute, navigate } from './core/router.js';
import { renderShell, refreshHeader } from './ui/components/shell.js';
import './ui/components/toast.js';
import './ui/components/sheet.js';

// Import all page renderers (static imports for frequently-used screens)
import { renderDashboardPage } from './ui/screens/dashboard.js';
import { renderProjectsPage, renderProjectDetailPage } from './ui/screens/projects.js';
import { renderActivityPage, renderAddActivityPage } from './ui/screens/activity.js';
import { renderEmployersPage } from './ui/screens/employers.js';
import { renderPartnersPage } from './ui/screens/partners.js';
import { renderTransactionsPage, renderAddTransactionPage } from './ui/screens/transactions.js';
import { renderAddExpensePage, renderAddTransferPage } from './ui/screens/expenses.js';
import { renderOnboardingPage } from './ui/screens/onboarding.js';
import { renderProfilePage } from './ui/screens/profile.js';
import { renderAuthPage } from './ui/screens/auth.js';

// Less-used screens are loaded lazily via dynamic import (code-splitting)
// - reports.js
// - backup.js (settings + backup)
// - equipment.js
async function renderReportsPageLazy(params) {
  const { renderReportsPage } = await import('./ui/screens/reports.js');
  renderReportsPage(params);
}
async function renderBackupPageLazy(params) {
  const { renderBackupPage } = await import('./ui/screens/backup.js');
  renderBackupPage(params);
}
async function renderSettingsPageLazy(params) {
  const { renderSettingsPage } = await import('./ui/screens/backup.js');
  renderSettingsPage(params);
}
async function renderEquipmentPageLazy(params) {
  const { renderEquipmentPage } = await import('./ui/screens/equipment.js');
  renderEquipmentPage(params);
}

let initialized = false;

async function init() {
  if (initialized) return;
  initialized = true;

  try {
    // 1. Restore local account and hydrate only that account's database
    await restoreUserSession();

    // 2. Register routes
    registerRoute('/dashboard', renderDashboardPage);
    registerRoute('/projects', renderProjectsPage);
    registerRoute('/project/:id', renderProjectDetailPage);
    registerRoute('/activity', renderActivityPage);
    registerRoute('/activity/add', renderAddActivityPage);
    registerRoute('/reports', renderReportsPageLazy);
    registerRoute('/employers', renderEmployersPage);
    registerRoute('/partners', renderPartnersPage);
    registerRoute('/equipment', renderEquipmentPageLazy);
    registerRoute('/transactions', renderTransactionsPage);
    registerRoute('/transaction/add', renderAddTransactionPage);
    registerRoute('/expense/add', renderAddExpensePage);
    registerRoute('/transfer/add', renderAddTransferPage);
    registerRoute('/backup', renderBackupPageLazy);
    registerRoute('/settings', renderSettingsPageLazy);
    registerRoute('/profile', renderProfilePage);
    registerRoute('/auth', renderAuthPage);
    registerRoute('/onboarding', renderOnboardingPage);

    // 3. Wrap each route to render shell first then page
    for (const [path, handler] of routesIterator()) {
      registerRoute(path, (params) => {
        const settings = state.data.settings || {};
        // Require a local account before opening user data
        if (!isSessionActive() && path !== '/auth') {
          navigate('/auth');
          return;
        }
        if (isSessionActive() && path === '/auth') {
          navigate(settings.onboardingCompleted ? '/dashboard' : '/onboarding');
          return;
        }
        if (!isSessionActive() && path === '/auth') {
          document.getElementById('app').innerHTML = '<main id="page-content" class="min-h-screen"></main>';
          handler(params);
          if (window.lucide) window.lucide.createIcons();
          return;
        }
        // If onboarding not completed and route isn't onboarding → redirect to onboarding
        if (isSessionActive() && !settings.onboardingCompleted && path !== '/onboarding' && path !== '/auth') {
          navigate('/onboarding');
          return;
        }
        // If route is onboarding → render without shell
        if (path === '/onboarding') {
          renderOnboardingPage();
          return;
        }
        // Otherwise: render shell then page
        renderShell();
        handler(params);
        refreshHeader();
        if (window.lucide) window.lucide.createIcons();
      });
    }

    // 4. Initialize router (will trigger initial route)
    initRouter();
  } catch (e) {
    console.error('App init failed:', e);
    // Show error to user
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="min-h-screen flex items-center justify-center p-6 text-center">
          <div>
            <div class="w-16 h-16 rounded-2xl bg-danger-soft text-danger flex items-center justify-center mx-auto mb-4">
              <i data-lucide="alert-triangle" class="w-8 h-8"></i>
            </div>
            <h2 class="text-lg font-bold mb-2">خطا در راه‌اندازی اپ</h2>
            <p class="text-sm text-fg-muted mb-4">${e.message || 'خطای ناشناخته'}</p>
            <button onclick="location.reload()" class="h-11 px-5 rounded-xl bg-brand text-white text-sm font-medium">
              تلاش مجدد
            </button>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

// Helper to iterate over registered routes
function routesIterator() {
  // We can't directly iterate the routes Map (private to router module)
  // So we re-list them here
  return [
    ['/dashboard', renderDashboardPage],
    ['/projects', renderProjectsPage],
    ['/project/:id', renderProjectDetailPage],
    ['/activity', renderActivityPage],
    ['/activity/add', renderAddActivityPage],
    ['/reports', renderReportsPageLazy],
    ['/employers', renderEmployersPage],
    ['/partners', renderPartnersPage],
    ['/equipment', renderEquipmentPageLazy],
    ['/transactions', renderTransactionsPage],
    ['/transaction/add', renderAddTransactionPage],
    ['/expense/add', renderAddExpensePage],
    ['/transfer/add', renderAddTransferPage],
    ['/backup', renderBackupPageLazy],
    ['/settings', renderSettingsPageLazy],
    ['/profile', renderProfilePage],
    ['/auth', renderAuthPage],
    ['/onboarding', renderOnboardingPage]
  ];
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
