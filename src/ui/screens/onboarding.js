// src/ui/screens/onboarding.js
// Onboarding و پولیش نهایی — فاز 13 PRD

import { state } from '../../core/state.js';
import { navigate } from '../../core/router.js';
import { showToast } from '../components/toast.js';
import { renderShell } from '../components/shell.js';
import { toPersianDigits } from '../../utils/date.js';

let currentStep = 1;
let userName = '';

export function renderOnboardingPage() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="min-h-screen flex flex-col bg-ink page-enter">
      ${renderProgressBar(currentStep)}
      <div class="flex-1 flex flex-col px-6 py-8">
        <div class="flex-1 flex flex-col items-center justify-center">
          ${renderStep(currentStep)}
        </div>
        ${renderFooter()}
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  window.__onboardingNext = onboardingNext;
  window.__onboardingPrev = onboardingPrev;
  window.__onboardingStart = onboardingStart;
  window.__onboardingInput = (e) => { userName = e.target.value; };

  if (currentStep === 3) {
    setTimeout(() => {
      const input = document.querySelector('input[type="text"]');
      if (input) input.focus();
    }, 100);
  }
}

function renderProgressBar(step) {
  return `
    <div class="pt-6 px-6">
      <div class="flex items-center justify-center gap-2">
        ${[1, 2, 3].map(s => `
          <div class="h-1.5 rounded-full transition-all duration-300 ${s === step ? 'w-8 bg-brand' : s < step ? 'w-4 bg-success' : 'w-4 bg-white/15'}"></div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderStep(step) {
  if (step === 1) return renderWelcomeStep();
  if (step === 2) return renderConceptsStep();
  if (step === 3) return renderSetupStep();
  return '';
}

function renderWelcomeStep() {
  return `
    <div class="flex flex-col items-center text-center max-w-[320px]">
      <div class="w-28 h-28 rounded-3xl bg-gradient-to-br from-brand to-cta flex items-center justify-center mb-8 shadow-2xl shadow-brand/40">
        <i data-lucide="wallet" class="w-14 h-14 text-white"></i>
      </div>
      <h1 class="text-2xl font-bold mb-3">به اپلیکیشن مدیریت مالی پروژه‌های شخصی خوش آمدید</h1>
      <p class="text-sm text-fg-muted leading-relaxed mb-10">در کمتر از ۲ دقیقه، اپ را آماده استفاده کن. بدون نیاز به ثبت‌نام، همه چیز روی دستگاه خودت ذخیره می‌شود.</p>
      <button onclick="window.__onboardingNext()" class="h-12 px-8 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium shadow-lg shadow-cta/30 transition flex items-center gap-2 active:scale-95">
        شروع <i data-lucide="chevron-left" class="w-4 h-4"></i>
      </button>
    </div>
  `;
}

function renderConceptsStep() {
  const concepts = [
    { icon: 'briefcase',    title: 'کارفرماها را ثبت کن',          desc: 'اشخاص یا شرکت‌هایی که برایشان پروژه انجام می‌دهی' },
    { icon: 'users',        title: 'شرکای خود را اضافه کن',         desc: 'همکارانی که سهم هر پروژه را با تو شریک می‌شوند' },
    { icon: 'folder-plus',  title: 'پروژه‌ها را با سهم تعریف کن',  desc: 'با مبلغ، مهلت و درصد سهم هر شریک' },
    { icon: 'wallet',       title: 'دریافتی‌ها و هزینه‌ها',         desc: 'هر پرداخت و دریافت را ثبت کن تا ترازها به‌روز شوند' }
  ];
  return `
    <div class="w-full max-w-[360px]">
      <h2 class="text-xl font-bold mb-2 text-center">۴ قدم تا سازماندهی</h2>
      <p class="text-sm text-fg-muted text-center mb-8">با این ۴ مفهوم ساده، اپ آماده استفاده است</p>
      <div class="space-y-3">
        ${concepts.map((c, idx) => `
          <div class="glass rounded-2xl p-4 flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-brand/20 to-cta/20 flex items-center justify-center shrink-0">
              <i data-lucide="${c.icon}" class="w-6 h-6 text-brand"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <span class="w-5 h-5 rounded-full bg-brand/15 text-brand text-[10px] font-bold flex items-center justify-center shrink-0">${toPersianDigits(idx + 1)}</span>
                <p class="text-sm font-bold">${c.title}</p>
              </div>
              <p class="text-xs text-fg-muted leading-relaxed">${c.desc}</p>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="mt-8 flex justify-center">
        <button onclick="window.__onboardingNext()" class="h-12 px-8 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium shadow-lg shadow-cta/30 transition flex items-center gap-2 active:scale-95">
          بعدی <i data-lucide="chevron-left" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;
}

function renderSetupStep() {
  return `
    <div class="flex flex-col items-center text-center max-w-[320px] w-full">
      <div class="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center mb-6 shadow-xl shadow-brand/30">
        <i data-lucide="user-plus" class="w-10 h-10 text-white"></i>
      </div>
      <h2 class="text-xl font-bold mb-2">آماده‌سازی</h2>
      <p class="text-sm text-fg-muted mb-8">برای شخصی‌سازی تجربه‌ات، نامت را وارد کن</p>
      <div class="w-full text-right mb-8">
        <label class="text-xs text-fg-muted mb-2 block">نامت را وارد کن</label>
        <input type="text" value="${userName}" oninput="window.__onboardingInput(event)" placeholder="مثلاً: علی"
          class="w-full h-12 px-4 rounded-xl bg-ink-soft border border-line focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-sm transition text-center" />
      </div>
      <button onclick="window.__onboardingStart()" class="h-12 px-8 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium shadow-lg shadow-cta/30 transition flex items-center gap-2 active:scale-95">
        <i data-lucide="check" class="w-4 h-4"></i> شروع استفاده
      </button>
    </div>
  `;
}

function renderFooter() {
  if (currentStep <= 1) return '<div class="h-8"></div>';
  return `
    <div class="flex justify-center pt-6">
      <button onclick="window.__onboardingPrev()" class="text-xs text-fg-muted hover:text-fg transition flex items-center gap-1">
        <i data-lucide="chevron-right" class="w-3 h-3"></i> قبلی
      </button>
    </div>
  `;
}

function onboardingNext() {
  console.log('onboardingNext called, currentStep before:', currentStep);
  if (currentStep < 3) {
    currentStep++;
    console.log('currentStep after increment:', currentStep);
    renderOnboardingPage();
  }
}

function onboardingPrev() {
  if (currentStep > 1) { currentStep--; renderOnboardingPage(); }
}

function onboardingStart() {
  const name = (userName || '').trim();
  if (!name) { showToast('نامت را وارد کن', 'error'); return; }
  state.updateSettings({ userName: name, onboardingCompleted: true });
  currentStep = 1;
  userName = '';
  if (typeof renderShell === 'function') renderShell();
  showToast('خوش آمدی ' + name + '!', 'success');
  navigate('/dashboard');
}
