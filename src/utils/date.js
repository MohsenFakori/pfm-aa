// src/utils/date.js
// تبدیل تاریخ شمسی-میلادی و فرمت‌بندی — فاز 4 PRD
// استفاده از jalaali-js

import jalaali from 'jalaali-js';

const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const PERSIAN_WEEKDAYS = [
  'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'
];

// تبدیل اعداد لاتین به فارسی
function toPersianDigits(input) {
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(input).replace(/\d/g, d => persian[d]);
}

// تبدیل ISO به { year, month, day } شمسی
export function toJalali(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  return jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

// تبدیل شمسی به ISO (Gregorian)
export function toGregorian(jalali) {
  const g = jalaali.toGregorian(jalali.year, jalali.month, jalali.day);
  return new Date(g.gy, g.gm - 1, g.gd).toISOString();
}

// فرمت کامل: "۱۴ مهر ۱۴۰۴"
export function formatJalali(isoDate) {
  if (!isoDate) return '';
  const j = toJalali(isoDate);
  if (!j) return '';
  return `${toPersianDigits(j.jd)} ${PERSIAN_MONTHS[j.jm - 1]} ${toPersianDigits(j.jy)}`;
}

// فرمت کوتاه: "۱۴۰۴/۰۷/۱۴"
export function formatJalaliShort(isoDate) {
  if (!isoDate) return '';
  const j = toJalali(isoDate);
  if (!j) return '';
  const m = String(j.jm).padStart(2, '0');
  const d = String(j.jd).padStart(2, '0');
  return toPersianDigits(`${j.jy}/${m}/${d}`);
}

// فرمت با زمان: "۱۴ مهر ۱۴۰۴ - ۱۴:۳۲"
export function formatJalaliWithTime(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${formatJalali(isoDate)} - ${toPersianDigits(`${h}:${m}`)}`;
}

// فقط زمان: "۱۴:۳۲"
export function formatTime(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return toPersianDigits(`${h}:${m}`);
}

// نام روز هفته
export function getWeekday(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return PERSIAN_WEEKDAYS[d.getDay()];
}

// نام ماه شمسی
export function getMonthName(monthNumber) {
  return PERSIAN_MONTHS[monthNumber - 1] || '';
}

// دریافت تاریخ امروز به‌صورت ISO (شروع روز)
export function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

// بررسی اینکه دو تاریخ در یک روز هستند
export function isSameDay(iso1, iso2) {
  if (!iso1 || !iso2) return false;
  const d1 = new Date(iso1);
  const d2 = new Date(iso2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

// بررسی اینکه تاریخ در همین ماه شمسی است
export function isThisMonth(isoDate) {
  if (!isoDate) return false;
  const j = toJalali(isoDate);
  const todayJ = toJalali(new Date().toISOString());
  return j && todayJ && j.jy === todayJ.jy && j.jm === todayJ.jm;
}

// دریافت تعداد روزها در ماه شمسی
export function daysInJalaliMonth(year, month) {
  return jalaali.jalaaliMonthLength(year, month);
}

// تولید تقویم یک ماه شمسی
export function getJalaliMonthGrid(year, month) {
  // پیدا کردن روز هفته اول ماه
  const firstGreg = jalaali.toGregorian(year, month, 1);
  const firstDate = new Date(firstGreg.gy, firstGreg.gm - 1, firstGreg.gd);
  // روز هفته: 0=یکشنبه، 6=شنبه
  // در تقویم شمسی: شنبه=0، ... جمعه=6
  let weekday = firstDate.getDay();
  weekday = (weekday + 1) % 7; // تبدیل: شنبه=0

  const daysInMonth = daysInJalaliMonth(year, month);
  const grid = [];

  // سلولهای خالی قبل از اولین روز
  for (let i = 0; i < weekday; i++) {
    grid.push(null);
  }

  // روزهای ماه
  for (let day = 1; day <= daysInMonth; day++) {
    grid.push({ year, month, day });
  }

  // تکمیل تا 42 سلول (6 هفته)
  while (grid.length < 42) {
    grid.push(null);
  }

  return grid;
}

// ماه و سال فعلی شمسی
export function getCurrentJalaliMonth() {
  const j = toJalali(new Date().toISOString());
  return { year: j.jy, month: j.jm };
}

// تبدیل اعداد فارسی به لاتین (برای ورودی کاربر)
export function persianToLatinDigits(input) {
  if (!input) return '';
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let result = String(input);
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persian[i], 'g'), i);
    result = result.replace(new RegExp(arabic[i], 'g'), i);
  }
  return result;
}

export { toPersianDigits, PERSIAN_MONTHS, PERSIAN_WEEKDAYS };
