// src/ui/screens/activity.js
// صفحه فعالیت روزانه — فاز 7 PRD

import { repo } from '../../core/repository.js';
import { state } from '../../core/state.js';
import { navigate } from '../../core/router.js';
import { showToast } from '../components/toast.js';
import { openSheet, closeSheet, confirmDialog } from '../components/sheet.js';
import { openDatePicker } from '../components/datepicker.js';
import { Avatar, Input, Select, Textarea, EmptyState } from '../components/ui.js';
import { formatJalali, toPersianDigits, today } from '../../utils/date.js';
import { validate } from '../../domain/validators.js';

const COLOR_HEX = {
  brand: '#0080ff', cta: '#ff7f00', purple: '#8b5cf6', cyan: '#22d3ee',
  pink: '#ec4899', success: '#36b37e', warning: '#ffab00', info: '#6554c0'
};

let selectedDate = today();
let activityFormState = null;

function defaultActivityFormState() {
  return { date: today(), projectId: '', selectedPartners: [], times: {}, note: '' };
}

function shiftDate(iso, deltaDays) {
  const d = new Date(iso);
  d.setDate(d.getDate() + deltaDays);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const parts = startTime.split(':');
  const startH = parseInt(parts[0]); const startM = parseInt(parts[1]);
  const parts2 = endTime.split(':');
  const endH = parseInt(parts2[0]); const endM = parseInt(parts2[1]);
  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 0;
  let minutes = (endH * 60 + endM) - (startH * 60 + startM);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
}

function formatDuration(minutes) {
  if (minutes <= 0) return toPersianDigits(0) + ' دقیقه';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return toPersianDigits(mins) + ' دقیقه';
  if (mins === 0) return toPersianDigits(hours) + ' ساعت';
  return toPersianDigits(hours) + ' ساعت ' + toPersianDigits(mins) + ' دقیقه';
}

export function renderActivityPage() {
  const main = document.getElementById('page-content');
  const date = selectedDate;

  const allActivities = (state.data.dailyActivities || []).filter(a => !a.deletedAt);
  const sDate = new Date(date);
  const dayActivities = allActivities.filter(a => {
    const aDate = new Date(a.date);
    return aDate.getFullYear() === sDate.getFullYear() && aDate.getMonth() === sDate.getMonth() && aDate.getDate() === sDate.getDate();
  });

  const byProject = new Map();
  for (const act of dayActivities) {
    if (!byProject.has(act.projectId)) byProject.set(act.projectId, []);
    byProject.get(act.projectId).push(act);
  }

  main.innerHTML = `
    <div class="px-4 pt-4 pb-32">
      ${renderDateHeader(date)}
      <div id="activity-content" class="mt-4 space-y-3">
        ${dayActivities.length === 0 ? renderEmpty() : renderActivityGroups(byProject)}
      </div>
    </div>
    ${renderFab()}
  `;

  if (window.lucide) window.lucide.createIcons();
  window.__navigate = (path) => navigate(path);
  window.__activityPrev = () => { selectedDate = shiftDate(selectedDate, -1); renderActivityPage(); };
  window.__activityNext = () => { selectedDate = shiftDate(selectedDate, 1); renderActivityPage(); };
  window.__activityToday = () => { selectedDate = today(); renderActivityPage(); };
  window.__activityPickDate = () => openDatePicker({ value: selectedDate, onSelect: (iso) => { selectedDate = iso; renderActivityPage(); } });
  window.__deleteActivity = deleteActivity;
}

function renderDateHeader(date) {
  return `
    <div class="glass-strong rounded-2xl p-3">
      <div class="flex items-center justify-between gap-2">
        <button onclick="window.__activityPrev()" class="w-10 h-10 rounded-xl glass flex items-center justify-center" aria-label="روز قبل">
          <i data-lucide="chevron-right" class="w-5 h-5"></i>
        </button>
        <button onclick="window.__activityPickDate()" class="flex-1 flex flex-col items-center justify-center py-1">
          <p class="text-sm font-bold">${formatJalali(date)}</p>
          <p class="text-[10px] text-fg-muted mt-0.5 flex items-center gap-1">
            <i data-lucide="calendar" class="w-3 h-3"></i> تغییر تاریخ
          </p>
        </button>
        <button onclick="window.__activityNext()" class="w-10 h-10 rounded-xl glass flex items-center justify-center" aria-label="روز بعد">
          <i data-lucide="chevron-left" class="w-5 h-5"></i>
        </button>
      </div>
      <button onclick="window.__activityToday()" class="mt-2 w-full h-9 rounded-xl bg-brand/15 text-brand text-xs font-medium hover:bg-brand/20 transition">امروز</button>
    </div>
  `;
}

