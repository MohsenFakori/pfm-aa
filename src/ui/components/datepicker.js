// src/ui/components/datepicker.js
// Date Picker شمسی (Jalali) — فاز 4 PRD
// تقویم شمسی به‌صورت bottom sheet با ناوبری ماه قبل/بعد

import {
  getJalaliMonthGrid,
  getCurrentJalaliMonth,
  toJalali,
  toGregorian,
  getMonthName,
  toPersianDigits,
  today
} from '../../utils/date.js';

const WEEKDAY_HEADERS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

let pickerCounter = 0;

export function openDatePicker({ value, onSelect, onClose } = {}) {
  let viewYear, viewMonth;

  if (value) {
    const j = toJalali(value);
    if (j) {
      viewYear = j.jy;
      viewMonth = j.jm;
    } else {
      const cur = getCurrentJalaliMonth();
      viewYear = cur.year;
      viewMonth = cur.month;
    }
  } else {
    const cur = getCurrentJalaliMonth();
    viewYear = cur.year;
    viewMonth = cur.month;
  }

  const todayJ = toJalali(today());
  const selectedJ = value ? toJalali(value) : null;

  const pickerId = 'dp-' + (++pickerCounter);

  const backdrop = document.createElement('div');
  backdrop.className = 'overlay-backdrop';
  backdrop.style.zIndex = '110';

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet date-picker-sheet';
  sheet.style.zIndex = '111';
  sheet.innerHTML = `
    <div class="pt-3 pb-2 flex justify-center sticky top-0 bg-ink-soft z-10">
      <div class="w-10 h-1 rounded-full bg-white/20"></div>
    </div>
    <div class="px-5 pb-8 sheet-content"></div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  const hasOtherSheet = !!document.querySelector('.bottom-sheet:not(.date-picker-sheet)');
  if (!hasOtherSheet) {
    document.body.style.overflow = 'hidden';
  }

  function closePicker() {
    backdrop.remove();
    sheet.remove();
    if (!document.querySelector('.bottom-sheet')) {
      document.body.style.overflow = '';
    }
    if (onClose) onClose();
  }

  function renderContent() {
    const grid = getJalaliMonthGrid(viewYear, viewMonth);
    const monthName = getMonthName(viewMonth);

    const cellsHtml = grid.map(cell => {
      if (!cell) {
        return `<div class="h-11"></div>`;
      }
      const isToday = todayJ &&
        cell.year === todayJ.jy &&
        cell.month === todayJ.jm &&
        cell.day === todayJ.jd;
      const isSelected = selectedJ &&
        cell.year === selectedJ.jy &&
        cell.month === selectedJ.jm &&
        cell.day === selectedJ.jd;

      let classes = 'h-11 rounded-lg flex items-center justify-center text-sm transition ';
      if (isSelected) {
        classes += 'bg-brand text-white font-bold shadow-lg shadow-brand/30';
      } else if (isToday) {
        classes += 'bg-brand/15 text-brand font-medium border border-brand/40';
      } else {
        classes += 'text-fg hover:bg-white/10';
      }

      return `
        <button type="button"
          data-year="${cell.year}" data-month="${cell.month}" data-day="${cell.day}"
          class="dp-day-cell ${classes}">
          ${toPersianDigits(cell.day)}
        </button>
      `;
    }).join('');

    return `
      <div class="pb-2">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-bold">انتخاب تاریخ</h3>
          <button data-action="close" class="w-8 h-8 rounded-lg glass flex items-center justify-center">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="flex items-center justify-between mb-3">
          <button data-action="prev" class="w-10 h-10 rounded-xl glass flex items-center justify-center">
            <i data-lucide="chevron-right" class="w-5 h-5"></i>
          </button>
          <p class="text-sm font-bold">${monthName} ${toPersianDigits(viewYear)}</p>
          <button data-action="next" class="w-10 h-10 rounded-xl glass flex items-center justify-center">
            <i data-lucide="chevron-left" class="w-5 h-5"></i>
          </button>
        </div>

        <div class="grid grid-cols-7 gap-1 mb-1">
          ${WEEKDAY_HEADERS.map(h =>
            `<div class="h-8 flex items-center justify-center text-[10px] text-fg-muted font-medium">${h}</div>`
          ).join('')}
        </div>

        <div class="grid grid-cols-7 gap-1" id="${pickerId}-grid">
          ${cellsHtml}
        </div>

        <div class="flex gap-2 mt-4">
          <button data-action="today" class="flex-1 h-11 rounded-xl glass-strong text-sm font-medium hover:bg-white/10 transition">
            امروز
          </button>
          <button data-action="cancel" class="flex-1 h-11 rounded-xl glass text-sm font-medium hover:bg-white/10 transition">
            انصراف
          </button>
        </div>
      </div>
    `;
  }

  function refresh() {
    const contentEl = sheet.querySelector('.sheet-content');
    if (contentEl) {
      contentEl.innerHTML = renderContent();
      if (window.lucide) window.lucide.createIcons();
      attachListeners();
    }
  }

  function attachListeners() {
    const closeBtn = sheet.querySelector('[data-action="close"]');
    if (closeBtn) closeBtn.onclick = closePicker;

    const cancelBtn = sheet.querySelector('[data-action="cancel"]');
    if (cancelBtn) cancelBtn.onclick = closePicker;

    const prevBtn = sheet.querySelector('[data-action="prev"]');
    if (prevBtn) prevBtn.onclick = () => {
      if (viewMonth === 1) { viewYear--; viewMonth = 12; }
      else viewMonth--;
      refresh();
    };

    const nextBtn = sheet.querySelector('[data-action="next"]');
    if (nextBtn) nextBtn.onclick = () => {
      if (viewMonth === 12) { viewYear++; viewMonth = 1; }
      else viewMonth++;
      refresh();
    };

    const todayBtn = sheet.querySelector('[data-action="today"]');
    if (todayBtn) todayBtn.onclick = () => {
      const iso = today();
      if (onSelect) onSelect(iso);
      closePicker();
    };

    const dayCells = sheet.querySelectorAll('.dp-day-cell');
    dayCells.forEach(cell => {
      cell.onclick = () => {
        const y = parseInt(cell.dataset.year);
        const m = parseInt(cell.dataset.month);
        const d = parseInt(cell.dataset.day);
        const iso = toGregorian({ year: y, month: m, day: d });
        if (onSelect) onSelect(iso);
        closePicker();
      };
    });
  }

  backdrop.onclick = closePicker;

  refresh();

  return { close: closePicker };
}

window.openDatePicker = openDatePicker;
