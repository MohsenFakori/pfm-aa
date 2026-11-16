// src/utils/number.js
// فرمت‌بندی اعداد و مبالغ

import { toPersianDigits } from './date.js';

// جداکننده هزارگان + اعداد فارسی
export function formatNumber(num) {
  if (num == null || isNaN(num)) return toPersianDigits('0');
  const n = Math.abs(Number(num));
  return toPersianDigits(n.toLocaleString('en-US'));
}

// فرمت مبلغ تومان
export function formatToman(num) {
  if (num == null || isNaN(num)) return toPersianDigits('۰');
  const n = Number(num);
  const sign = n < 0 ? '-' : '';
  return sign + formatNumber(Math.abs(n)) + ' تومان';
}

// فرمت مبلغ کوتاه (م: میلیون، هزار: k)
export function formatTomanShort(num) {
  if (num == null || isNaN(num)) return toPersianDigits('۰');
  const n = Number(num);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (abs >= 1000000) {
    const m = (abs / 1000000).toFixed(1).replace(/\.0$/, '');
    return sign + toPersianDigits(m) + 'م';
  }
  if (abs >= 1000) {
    const k = Math.floor(abs / 1000);
    return sign + toPersianDigits(k) + 'هزار';
  }
  return sign + toPersianDigits(abs);
}

// تبدیل رشته فارسی عدد به عدد لاتین
export function parseAmount(str) {
  if (!str) return 0;
  const persianToLatin = String(str)
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[^\d.-]/g, '');
  const n = parseFloat(persianToLatin);
  return isNaN(n) ? 0 : n;
}

// تبدیل عدد صحیح از ورودی
export function parseIntAmount(str) {
  const n = parseAmount(str);
  return Math.round(n);
}

// درصد با اعداد فارسی
export function formatPercent(num, digits = 0) {
  if (num == null || isNaN(num)) return toPersianDigits('۰٪');
  return toPersianDigits(Number(num).toFixed(digits)) + '٪';
}