function renderEmpty() {
  return EmptyState({ icon: 'calendar', title: 'فعالیتی برای این روز ثبت نشده', description: 'برای ثبت فعالیت جدید از دکمه پایین صفحه استفاده کنید.', actionLabel: 'افزودن فعالیت', actionOnClick: "window.__navigate('/activity/add')" });
}

function renderActivityGroups(byProject) {
  let html = '';
  for (const [projectId, acts] of byProject) {
    const project = (state.data.projects || []).find(p => p.id === projectId);
    if (!project) continue;
    const colorHex = COLOR_HEX[project.color] || COLOR_HEX.brand;
    let totalMinutes = 0;

    const partnersHtml = acts.map(act => {
      const partner = (state.data.partners || []).find(p => p.id === act.partnerId);
      if (!partner) return '';
      const dur = calculateDuration(act.startTime, act.endTime);
      totalMinutes += dur;
      return `
        <div class="flex items-center gap-3 py-2.5">
          ${Avatar({ text: (partner.name || '').charAt(0), color: partner.avatarColor || 'brand', size: 'sm' })}
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold truncate">${partner.name}</p>
            <p class="text-[10px] text-fg-muted mt-0.5 tabular-nums">${toPersianDigits(act.startTime)} - ${toPersianDigits(act.endTime)}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-fg-muted glass px-2 py-0.5 rounded-md">${formatDuration(dur)}</span>
            <button onclick="window.__deleteActivity('${act.id}')" class="w-7 h-7 rounded-lg glass text-fg-muted hover:text-danger flex items-center justify-center transition" aria-label="حذف">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    html += `
      <div class="glass rounded-2xl p-4">
        <div class="flex items-center gap-2.5 mb-1 pb-2.5 border-b border-line">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: ${colorHex}20;">
            <i data-lucide="briefcase" class="w-4 h-4" style="color: ${colorHex};"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold truncate">${project.title}</p>
            <p class="text-[10px] text-fg-muted">${toPersianDigits(acts.length)} شریک</p>
          </div>
          <div class="text-left">
            <p class="text-[9px] text-fg-muted">جمع</p>
            <p class="text-xs font-bold text-brand">${formatDuration(totalMinutes)}</p>
          </div>
        </div>
        <div class="divide-y divide-line/40">${partnersHtml}</div>
      </div>
    `;
  }
  return html;
}

function renderFab() {
  return `
    <div class="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 pointer-events-none z-30">
      <div class="flex justify-end">
        <button onclick="window.__navigate('/activity/add')" class="pointer-events-auto w-14 h-14 rounded-2xl bg-cta hover:bg-cta-dark text-white shadow-xl shadow-cta/40 flex items-center justify-center transition active:scale-95" aria-label="افزودن فعالیت">
          <i data-lucide="plus" class="w-6 h-6"></i>
        </button>
      </div>
    </div>
  `;
}

function deleteActivity(id) {
  const activity = (state.data.dailyActivities || []).find(a => a.id === id);
  if (!activity) return;
  const partner = (state.data.partners || []).find(p => p.id === activity.partnerId);
  confirmDialog({
    title: 'حذف فعالیت',
    message: `آیا از حذف فعالیت ${partner ? partner.name : ''} مطمئن هستید؟ این عمل قابل بازگشت نیست.`,
    confirmText: 'حذف', danger: true,
    onConfirm: async () => {
      try {
        await repo.dailyActivities.delete(id);
        state.removeEntity('dailyActivities', id);
        showToast('فعالیت حذف شد', 'success');
        renderActivityPage();
      } catch (e) {
        console.error('Delete activity failed:', e);
        showToast('خطا در حذف فعالیت', 'error');
      }
    }
  });
}

// =========== ADD ACTIVITY PAGE ===========
export function renderAddActivityPage() {
  if (!activityFormState) activityFormState = defaultActivityFormState();
  const main = document.getElementById('page-content');
  main.innerHTML = `
    <div class="px-4 pt-4 pb-32">
      <div class="flex items-center gap-3 mb-4">
        <button onclick="window.__navigate('/activity')" class="w-9 h-9 rounded-lg glass flex items-center justify-center">
          <i data-lucide="chevron-right" class="w-5 h-5"></i>
        </button>
        <h2 class="text-base font-bold">ثبت فعالیت روزانه</h2>
      </div>
      <div id="activity-form-content">${renderActivityForm()}</div>
      <div class="flex gap-2 mt-6">
        <button onclick="window.__navigate('/activity')" class="flex-1 h-11 rounded-xl glass text-sm font-medium hover:bg-white/10 transition">انصراف</button>
        <button onclick="window.__saveActivity()" class="flex-1 h-11 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-cta/30">
          <i data-lucide="check" class="w-4 h-4"></i> ثبت فعالیت
        </button>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  window.__navigate = (path) => navigate(path);
  window.__saveActivity = saveActivity;
  window.__openActivityDate = openActivityDate;
  window.__togglePartner = togglePartner;
}

function renderActivityForm() {
  const projects = (state.data.projects || []).filter(p => !p.deletedAt && p.status === 'active');
  const partners = (state.data.partners || []).filter(p => !p.deletedAt);
  const projectOptions = projects.map(p => ({ value: p.id, label: p.title }));

  const projectWarning = projects.length === 0 ? `
    <div class="rounded-xl bg-warning-soft p-3 text-xs text-warning flex items-center gap-2">
      <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i>
      <span class="flex-1">ابتدا یک پروژه فعال ثبت کنید.</span>
      <button onclick="window.__navigate('/projects')" class="text-brand font-medium underline shrink-0">رفتن</button>
    </div>
  ` : '';

  const partnerWarning = partners.length === 0 ? `
    <div class="rounded-xl bg-warning-soft p-3 text-xs text-warning flex items-center gap-2">
      <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i>
      <span class="flex-1">ابتدا یک شریک ثبت کنید.</span>
      <button onclick="window.__navigate('/partners')" class="text-brand font-medium underline shrink-0">رفتن</button>
    </div>
  ` : '';

  return `
    <div class="space-y-3">
      <div>
        <label class="text-xs text-fg-muted mb-1.5 block">تاریخ <span class="text-danger">*</span></label>
        <button onclick="window.__openActivityDate()" class="w-full h-11 px-4 rounded-xl bg-ink-soft border border-line focus:border-brand outline-none text-sm transition flex items-center justify-between">
          <span>${formatJalali(activityFormState.date)}</span>
          <i data-lucide="calendar" class="w-4 h-4 text-fg-muted"></i>
        </button>
      </div>
      ${projectWarning}
      ${Select({ name: 'projectId', label: 'پروژه', options: projectOptions, value: activityFormState.projectId, required: true, placeholder: 'انتخاب پروژه', icon: 'briefcase' })}
      ${partnerWarning}
      ${partners.length > 0 ? `
        <div>
          <label class="text-xs text-fg-muted mb-1.5 block">شرکای حاضر <span class="text-danger">*</span></label>
          <div class="space-y-2">
            ${partners.map(p => {
              const isSelected = activityFormState.selectedPartners.includes(p.id);
              const times = activityFormState.times[p.id] || { start: '09:00', end: '17:00' };
              return `
                <div class="glass rounded-xl p-3">
                  <label class="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="window.__togglePartner('${p.id}')" class="w-4 h-4 rounded accent-brand">
                    ${Avatar({ text: (p.name || '').charAt(0), color: p.avatarColor || 'brand', size: 'sm' })}
                    <span class="text-sm font-medium flex-1">${p.name}</span>
                  </label>
                  ${isSelected ? `
                    <div class="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-line">
                      <div>
                        <label class="text-[10px] text-fg-muted block mb-1">شروع</label>
                        <input type="time" data-partner-id="${p.id}" data-time-type="start" value="${times.start}" class="w-full h-10 px-3 rounded-lg bg-ink-soft border border-line focus:border-brand outline-none text-sm tabular-nums" />
                      </div>
                      <div>
                        <label class="text-[10px] text-fg-muted block mb-1">پایان</label>
                        <input type="time" data-partner-id="${p.id}" data-time-type="end" value="${times.end}" class="w-full h-10 px-3 rounded-lg bg-ink-soft border border-line focus:border-brand outline-none text-sm tabular-nums" />
                      </div>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
      ${Textarea({ name: 'note', label: 'توضیحات (اختیاری)', placeholder: 'یادداشت اختیاری...', value: activityFormState.note, rows: 2 })}
    </div>
  `;
}

function syncTimeInputsToState() {
  const container = document.getElementById('activity-form-content');
  if (!container) return;
  const timeInputs = container.querySelectorAll('input[type="time"]');
  for (const input of timeInputs) {
    const pid = input.dataset.partnerId;
    const type = input.dataset.timeType;
    if (!pid || !type) continue;
    if (!activityFormState.times[pid]) activityFormState.times[pid] = { start: '09:00', end: '17:00' };
    activityFormState.times[pid][type] = input.value;
  }
}

function togglePartner(partnerId) {
  syncTimeInputsToState();
  const idx = activityFormState.selectedPartners.indexOf(partnerId);
  if (idx >= 0) {
    activityFormState.selectedPartners.splice(idx, 1);
    delete activityFormState.times[partnerId];
  } else {
    activityFormState.selectedPartners.push(partnerId);
    activityFormState.times[partnerId] = { start: '09:00', end: '17:00' };
  }
  const container = document.getElementById('activity-form-content');
  if (container) {
    container.innerHTML = renderActivityForm();
    if (window.lucide) window.lucide.createIcons();
  }
}

function openActivityDate() {
  openDatePicker({
    value: activityFormState.date,
    onSelect: (iso) => {
      activityFormState.date = iso;
      const container = document.getElementById('activity-form-content');
      if (container) {
        container.innerHTML = renderActivityForm();
        if (window.lucide) window.lucide.createIcons();
      }
    }
  });
}

async function saveActivity() {
  syncTimeInputsToState();
  const projectSelect = document.querySelector('select[name="projectId"]');
  if (projectSelect) activityFormState.projectId = projectSelect.value;
  const noteInput = document.querySelector('textarea[name="note"]');
  if (noteInput) activityFormState.note = noteInput.value.trim();

  if (!activityFormState.projectId) { showToast('پروژه را انتخاب کنید', 'error'); return; }
  if (activityFormState.selectedPartners.length === 0) { showToast('حداقل یک شریک انتخاب کنید', 'error'); return; }

  for (const pid of activityFormState.selectedPartners) {
    const times = activityFormState.times[pid] || { start: '', end: '' };
    if (!times.start || !times.end) {
      const partner = (state.data.partners || []).find(p => p.id === pid);
      showToast(`ساعت شروع و پایان برای ${partner ? partner.name : 'شریک'} الزامی است`, 'error');
      return;
    }
    const duration = calculateDuration(times.start, times.end);
    if (duration <= 0) {
      const partner = (state.data.partners || []).find(p => p.id === pid);
      showToast(`ساعت پایان باید بعد از ساعت شروع باشد (${partner ? partner.name : ''})`, 'error');
      return;
    }
  }

  try {
    const records = activityFormState.selectedPartners.map(pid => {
      const times = activityFormState.times[pid];
      return {
        date: activityFormState.date,
        projectId: activityFormState.projectId,
        partnerId: pid,
        startTime: times.start,
        endTime: times.end,
        note: activityFormState.note || undefined
      };
    });

    for (const data of records) {
      const created = await repo.dailyActivities.create(data);
      state.updateEntity('dailyActivities', created);
    }
    selectedDate = activityFormState.date;
    showToast(`${toPersianDigits(records.length)} فعالیت ثبت شد`, 'success');
    activityFormState = null;
    navigate('/activity');
  } catch (e) {
    console.error('Save activity failed:', e);
    showToast('خطا در ثبت فعالیت', 'error');
  }
}
