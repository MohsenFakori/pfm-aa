// src/ui/components/toast.js
// Toast notifications — فاز 2 PRD

const TOAST_CONFIG = {
  success: { bg: 'glass-strong', text: 'text-success', icon: 'check-circle', border: 'border-success/30' },
  error:   { bg: 'glass-strong', text: 'text-danger',  icon: 'x-circle',       border: 'border-danger/30' },
  info:    { bg: 'glass-strong', text: 'text-purple-300', icon: 'info',         border: 'border-info/30' },
  warning: { bg: 'glass-strong', text: 'text-warning', icon: 'alert-triangle', border: 'border-warning/30' }
};

let toastContainer = null;

function getContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

export function showToast(message, type = 'info', options = {}) {
  // Backward-compatibility: third arg could be a duration (number) or an options object.
  if (typeof options === 'number') {
    options = { duration: options };
  }
  const {
    duration = 3000,
    actionLabel = null,
    onAction = null
  } = options;

  const cfg = TOAST_CONFIG[type] || TOAST_CONFIG.info;
  const container = getContainer();
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${cfg.bg} ${cfg.border} border ${cfg.text} px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm font-medium w-full`;
  toast.innerHTML = `<i data-lucide="${cfg.icon}" class="w-4 h-4 shrink-0"></i><span class="flex-1">${message}</span>`;

  // Optional action button (e.g. undo)
  let actionId = null;
  if (actionLabel && typeof onAction === 'function') {
    actionId = 'toast-action-' + Math.random().toString(36).slice(2, 10);
    const btn = document.createElement('button');
    btn.id = actionId;
    btn.className = 'shrink-0 px-3 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold transition';
    btn.textContent = actionLabel;
    btn.onclick = (e) => {
      e.stopPropagation();
      try { onAction(); } catch (err) { console.error('Toast action error:', err); }
      dismissToast();
    };
    toast.appendChild(btn);
  }

  container.appendChild(toast);

  if (window.lucide) window.lucide.createIcons();

  let timer = null;
  function dismissToast() {
    if (timer) { clearTimeout(timer); timer = null; }
    toast.classList.add('leaving');
    setTimeout(() => { toast.remove(); }, 200);
  }

  timer = setTimeout(dismissToast, duration);
}


// expose globally
window.showToast = showToast;
