// src/ui/components/ui.js
// کامپوننت‌های پایه UI Kit — فاز 2 PRD

import { icon } from './icons.js';

// === Button ===
export function Button({ variant = 'primary', size = 'md', icon: iconName, label, onClick, type = 'button', disabled = false, classes = '' }) {
  const variants = {
    primary: 'bg-cta hover:bg-cta-dark text-white shadow-lg shadow-cta/30',
    brand:   'bg-brand hover:bg-brand-dark text-white shadow-lg shadow-brand/30',
    ghost:   'glass-strong hover:bg-white/15 text-white',
    outline: 'border border-line-strong hover:bg-white/5 text-white',
    danger:  'text-fg-muted hover:text-danger hover:bg-danger/10',
    success: 'bg-success hover:bg-success/90 text-white shadow-lg shadow-success/30',
    text:    'text-fg-muted hover:text-fg hover:bg-white/5'
  };

  const sizes = {
    sm: 'h-9 px-3 text-xs',
    md: 'h-11 px-5 text-sm',
    lg: 'h-12 px-6 text-base',
    icon: 'w-11 h-11'
  };

  const onclickAttr = onClick ? `onclick="${onClick}"` : '';
  const disabledAttr = disabled ? 'disabled' : '';

  return `
    <button type="${type}" ${disabledAttr} ${onclickAttr}
      class="rounded-xl font-medium transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${classes}">
      ${iconName ? icon(iconName, 'w-4 h-4') : ''}
      ${label ? `<span>${label}</span>` : ''}
    </button>
  `;
}

// === Badge ===
export function Badge({ variant = 'default', icon: iconName, label, classes = '' }) {
  const variants = {
    default:   'glass text-fg-muted',
    success:   'bg-success-soft text-success',
    warning:   'bg-warning-soft text-warning',
    danger:    'bg-danger-soft text-danger',
    info:      'bg-info-soft text-purple-300',
    brand:     'bg-brand/15 text-brand',
    cta:       'bg-cta/15 text-cta'
  };

  return `
    <span class="px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 ${variants[variant]} ${classes}">
      ${iconName ? icon(iconName, 'w-3 h-3') : ''}
      <span>${label}</span>
    </span>
  `;
}

// === Card ===
export function Card({ children, classes = '', variant = 'glass' }) {
  const variants = {
    glass: 'glass rounded-2xl',
    'glass-strong': 'glass-strong rounded-2xl',
    plain: 'rounded-2xl'
  };
  return `<div class="${variants[variant] || variant} ${classes}">${children}</div>`;
}

// === Avatar ===
export function Avatar({ text, color = 'brand', size = 'md', status = null }) {
  const colorMap = {
    brand:   'from-brand to-brand-dark',
    cta:     'from-cta to-cta-dark',
    purple:  'from-purple-500 to-pink-500',
    cyan:    'from-cyan-500 to-blue-500',
    pink:    'from-pink-500 to-rose-500',
    success: 'from-success to-emerald-700',
    warning: 'from-warning to-cta',
    info:    'from-info to-purple-500'
  };

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-20 h-20 text-2xl'
  };

  return `
    <div class="relative inline-block">
      <div class="rounded-full bg-gradient-to-br ${colorMap[color] || colorMap.brand} flex items-center justify-center text-white font-bold ${sizes[size]}">${text}</div>
      ${status ? `<span class="absolute bottom-0 left-0 w-3 h-3 rounded-full bg-${status === 'online' ? 'success' : 'fg-muted'} border-2 border-ink"></span>` : ''}
    </div>
  `;
}

