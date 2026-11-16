// src/core/router.js
// Hash-based router — فاز 2 PRD

const routes = new Map();
let currentRoute = null;
const titleElement = null;

export function registerRoute(path, handler) {
  routes.set(path, handler);
}

export function navigate(path) {
  if (window.location.hash !== '#' + path) {
    window.location.hash = path;
  } else {
    handleRoute();
  }
}

export function handleRoute() {
  let hash = window.location.hash.slice(1) || '/dashboard';
  if (hash === '' || hash === '/') hash = '/dashboard';

  // پیدا کردن route تطابق‌دار (با پشتیبانی از پارامترها)
  let matched = null;
  let params = {};

  for (const [pattern, handler] of routes.entries()) {
    if (pattern.includes(':')) {
      // پترن با پارامتر
      const patternParts = pattern.split('/');
      const hashParts = hash.split('/');
      if (patternParts.length === hashParts.length) {
        const allMatch = patternParts.every((pp, i) => {
          if (pp.startsWith(':')) {
            params[pp.slice(1)] = decodeURIComponent(hashParts[i]);
            return true;
          }
          return pp === hashParts[i];
        });
        if (allMatch) {
          matched = handler;
          break;
        }
      }
    } else if (pattern === hash) {
      matched = handler;
      break;
    }
  }

  if (matched) {
    currentRoute = hash;
    matched(params);
    // اسکرول به بالا
    const main = document.getElementById('page-content');
    if (main) main.scrollTop = 0;
  } else {
    // 404 — به داشبورد برگردان
    navigate('/dashboard');
  }
}

export function getCurrentRoute() {
  return currentRoute;
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  // اگر hash خالی بود، به /dashboard برو
  if (!window.location.hash) {
    window.location.hash = '/dashboard';
  } else {
    handleRoute();
  }
}
