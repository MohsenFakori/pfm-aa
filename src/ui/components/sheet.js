// src/ui/components/sheet.js
// Bottom Sheet و Side Drawer — فاز 2 PRD

let currentSheet = null;
let currentDrawer = null;

// === Bottom Sheet ===
export function openSheet(contentHtml, options = {}) {
  closeSheet(); // بستن sheet قبلی

  const backdrop = document.createElement('div');
  backdrop.className = 'overlay-backdrop';
  backdrop.onclick = () => closeSheet();

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';
  sheet.innerHTML = `
    <div class="px-5 pt-5 pb-8 sheet-content">${contentHtml}</div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  document.body.style.overflow = 'hidden';

  currentSheet = { backdrop, sheet };

  if (window.lucide) window.lucide.createIcons();

  if (options.onMount) {
    setTimeout(() => options.onMount(sheet), 50);
  }

  return sheet;
}

export function closeSheet() {
  if (currentSheet) {
    currentSheet.backdrop.remove();
    currentSheet.sheet.remove();
    currentSheet = null;
    document.body.style.overflow = '';
  }
}

// === Side Drawer ===
export function openDrawer(contentHtml, options = {}) {
  closeDrawer();

  const backdrop = document.createElement('div');
  backdrop.className = 'overlay-backdrop';
  backdrop.onclick = () => closeDrawer();

  const drawer = document.createElement('div');
  drawer.className = 'side-drawer';
  drawer.innerHTML = `
    <div class="drawer-content">${contentHtml}</div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);
  document.body.style.overflow = 'hidden';

  currentDrawer = { backdrop, drawer };

  if (window.lucide) window.lucide.createIcons();

  if (options.onMount) {
    setTimeout(() => options.onMount(drawer), 50);
  }

  return drawer;
}

export function closeDrawer() {
  if (currentDrawer) {
    currentDrawer.backdrop.remove();
    currentDrawer.drawer.remove();
    currentDrawer = null;
    document.body.style.overflow = '';
  }
}

// === Confirm Dialog (modal در bottom sheet) ===
export function confirmDialog({ title, message, confirmText = 'تأیید', cancelText = 'انصراف', danger = false, onConfirm, onCancel }) {
  const content = `
    <div class="text-center pt-2">
      <div class="w-14 h-14 rounded-2xl ${danger ? 'bg-danger-soft' : 'bg-warning-soft'} flex items-center justify-center mx-auto mb-4">
        <i data-lucide="${danger ? 'alert-triangle' : 'circle-help'}" class="w-7 h-7 ${danger ? 'text-danger' : 'text-warning'}"></i>
      </div>
      <h3 class="text-base font-bold mb-2">${title}</h3>
      <p class="text-xs text-fg-muted mb-6 px-4">${message}</p>
      <div class="flex gap-2">
        <button onclick="window.__cancelConfirm()" class="flex-1 h-11 rounded-xl glass text-sm font-medium hover:bg-white/10 transition">${cancelText}</button>
        <button onclick="window.__confirmConfirm()" class="flex-1 h-11 rounded-xl ${danger ? 'bg-danger hover:bg-danger/90' : 'bg-brand hover:bg-brand-dark'} text-white text-sm font-medium transition">${confirmText}</button>
      </div>
    </div>
  `;

  const sheet = openSheet(content);

  window.__cancelConfirm = () => {
    closeSheet();
    if (onCancel) onCancel();
  };
  window.__confirmConfirm = () => {
    closeSheet();
    if (onConfirm) onConfirm();
  };

  return sheet;
}

// expose globally
window.openSheet = openSheet;
window.closeSheet = closeSheet;
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;
window.confirmDialog = confirmDialog;
