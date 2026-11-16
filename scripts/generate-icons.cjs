const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

const BG_TOP = '#0080ff';
const BG_BOTTOM = '#0066cc';
const CTA = '#ff7f00';

function svgAny(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${BG_TOP}"/><stop offset="1" stop-color="${BG_BOTTOM}"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <g transform="translate(128,128)">
    <rect x="16" y="96" width="224" height="160" rx="24" fill="white"/>
    <rect x="16" y="56" width="224" height="56" rx="24" fill="white" opacity="0.9"/>
    <circle cx="200" cy="176" r="20" fill="${BG_TOP}"/>
  </g>
</svg>`;
}

function svgMaskable(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${BG_TOP}"/><stop offset="1" stop-color="${BG_BOTTOM}"/>
  </linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(156,156) scale(0.78)">
    <rect x="16" y="96" width="224" height="160" rx="24" fill="white"/>
    <rect x="16" y="56" width="224" height="56" rx="24" fill="white" opacity="0.9"/>
    <circle cx="200" cy="176" r="20" fill="${BG_TOP}"/>
  </g>
</svg>`;
}

function svgApple(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${BG_TOP}"/><stop offset="1" stop-color="${BG_BOTTOM}"/>
  </linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(128,128)">
    <rect x="16" y="96" width="224" height="160" rx="24" fill="white"/>
    <rect x="16" y="56" width="224" height="56" rx="24" fill="white" opacity="0.9"/>
    <circle cx="200" cy="176" r="20" fill="${BG_TOP}"/>
  </g>
</svg>`;
}

function svgShortcutTx(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${size}" height="${size}">
  <rect width="96" height="96" rx="20" fill="${CTA}"/>
  <path d="M48 24 L48 72 M24 48 L72 48" stroke="white" stroke-width="8" stroke-linecap="round"/>
</svg>`;
}

function svgShortcutExp(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${size}" height="${size}">
  <rect width="96" height="96" rx="20" fill="#ef4444"/>
  <path d="M36 60 L60 36 M60 36 L60 52 M60 36 L44 36" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;
}

async function generate() {
  for (const s of [192, 512]) {
    await sharp(Buffer.from(svgAny(s))).png().toFile(path.join(ICONS_DIR, `icon-${s}.png`));
    await sharp(Buffer.from(svgMaskable(s))).png().toFile(path.join(ICONS_DIR, `icon-maskable-${s}.png`));
  }
  await sharp(Buffer.from(svgApple(180))).png().toFile(path.join(ICONS_DIR, 'apple-touch-icon-180.png'));
  await sharp(Buffer.from(svgShortcutTx(96))).png().toFile(path.join(ICONS_DIR, 'shortcut-transaction-96.png'));
  await sharp(Buffer.from(svgShortcutExp(96))).png().toFile(path.join(ICONS_DIR, 'shortcut-expense-96.png'));
  await sharp(Buffer.from(svgAny(32))).png().toFile(path.join(ICONS_DIR, 'favicon-32.png'));
  fs.writeFileSync(path.join(ICONS_DIR, 'icon.svg'), svgAny(512));
  console.log('Icons generated!');
  fs.readdirSync(ICONS_DIR).forEach(f => {
    const s = fs.statSync(path.join(ICONS_DIR, f));
    console.log(`  ${f}: ${Math.round(s.size/1024)}KB`);
  });
}

generate().catch(console.error);
