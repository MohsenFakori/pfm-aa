
/**
 * pwa.js: SW registration, safe updates, install UX, network status.
 */

(() => {
  'use strict';

  const BASE = '/';
  const APP_PREFIX = 'pfm';
  const UPDATE_CHECK_MS = 60 * 60 * 1000;
  const INSTALL_SNOOZE_DAYS = 14;

  // ==========================================
  // DEVELOPMENT MODE
  // ==========================================

  // تغییر ۱: تشخیص محیط توسعه Vite
  const IS_DEV = import.meta.env.DEV;

  const T = {
    updateReady: 'نسخهٔ جدید آماده است.',
    update: 'به‌روزرسانی',
    installPitch: 'اپلیکیشن را نصب کنید تا سریع‌تر و حتی بدون اینترنت در دسترس باشد.',
    install: 'نصب',
    iosTitle: 'نصب روی آیفون:',
    iosSteps: [
      'دکمهٔ «اشتراک‌گذاری» مرورگر را بزنید.',
      'گزینهٔ «Add to Home Screen» را انتخاب کنید.',
      'روی «Add» بزنید.',
    ],
    inApp: 'برای نصب اپلیکیشن، این صفحه را در مرورگر Chrome یا Safari باز کنید.',
    offline: 'اتصال به سرور برقرار نیست؛ اطلاعات ذخیره‌شده نمایش داده می‌شود.',
    online: 'اتصال دوباره برقرار شد.',
    close: 'بستن',
  };

  const store = {
    get: (key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },

    set: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
  };

  // ───────────── Banners ─────────────

  function banner(id, message, { actionLabel, onAction, onClose, steps } = {}) {
    closeBanner(id);

    let host = document.getElementById('pwa-banners');

    if (!host) {
      host = document.createElement('div');
      host.id = 'pwa-banners';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }

    const box = document.createElement('div');
    box.className = 'pwa-banner';
    box.dataset.id = id;
    box.setAttribute('role', 'status');

    const text = document.createElement('div');
    text.className = 'pwa-banner__text';
    text.textContent = message;

    if (steps) {
      const list = document.createElement('ol');

      steps.forEach(step => {
        const item = document.createElement('li');
        item.textContent = step;
        list.appendChild(item);
      });

      text.appendChild(list);
    }

    box.appendChild(text);

    if (actionLabel) {
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'pwa-banner__action';
      action.textContent = actionLabel;

      action.addEventListener('click', () => {
        closeBanner(id);
        onAction?.();
      });

      box.appendChild(action);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'pwa-banner__close';
    close.setAttribute('aria-label', T.close);
    close.textContent = '×';

    close.addEventListener('click', () => {
      closeBanner(id);
      onClose?.();
    });

    box.appendChild(close);
    host.appendChild(box);
  }

  function closeBanner(id) {
    document.querySelector(`#pwa-banners [data-id="${id}"]`)?.remove();
  }

  // ───────────── 1. Service Worker ─────────────

  if (IS_DEV) {

    // تغییر ۲: در Development تمام Service Workerهای قبلی لغو می‌شوند.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
          .then(registrations => {
            registrations.forEach(reg => {
              reg.unregister();
            });
          })
          .catch(error => {
            console.warn('[PWA] SW cleanup failed:', error);
          });
    }

    // تغییر ۳: فقط کش‌های متعلق به این برنامه پاک می‌شوند.
    if ('caches' in window) {
      caches.keys()
          .then(keys => {
            return Promise.all(
                keys
                    .filter(key => key.startsWith(`${APP_PREFIX}-`))
                    .map(key => caches.delete(key))
            );
          })
          .catch(error => {
            console.warn('[PWA] Cache cleanup failed:', error);
          });
    }

    console.info('[PWA] Disabled in development mode.');

  } else {

    // Production: ثبت Service Worker فعال باقی می‌ماند.

    if ('serviceWorker' in navigator) {

      let hadController = Boolean(navigator.serviceWorker.controller);
      let reloading = false;

      navigator.serviceWorker.addEventListener('controllerchange', () => {

        if (!hadController) {
          hadController = true;
          return;
        }

        if (reloading) return;

        reloading = true;
        window.location.reload();
      });

      const register = async () => {
        try {
          const reg = await navigator.serviceWorker.register(
              BASE + 'sw.js',
              {
                scope: BASE,
                updateViaCache: 'none'
              }
          );

          watchForUpdates(reg);

        } catch (error) {
          console.error('[PWA] SW registration failed:', error);
        }
      };

      if (document.readyState === 'complete') {
        register();
      } else {
        window.addEventListener('load', register, { once: true });
      }
    }

  }

  function watchForUpdates(reg) {

    const offer = (worker) => banner('update', T.updateReady, {
      actionLabel: T.update,

      onAction: () => {
        worker.postMessage({ type: 'SKIP_WAITING' });
      },
    });

    if (reg.waiting && navigator.serviceWorker.controller) {
      offer(reg.waiting);
    }

    reg.addEventListener('updatefound', () => {

      const worker = reg.installing;

      if (!worker) return;

      worker.addEventListener('statechange', () => {

        if (
            worker.state === 'installed' &&
            navigator.serviceWorker.controller
        ) {
          offer(worker);
        }

      });
    });

    let lastCheck = Date.now();

    const check = () => {
      lastCheck = Date.now();
      reg.update().catch(() => {});
    };

    setInterval(check, UPDATE_CHECK_MS);

    document.addEventListener('visibilitychange', () => {

      if (
          document.visibilityState === 'visible' &&
          Date.now() - lastCheck > 10 * 60 * 1000
      ) {
        check();
      }

    });
  }

  // ───────────── 2. Install UX ─────────────

  const ua = navigator.userAgent;

  const isStandalone = () =>
      [
        'standalone',
        'fullscreen',
        'minimal-ui',
        'window-controls-overlay'
      ].some(mode =>
          window.matchMedia(`(display-mode: ${mode})`).matches
      )
      || window.navigator.standalone === true;

  const isIOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (
          navigator.platform === 'MacIntel' &&
          navigator.maxTouchPoints > 1
      );

  const isInAppBrowser =
      /FBAN|FBAV|Instagram|Telegram|WhatsApp|Line\/|; wv\)/i.test(ua);

  const SNOOZE_KEY = 'pwa:install-snoozed-at';

  const snoozed = () =>
      Date.now() - Number(store.get(SNOOZE_KEY) || 0) <
      INSTALL_SNOOZE_DAYS * 864e5;

  const snooze = () =>
      store.set(SNOOZE_KEY, String(Date.now()));

  const root = document.documentElement;

  // تغییر ۴: در Development هیچ قابلیت نصب PWA فعال نمی‌شود.
  if (!IS_DEV) {

    root.classList.toggle(
        'pwa-ios-installable',
        isIOS && !isInAppBrowser && !isStandalone()
    );

    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredPrompt = event;
      root.classList.add('pwa-can-install');
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      root.classList.remove('pwa-can-install');
      closeBanner('install');
    });

    async function promptInstall() {

      if (deferredPrompt) {

        const promptEvent = deferredPrompt;
        deferredPrompt = null;

        root.classList.remove('pwa-can-install');

        promptEvent.prompt();

        const { outcome } = await promptEvent.userChoice;

        if (outcome === 'dismissed') {
          snooze();
        }

        return outcome;
      }

      if (isInAppBrowser) {
        banner('install', T.inApp, { onClose: snooze });
        return 'in-app-browser';
      }

      if (isIOS && !isStandalone()) {
        banner('install', T.iosTitle, {
          steps: T.iosSteps,
          onClose: snooze
        });

        return 'ios-guide';
      }

      return 'unavailable';
    }

    function suggestInstall() {

      if (isStandalone() || snoozed()) return;

      if (deferredPrompt) {

        banner('install', T.installPitch, {
          actionLabel: T.install,
          onAction: promptInstall,
          onClose: snooze
        });

      } else if (isInAppBrowser || isIOS) {
        promptInstall();
      }
    }

    document.addEventListener('click', (event) => {
      if (event.target.closest?.('[data-pwa-install]')) {
        promptInstall();
      }
    });

    try {

      if (!sessionStorage.getItem('pwa:session')) {

        sessionStorage.setItem('pwa:session', '1');

        store.set(
            'pwa:sessions',
            String(Number(store.get('pwa:sessions') || 0) + 1)
        );

      }

    } catch {}

    if (Number(store.get('pwa:sessions') || 0) >= 2) {
      setTimeout(suggestInstall, 20000);
    }

    window.PWA = {
      promptInstall,
      suggestInstall,
      isStandalone
    };

  } else {

    // Development: رابط PWA برای جلوگیری از خطا در سایر بخش‌ها
    window.PWA = {
      promptInstall: async () => 'disabled',
      suggestInstall: () => {},
      isStandalone: () => false
    };

    root.classList.remove('pwa-ios-installable', 'pwa-can-install');

  }

  // ───────────── 3. Network status ─────────────

  // این قسمت در Development و Production فعال باقی می‌ماند.

  let wasOffline = false;

  function setOffline(offline) {

    root.classList.toggle('is-offline', offline);

    if (offline) {

      banner('network', T.offline);

    } else if (wasOffline) {

      banner('network', T.online);

      setTimeout(() => closeBanner('network'), 3000);

    }

    wasOffline = offline;
  }

  window.addEventListener('offline', () => setOffline(true));
  window.addEventListener('online', () => setOffline(false));

  if (navigator.onLine === false) {
    setOffline(true);
  }

})();
