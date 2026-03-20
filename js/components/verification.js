// ─── Verification Panel ──────────────────────────────────────────────────────
// Verification tracking, bulk verify, flag for review, and Pre-PCS report.

import { html } from '../core/config.js';
import { CATEGORIES, VERIFICATION_INTERVAL_DAYS } from '../core/config.js';
import AIService from '../core/ai-service.js';
import { useApp } from './app.js';
import Store from '../core/store.js';
import { Badge, Button, Modal, ConfirmDialog, EmptyState, showToast } from '../shared/ui.js';
import { IconEye, IconCheck, IconFlag, IconWarning, IconClock } from '../shared/icons.js';

const { useState, useCallback, useMemo } = React;

// ─── Verification Status Helper ──────────────────────────────────────────────

export function getVerificationStatus(entry) {
  if (!entry.verifiedAt) return 'unverified';
  const now = Date.now();
  if (!entry.verifyBy) {
    const verified = new Date(entry.verifiedAt).getTime();
    const intervalDays = entry.verifyIntervalDays || VERIFICATION_INTERVAL_DAYS;
    const verifyByTime = verified + intervalDays * 86400000;
    if (now > verifyByTime) return 'stale';
    if ((verifyByTime - now) / 86400000 <= 30) return 'expiring';
    return 'current';
  }
  const verifyByTime = new Date(entry.verifyBy).getTime();
  if (now > verifyByTime) return 'stale';
  if ((verifyByTime - now) / 86400000 <= 30) return 'expiring';
  return 'current';
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function formatDate(dateStr) {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCategoryLabel(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.label : categoryId;
}

function getCategoryColor(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.color : 'gray';
}

const STATUS_SORT_ORDER = { stale: 0, expiring: 1, unverified: 2, current: 3 };

const VER_BADGE = {
  current:    { color: 'green',  label: 'Current' },
  expiring:   { color: 'yellow', label: 'Expiring' },
  stale:      { color: 'red',    label: 'Stale' },
  unverified: { color: 'gray',   label: 'Unverified' },
};

// ─── Flag for Review Modal ───────────────────────────────────────────────────

function FlagModal({ isOpen, onClose, entry, onFlag }) {
  const [note, setNote] = useState('');

  const handleFlag = () => {
    onFlag(entry.id, note.trim());
    setNote('');
    onClose();
  };

  if (!entry) return null;

  return html`
    <${Modal} isOpen=${isOpen} onClose=${onClose} title="Flag for Review" size="sm">
      <div class="space-y-4">
        <p class="text-sm text-slate-600">
          Add a note about what needs review for "<strong>${entry.title}</strong>".
        </p>
        <textarea
          value=${note}
          onChange=${e => setNote(e.target.value)}
          rows="3"
          class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm
                 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500
                 placeholder-slate-400"
          placeholder="What needs attention?"
        />
        <div class="flex justify-end gap-3">
          <${Button} variant="secondary" onClick=${onClose}>Cancel<//>
          <${Button} onClick=${handleFlag}>Flag for Review<//>
        </div>
      </div>
    <//>
  `;
}

// ─── Verification Row ────────────────────────────────────────────────────────

function VerificationRow({ entry, isSelected, onSelect, onVerify, onFlag, onEdit }) {
  const status = getVerificationStatus(entry);
  const days = daysUntil(entry.verifyBy);
  const vb = VER_BADGE[status] || VER_BADGE.unverified;

  const daysDisplay = (() => {
    if (status === 'unverified') return 'Never verified';
    if (status === 'stale') return Math.abs(days) + 'd overdue';
    if (days === 0) return 'Due today';
    return days + 'd remaining';
  })();

  const daysColor = (() => {
    if (status === 'stale') return 'text-red-600 font-semibold';
    if (status === 'expiring') return 'text-amber-600 font-medium';
    if (status === 'unverified') return 'text-slate-500 italic';
    return 'text-green-600';
  })();

  return html`
    <div class="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0">
      <label class="flex-shrink-0">
        <input type="checkbox" checked=${isSelected} onChange=${() => onSelect(entry.id)}
          class="w-4 h-4 rounded border-slate-300 text-navy-600 focus:ring-navy-500" />
      </label>

      <div class="flex-1 min-w-0 cursor-pointer" onClick=${() => onEdit(entry)}>
        <div class="flex items-center gap-2 flex-wrap">
          <h4 class="text-sm font-medium text-navy-900 truncate">${entry.title}</h4>
          <${Badge} color=${getCategoryColor(entry.category)}>${getCategoryLabel(entry.category)}<//>
          <${Badge} color=${vb.color}>${vb.label}<//>
        </div>
        <div class="flex items-center gap-4 mt-1 text-xs text-slate-500">
          <span>Verified: ${formatDate(entry.verifiedAt)}</span>
          <span class=${daysColor}>${daysDisplay}</span>
        </div>
        ${entry.verificationNote && html`
          <div class="mt-1 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 inline-block">
            Note: ${entry.verificationNote}
          </div>
        `}
      </div>

      <div class="flex items-center gap-1 flex-shrink-0">
        <button onClick=${() => onVerify(entry.id)}
          class="px-2.5 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded hover:bg-green-100 border border-green-200 transition-colors"
          title="Mark as verified">
          Verify
        </button>
        <button onClick=${() => onFlag(entry)}
          class="px-2.5 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded hover:bg-amber-100 border border-amber-200 transition-colors"
          title="Flag for review">
          Flag
        </button>
      </div>
    </div>
  `;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Verification() {
  const { entries, updateEntry, navigate, addToast } = useApp();
  const [selected, setSelected] = useState(new Set());
  const [flagTarget, setFlagTarget] = useState(null);
  const [aiReviewResults, setAiReviewResults] = useState(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);

  const billet = useMemo(() => Store.getBillet(), []);
  const settings = useMemo(() => Store.getSettings(), []);

  // Verify a single entry: update verifiedAt and compute new verifyBy
  const verifyEntry = useCallback((id) => {
    const now = new Date().toISOString();
    const entry = entries.find(e => e.id === id);
    const intervalDays = (entry && entry.verifyIntervalDays) || (settings.verifyIntervalDays || VERIFICATION_INTERVAL_DAYS);
    const verifyBy = new Date(Date.now() + intervalDays * 86400000).toISOString();
    updateEntry(id, { verifiedAt: now, verifyBy });
    addToast('Entry verified', 'success');
  }, [entries, settings, updateEntry, addToast]);

  // Bulk verify
  const verifySelected = useCallback(() => {
    if (selected.size === 0) return;
    const now = new Date().toISOString();
    for (const id of selected) {
      const entry = entries.find(e => e.id === id);
      const intervalDays = (entry && entry.verifyIntervalDays) || (settings.verifyIntervalDays || VERIFICATION_INTERVAL_DAYS);
      const verifyBy = new Date(Date.now() + intervalDays * 86400000).toISOString();
      updateEntry(id, { verifiedAt: now, verifyBy });
    }
    addToast(selected.size + ' entries verified', 'success');
    setSelected(new Set());
  }, [selected, entries, settings, updateEntry, addToast]);

  const entriesWithStatus = useMemo(() => {
    return entries.map(e => ({
      ...e,
      _status: getVerificationStatus(e),
      _daysUntil: daysUntil(e.verifyBy),
    })).sort((a, b) => {
      const orderA = STATUS_SORT_ORDER[a._status] != null ? STATUS_SORT_ORDER[a._status] : 9;
      const orderB = STATUS_SORT_ORDER[b._status] != null ? STATUS_SORT_ORDER[b._status] : 9;
      if (orderA !== orderB) return orderA - orderB;
      return a._daysUntil - b._daysUntil;
    });
  }, [entries]);

  const stats = useMemo(() => {
    const counts = { current: 0, expiring: 0, stale: 0, unverified: 0 };
    for (const e of entriesWithStatus) counts[e._status] = (counts[e._status] || 0) + 1;
    return counts;
  }, [entriesWithStatus]);

  const prePCSEntries = useMemo(() => {
    const pcsDate = billet.turnoverDate;
    if (!pcsDate) return null;
    const pcsTime = new Date(pcsDate).getTime();
    if (pcsTime < Date.now()) return null;
    return entriesWithStatus.filter(e => {
      if (!e.verifyBy) return true;
      return new Date(e.verifyBy).getTime() < pcsTime;
    });
  }, [entriesWithStatus, billet.turnoverDate]);

  const handleSelect = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selected.size === entriesWithStatus.length) setSelected(new Set());
    else setSelected(new Set(entriesWithStatus.map(e => e.id)));
  }, [entriesWithStatus, selected]);

  const handleFlag = useCallback((id, note) => {
    updateEntry(id, { verificationNote: note });
    addToast('Flagged for review', 'info');
  }, [updateEntry, addToast]);

  const handleEdit = useCallback((entry) => {
    navigate('capture?id=' + entry.id);
  }, [navigate]);

  if (entries.length === 0) {
    return html`
      <div class="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
          ${IconEye({ size: 24 })} Verification
        </h1>
        <${EmptyState}
          icon=${IconEye({ size: 48 })}
          title="No entries to verify"
          description="Add entries to your knowledge base first, then use this panel to track verification status."
        />
      </div>
    `;
  }

  return html`
    <div class="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
        ${IconEye({ size: 24 })} Verification
      </h1>

      <!-- Summary Stats + AI Review Button -->
      <div class="flex items-start gap-3 flex-wrap">
        <div class="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-0">
          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <div class="text-2xl font-bold text-green-800">${stats.current}</div>
            <div class="text-xs text-green-600 font-medium">Current</div>
          </div>
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div class="text-2xl font-bold text-amber-800">${stats.expiring}</div>
            <div class="text-xs text-amber-600 font-medium">Expiring (<30d)</div>
          </div>
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="text-2xl font-bold text-red-800">${stats.stale}</div>
            <div class="text-xs text-red-600 font-medium">Stale</div>
          </div>
          <div class="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div class="text-2xl font-bold text-slate-700">${stats.unverified}</div>
            <div class="text-xs text-slate-500 font-medium">Unverified</div>
          </div>
        </div>
        ${AIService.isAvailable() ? html`
          <button
            onClick=${async () => {
              setAiReviewLoading(true);
              setAiReviewResults(null);
              try {
                const results = await AIService.reviewVerification(entries);
                setAiReviewResults(results);
                if (!results || results.length === 0) {
                  showToast('AI review complete -- no issues found.', 'success');
                }
              } catch (err) {
                showToast('AI review failed: ' + (err.message || 'Unknown error'), 'error');
              } finally {
                setAiReviewLoading(false);
              }
            }}
            disabled=${aiReviewLoading}
            class="flex-shrink-0 px-4 py-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium
                   hover:bg-purple-100 transition-colors flex items-center gap-2 disabled:opacity-50"
            title="AI-powered review of entry quality"
          >
            ${aiReviewLoading ? html`
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ` : html`
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            `}
            AI Review
          </button>
        ` : html`
          <span
            class="flex-shrink-0 px-4 py-2.5 bg-slate-50 text-slate-400 border border-slate-200 rounded-lg text-sm font-medium
                   flex items-center gap-2 cursor-default"
            title="Set up Firebase in Settings to enable AI"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            AI Review
          </span>
        `}
      </div>

      <!-- AI Review Results -->
      ${aiReviewResults && aiReviewResults.length > 0 && html`
        <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-purple-800 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-purple-600">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              AI Review Found ${aiReviewResults.length} Issue${aiReviewResults.length !== 1 ? 's' : ''}
            </h3>
            <button
              onClick=${() => setAiReviewResults(null)}
              class="text-xs text-purple-600 hover:text-purple-800 font-medium"
            >
              Dismiss
            </button>
          </div>
          <div class="divide-y divide-purple-200 bg-white/60 rounded-lg">
            ${aiReviewResults.map((item, idx) => {
              const matchedEntry = entries.find(e => e.id === item.entryId);
              return html`
                <div key=${idx} class="flex items-center justify-between p-3 text-sm">
                  <div class="flex-1 min-w-0">
                    <span class="font-medium text-purple-900">${matchedEntry ? matchedEntry.title : item.entryId}</span>
                    <p class="text-xs text-purple-700 mt-0.5">${item.issue}</p>
                  </div>
                  ${matchedEntry && html`
                    <button
                      onClick=${() => navigate('capture?id=' + matchedEntry.id)}
                      class="ml-3 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 border border-purple-300 flex-shrink-0"
                    >
                      Go to Entry
                    </button>
                  `}
                </div>
              `;
            })}
          </div>
        </div>
      `}

      <!-- Pre-PCS Report -->
      ${prePCSEntries && prePCSEntries.length > 0 && html`
        <div class="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-3">
          <div class="flex items-center gap-2">
            ${IconWarning({ size: 18, className: 'text-amber-600' })}
            <h2 class="text-base font-semibold text-amber-800">Pre-PCS Report</h2>
            <span class="text-xs text-amber-600">(Turnover: ${formatDate(billet.turnoverDate)})</span>
          </div>
          <p class="text-sm text-amber-700">
            ${prePCSEntries.length} entries will be stale or unverified by your turnover date. Verify these before departing.
          </p>
          <div class="divide-y divide-amber-200 bg-white/50 rounded-lg">
            ${prePCSEntries.slice(0, 10).map(entry => html`
              <div key=${entry.id}
                class="flex items-center justify-between p-2 text-sm hover:bg-amber-100/50 cursor-pointer"
                onClick=${() => handleEdit(entry)}>
                <div>
                  <span class="font-medium text-amber-900">${entry.title}</span>
                  <span class="text-xs text-amber-600 ml-2">${getCategoryLabel(entry.category)}</span>
                </div>
                <button
                  onClick=${(e) => { e.stopPropagation(); verifyEntry(entry.id); }}
                  class="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 border border-green-300">
                  Verify
                </button>
              </div>
            `)}
            ${prePCSEntries.length > 10 && html`
              <div class="p-2 text-xs text-amber-600 text-center">+${prePCSEntries.length - 10} more</div>
            `}
          </div>
        </div>
      `}

      <!-- Bulk Actions -->
      <div class="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2">
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox"
              checked=${selected.size === entriesWithStatus.length && entriesWithStatus.length > 0}
              onChange=${handleSelectAll}
              class="w-4 h-4 rounded border-slate-300 text-navy-600 focus:ring-navy-500" />
            Select All
          </label>
          ${selected.size > 0 && html`
            <span class="text-xs text-slate-500">${selected.size} selected</span>
          `}
        </div>
        <${Button} variant="secondary" size="sm" onClick=${verifySelected} disabled=${selected.size === 0}>
          ${IconCheck({ size: 14 })} Verify Selected
        <//>
      </div>

      <!-- Entry List -->
      <div class="bg-white rounded-lg border border-slate-200">
        ${entriesWithStatus.map(entry => html`
          <${VerificationRow}
            key=${entry.id}
            entry=${entry}
            isSelected=${selected.has(entry.id)}
            onSelect=${handleSelect}
            onVerify=${verifyEntry}
            onFlag=${(entry) => setFlagTarget(entry)}
            onEdit=${handleEdit}
          />
        `)}
      </div>

      <${FlagModal}
        isOpen=${flagTarget != null}
        onClose=${() => setFlagTarget(null)}
        entry=${flagTarget}
        onFlag=${handleFlag}
      />
    </div>
  `;
}