// === Input ===
export function Input({ type = 'text', placeholder = '', value = '', name, label, icon: iconName, suffix, required = false, classes = '', inputmode = '' }) {
  const requiredAttr = required ? 'required' : '';
  const inputmodeAttr = inputmode ? `inputmode="${inputmode}"` : '';

  return `
    <div class="${classes}">
      ${label ? `<label class="text-xs text-fg-muted mb-1.5 block">${label}${required ? ' <span class="text-danger">*</span>' : ''}</label>` : ''}
      <div class="relative">
        ${iconName ? `<i data-lucide="${iconName}" class="w-4 h-4 text-fg-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>` : ''}
        <input type="${type}" name="${name || ''}" placeholder="${placeholder}" value="${value}" ${requiredAttr} ${inputmodeAttr}
          class="w-full h-11 ${iconName ? 'pr-10' : 'pr-4'} ${suffix ? 'pl-20' : 'pl-4'} rounded-xl bg-ink-soft border border-line focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-sm transition ${type === 'number' ? 'tabular-nums' : ''}" />
        ${suffix ? `<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-fg-muted bg-white/5 px-2 py-1 rounded-md pointer-events-none">${suffix}</span>` : ''}
      </div>
    </div>
  `;
}

// === Textarea ===
export function Textarea({ placeholder = '', value = '', name, label, rows = 3, classes = '' }) {
  return `
    <div class="${classes}">
      ${label ? `<label class="text-xs text-fg-muted mb-1.5 block">${label}</label>` : ''}
      <textarea name="${name || ''}" placeholder="${placeholder}" rows="${rows}"
        class="w-full p-3 rounded-xl bg-ink-soft border border-line focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-sm transition resize-none">${value}</textarea>
    </div>
  `;
}

// === Select ===
export function Select({ name, label, options = [], value = '', placeholder = 'انتخاب کنید', required = false, classes = '', icon: iconName }) {
  const requiredAttr = required ? 'required' : '';
  const optionsHtml = options.map(opt => {
    const val = typeof opt === 'string' ? opt : opt.value;
    const lbl = typeof opt === 'string' ? opt : opt.label;
    const selected = val === value ? 'selected' : '';
    return `<option value="${val}" ${selected} style="background: #0f1d32;">${lbl}</option>`;
  }).join('');

  return `
    <div class="${classes}">
      ${label ? `<label class="text-xs text-fg-muted mb-1.5 block">${label}${required ? ' <span class="text-danger">*</span>' : ''}</label>` : ''}
      <div class="relative">
        ${iconName ? `<i data-lucide="${iconName}" class="w-4 h-4 text-fg-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10"></i>` : ''}
        <select name="${name || ''}" ${requiredAttr}
          class="w-full h-11 ${iconName ? 'pr-10' : 'pr-4'} pl-4 rounded-xl bg-ink-soft border border-line focus:border-brand outline-none text-sm transition appearance-none cursor-pointer">
          <option value="" style="background: #0f1d32;" ${!value ? 'selected' : ''}>${placeholder}</option>
          ${optionsHtml}
        </select>
        <i data-lucide="chevron-down" class="w-4 h-4 text-fg-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
      </div>
    </div>
  `;
}

// === Empty State ===
export function EmptyState({ icon: iconName = 'inbox', title, description, actionLabel, actionIcon, actionOnClick }) {
  return `
    <div class="flex flex-col items-center justify-center text-center py-10 px-4">
      <div class="w-16 h-16 rounded-2xl glass-strong flex items-center justify-center mb-4">
        <i data-lucide="${iconName}" class="w-8 h-8 text-fg-muted"></i>
      </div>
      <h5 class="text-base font-bold mb-1">${title}</h5>
      ${description ? `<p class="text-xs text-fg-muted mb-4 max-w-[240px]">${description}</p>` : ''}
      ${actionLabel ? `<button onclick="${actionOnClick || ''}" class="cursor-pointer h-10 px-4 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-cta/30">
        ${actionIcon ? icon(actionIcon, 'w-4 h-4') : icon('plus', 'w-4 h-4')}
        <span>${actionLabel}</span>
      </button>` : ''}
    </div>
  `;
}

// === Skeleton ===
export function Skeleton({ lines = 3, classes = '' }) {
  let html = '';
  for (let i = 0; i < lines; i++) {
    html += `<div class="h-3 rounded skeleton mb-2" style="width: ${100 - i * 15}%"></div>`;
  }
  return `<div class="${classes}">${html}</div>`;
}

// === Tabs ===
export function Tabs({ tabs = [], activeTab, onChange, classes = '' }) {
  const tabsHtml = tabs.map(t => {
    const isActive = t.id === activeTab;
    return `
      <button onclick="${onChange}('${t.id}')" class="flex-1 h-9 rounded-lg ${isActive ? 'tab-active' : 'text-fg-muted hover:bg-white/5'} text-xs font-medium transition">
        ${t.label}
      </button>
    `;
  }).join('');

  return `
    <div class="flex rounded-xl glass p-1 ${classes}">
      ${tabsHtml}
    </div>
  `;
}

// === Progress Bar ===
export function ProgressBar({ value = 0, max = 100, classes = '', gradient = true }) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const bgClass = gradient ? 'bg-gradient-to-l from-brand to-cta' : 'bg-brand';
  return `
    <div class="h-2 rounded-full bg-white/10 overflow-hidden ${classes}">
      <div class="h-full rounded-full ${bgClass} transition-all duration-500" style="width: ${percent}%"></div>
    </div>
  `;
}

// === Stat Card ===
export function StatCard({ icon: iconName, iconColor = 'success', label, value, sublabel, trend, trendValue, classes = '' }) {
  const colorMap = {
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
    brand: 'bg-brand/15 text-brand',
    cta: 'bg-cta/15 text-cta',
    info: 'bg-info-soft text-purple-300',
    warning: 'bg-warning-soft text-warning'
  };

  return `
    <div class="glass-strong rounded-2xl p-5 ${classes}">
      <div class="flex items-center justify-between mb-3">
        <div class="w-10 h-10 rounded-xl ${colorMap[iconColor]} flex items-center justify-center">
          <i data-lucide="${iconName}" class="w-5 h-5"></i>
        </div>
        ${trend ? `<span class="px-2 py-0.5 rounded-md ${colorMap[iconColor]} text-[10px] flex items-center gap-1">
          <i data-lucide="${trend === 'up' ? 'trending-up' : 'trending-down'}" class="w-3 h-3"></i> ${trendValue || ''}
        </span>` : ''}
      </div>
      <p class="text-xs text-fg-muted mb-1">${label}</p>
      <p class="text-2xl font-bold tabular-nums mb-2">${value}</p>
      ${sublabel ? `<p class="text-[10px] text-fg-subtle">${sublabel}</p>` : ''}
    </div>
  `;
}

// === Section Header ===
export function SectionHeader({ title, action, actionOnClick, classes = '' }) {
  return `
    <div class="flex items-center justify-between mb-2.5 ${classes}">
      <p class="text-sm font-bold">${title}</p>
      ${action ? `<button onclick="${actionOnClick || ''}" class="text-[11px] text-brand hover:underline">${action}</button>` : ''}
    </div>
  `;
}
