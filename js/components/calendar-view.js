// ─── Calendar View ───────────────────────────────────────────────────────────
// Visual timeline of recurring events with 12-month grid and upcoming section.

import { html } from '../core/config.js';
import { useApp } from './app.js';
import { Badge, Button, EmptyState } from '../shared/ui.js';
import { IconCalendar, IconPlus, IconClock } from '../shared/icons.js';
import { getVerificationStatus } from '../core/search.js';

const { useState, useCallback, useMemo } = React;

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const RECURRENCE_COLORS = {
  annual:    { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', dot: 'bg-blue-500' },
  quarterly: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', dot: 'bg-purple-500' },
  monthly:   { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', dot: 'bg-green-500' },
  weekly:    { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', dot: 'bg-orange-500' },
  oneTime:   { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-500' },
};

const RECURRENCE_LABELS = {
  annual: 'Annual',
  quarterly: 'Quarterly',
  monthly: 'Monthly',
  weekly: 'Weekly',
  oneTime: 'One-Time',
};

const VER_BADGE = {
  current:    { color: 'green',  label: 'Current' },
  expiring:   { color: 'yellow', label: 'Expiring' },
  stale:      { color: 'red',    label: 'Stale' },
  unverified: { color: 'gray',   label: 'Unverified' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEventMonths(entry) {
  const meta = entry.meta || {};
  if (Array.isArray(meta.months) && meta.months.length > 0) {
    return meta.months.filter(m => m >= 1 && m <= 12);
  }
  const recurrence = meta.recurrence || 'annual';
  switch (recurrence) {
    case 'monthly':   return [1,2,3,4,5,6,7,8,9,10,11,12];
    case 'quarterly': return [1,4,7,10];
    case 'weekly':    return [1,2,3,4,5,6,7,8,9,10,11,12];
    default:          return [];
  }
}

function getUpcomingEvents(calendarEntries) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const startYear = now.getFullYear();
  const upcoming = [];

  for (const entry of calendarEntries) {
    const months = getEventMonths(entry);
    const meta = entry.meta || {};
    const prepDays = meta.prepLeadDays || 0;

    for (const month of months) {
      let eventDate;
      if (month >= currentMonth) {
        eventDate = new Date(startYear, month - 1, 1);
      } else {
        eventDate = new Date(startYear + 1, month - 1, 1);
      }

      const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / 86400000);

      if (daysUntilEvent >= 0 && daysUntilEvent <= 30) {
        upcoming.push({
          entry,
          month,
          monthName: MONTH_NAMES_FULL[month - 1],
          daysUntil: daysUntilEvent,
          needsPrep: prepDays > 0 && daysUntilEvent <= prepDays,
          prepDays,
        });
      }
    }
  }

  upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  return upcoming;
}

// ─── Recurrence description ─────────────────────────────────────────────────

function describeRecurrence(entry) {
  const meta = entry.meta || {};
  const recurrence = meta.recurrence || 'annual';
  switch (recurrence) {
    case 'annual': {
      const month = parseInt(meta.month, 10);
      if (month >= 1 && month <= 12) {
        return 'Annually in ' + MONTH_NAMES_FULL[month - 1];
      }
      return 'Annual';
    }
    case 'quarterly':
      return 'Every quarter';
    case 'monthly': {
      const day = parseInt(meta.dayOfMonth, 10);
      if (day >= 1 && day <= 31) {
        return 'Monthly on day ' + day;
      }
      return 'Monthly';
    }
    case 'weekly':
      return 'Weekly';
    default:
      return RECURRENCE_LABELS[recurrence] || recurrence;
  }
}

// ─── Event Chip (in month cell) ──────────────────────────────────────────────

function EventChip({ entry, onClick }) {
  const meta = entry.meta || {};
  const recurrence = meta.recurrence || 'annual';
  const colors = RECURRENCE_COLORS[recurrence] || RECURRENCE_COLORS.annual;

  return html`
    <button
      onClick=${(e) => { e.stopPropagation(); onClick(entry); }}
      class=${'w-full text-left px-2 py-1 rounded text-xs font-medium truncate border '
        + colors.bg + ' ' + colors.text + ' ' + colors.border
        + ' hover:opacity-80 transition-opacity'}
      title=${entry.title + ' (' + (RECURRENCE_LABELS[recurrence] || recurrence) + ')'}>
      ${entry.title}
    </button>
  `;
}

// ─── Upcoming Event Row ──────────────────────────────────────────────────────

function UpcomingRow({ item, onClick }) {
  const { entry, daysUntil, needsPrep, prepDays } = item;
  const meta = entry.meta || {};
  const recurrence = meta.recurrence || 'annual';
  const colors = RECURRENCE_COLORS[recurrence] || RECURRENCE_COLORS.annual;

  return html`
    <div
      onClick=${() => onClick(entry)}
      class="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:shadow-sm hover:border-slate-300 transition-all cursor-pointer">
      <div class=${'w-2.5 h-2.5 rounded-full flex-shrink-0 ' + colors.dot}></div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h4 class="text-sm font-medium text-navy-900 truncate">${entry.title}</h4>
          <span class=${'text-xs px-1.5 py-0.5 rounded ' + colors.bg + ' ' + colors.text}>
            ${describeRecurrence(entry)}
          </span>
        </div>
        ${(entry.content || '').trim() && html`
          <p class="text-xs text-slate-500 truncate mt-0.5">${entry.content.slice(0, 100)}</p>
        `}
      </div>
      <div class="flex flex-col items-end flex-shrink-0">
        <span class="text-xs font-medium text-slate-700">
          ${daysUntil === 0 ? 'Today' : daysUntil + ' day' + (daysUntil !== 1 ? 's' : '')}
        </span>
        ${needsPrep && html`
          <span class="text-xs text-amber-600 font-medium flex items-center gap-0.5 mt-0.5">
            ${IconClock({ size: 12 })}
            Prep now (${prepDays}d lead)
          </span>
        `}
      </div>
    </div>
  `;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CalendarView() {
  const { entries, navigate } = useApp();

  const calendarEntries = useMemo(() => {
    return entries.filter(e => e.category === 'calendar');
  }, [entries]);

  const currentMonth = new Date().getMonth() + 1;

  const monthMap = useMemo(() => {
    const map = {};
    for (let m = 1; m <= 12; m++) map[m] = [];
    for (const entry of calendarEntries) {
      for (const m of getEventMonths(entry)) {
        if (map[m]) map[m].push(entry);
      }
    }
    return map;
  }, [calendarEntries]);

  const upcoming = useMemo(() => getUpcomingEvents(calendarEntries), [calendarEntries]);

  const handleEdit = useCallback((entry) => {
    navigate('capture?id=' + entry.id + '&category=calendar');
  }, [navigate]);

  const handleAdd = useCallback(() => {
    navigate('capture?category=calendar');
  }, [navigate]);

  if (calendarEntries.length === 0) {
    return html`
      <div class="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
          ${IconCalendar({ size: 24 })}
          Recurring Calendar
        </h1>
        <${EmptyState}
          icon=${IconCalendar({ size: 48 })}
          title="No calendar events yet"
          description="Map out recurring events, inspections, deadlines, and milestones across your annual cycle. Guided Setup walks you through the key dates."
          action=${html`<div class="flex flex-wrap justify-center gap-3">
            <${Button} onClick=${() => navigate('guided')}>Guided Setup<//>
            <${Button} variant="secondary" onClick=${handleAdd}>${IconPlus({ size: 16 })} Add Event<//>
          </div>`}
        />
      </div>
    `;
  }

  return html`
    <div class="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
          ${IconCalendar({ size: 24 })}
          Recurring Calendar
          <span class="text-base font-normal text-slate-500">(${calendarEntries.length} events)</span>
        </h1>
        <${Button} onClick=${handleAdd}>${IconPlus({ size: 16 })} Add Event<//>
      </div>

      <!-- Legend -->
      <div class="flex flex-wrap gap-3">
        ${Object.entries(RECURRENCE_COLORS).map(([key, colors]) => html`
          <div key=${key} class="flex items-center gap-1.5 text-xs text-slate-600">
            <div class=${'w-3 h-3 rounded-full ' + colors.dot}></div>
            <span>${RECURRENCE_LABELS[key]}</span>
          </div>
        `)}
      </div>

      <!-- Upcoming Events (next 30 days) -->
      ${upcoming.length > 0 && html`
        <div class="space-y-3">
          <h2 class="text-lg font-semibold text-navy-900 flex items-center gap-2">
            ${IconClock({ size: 20 })}
            Upcoming (Next 30 Days)
          </h2>
          <div class="space-y-2">
            ${upcoming.map((item, i) => html`
              <${UpcomingRow} key=${item.entry.id + '-' + item.month + '-' + i} item=${item} onClick=${handleEdit} />
            `)}
          </div>
        </div>
      `}

      <!-- 12-Month Grid -->
      <div class="space-y-3">
        <h2 class="text-lg font-semibold text-navy-900">Year at a Glance</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          ${Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
            const monthEntries = monthMap[month] || [];
            const isCurrent = month === currentMonth;

            return html`
              <div key=${month}
                class=${'rounded-lg border p-3 min-h-[120px] flex flex-col '
                  + (isCurrent
                    ? 'border-navy-400 bg-navy-50 ring-1 ring-navy-300'
                    : 'border-slate-200 bg-white')}>
                <div class=${'text-sm font-semibold mb-2 '
                  + (isCurrent ? 'text-navy-800' : 'text-slate-700')}>
                  ${MONTH_NAMES[month - 1]}
                  ${isCurrent && html`<span class="ml-1 text-xs font-normal text-navy-500">(now)</span>`}
                </div>
                <div class="flex-1 space-y-1">
                  ${monthEntries.length === 0 && html`
                    <div class="text-xs text-slate-300 italic">No events</div>
                  `}
                  ${monthEntries.slice(0, 4).map(entry => html`
                    <${EventChip} key=${entry.id} entry=${entry} onClick=${handleEdit} />
                  `)}
                  ${monthEntries.length > 4 && html`
                    <div class="text-xs text-slate-400 pl-2">+${monthEntries.length - 4} more</div>
                  `}
                </div>
              </div>
            `;
          })}
        </div>
      </div>

      <!-- Full Event List -->
      <div class="space-y-3">
        <h2 class="text-lg font-semibold text-navy-900">All Events</h2>
        <div class="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          ${calendarEntries.map(entry => {
            const meta = entry.meta || {};
            const recurrence = meta.recurrence || 'annual';
            const colors = RECURRENCE_COLORS[recurrence] || RECURRENCE_COLORS.annual;
            const months = getEventMonths(entry);
            const status = getVerificationStatus(entry);
            const vb = VER_BADGE[status] || VER_BADGE.unverified;

            return html`
              <div key=${entry.id}
                onClick=${() => handleEdit(entry)}
                class="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                <div class=${'w-2.5 h-2.5 rounded-full flex-shrink-0 ' + colors.dot}></div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h4 class="text-sm font-medium text-navy-900">${entry.title}</h4>
                    <span class=${'text-xs px-1.5 py-0.5 rounded ' + colors.bg + ' ' + colors.text}>
                      ${describeRecurrence(entry)}
                    </span>
                    <${Badge} color=${vb.color}>${vb.label}<//>
                  </div>
                  <div class="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    ${months.length > 0 && html`
                      <span>Months: ${months.map(m => MONTH_NAMES[m - 1]).join(', ')}</span>
                    `}
                    ${meta.prepLeadDays > 0 && html`
                      <span>Prep: ${meta.prepLeadDays} days</span>
                    `}
                  </div>
                  ${(entry.content || '').trim() && html`
                    <p class="text-xs text-slate-500 truncate mt-1">${entry.content.slice(0, 150)}</p>
                  `}
                </div>
              </div>
            `;
          })}
        </div>
      </div>
    </div>
  `;
}
