// ─── Entry List — Browsable, filterable list of all knowledge entries ──────────
// Card view (default) and Table view with filters, sort, search, and bulk actions.
// Rendered at #browse (or imported by other components).

import { html, CATEGORIES, PRIORITIES, VERIFICATION_INTERVAL_DAYS } from '../core/config.js';
import { AppContext } from './app.js';
import { Button, Badge, EmptyState, ConfirmDialog, showToast } from '../shared/ui.js';
import {
  IconSearch, IconPlus, IconEdit, IconTrash, IconCheck, IconFolder,
  IconScale, IconUsers, IconCalendar, IconLightbulb, IconFlag,
  IconStar, IconX,
} from '../shared/icons.js';

const { useState, useEffect, useCallback, useContext, useMemo } = React;

// ═══════════════════════════════════════════════════════════════════════════════
// Verification Status Helper (exported for other components)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns the verification status of an entry.
 * @param {Object} entry
 * @returns {'current' | 'expiring' | 'stale' | 'unverified'}
 */
export function getVerificationStatus(entry) {
  if (!entry.verifiedAt) return 'unverified';

  const now = Date.now();

  // If verifyBy is set, use it directly
  if (entry.verifyBy) {
    const verifyByTime = new Date(entry.verifyBy).getTime();
    if (isNaN(verifyByTime)) return 'unverified';
    const daysUntilExpiry = (verifyByTime - now) / 86400000;
    if (daysUntilExpiry <= 0) return 'stale';
    if (daysUntilExpiry <= 14) return 'expiring';
    return 'current';
  }

  // Fallback: compute from verifiedAt + interval
  const verifiedTime = new Date(entry.verifiedAt).getTime();
  if (isNaN(verifiedTime)) return 'unverified';
  const intervalDays = entry.verifyIntervalDays || entry.expiresInDays || VERIFICATION_INTERVAL_DAYS;
  const expiresAt = verifiedTime + intervalDays * 86400000;
  const daysUntilExpiry = (expiresAt - now) / 86400000;
  if (daysUntilExpiry <= 0) return 'stale';
  if (daysUntilExpiry <= 14) return 'expiring';
  return 'current';
}

// ─── Status display label and color ──────────────────────────────────────────

const VERIFICATION_LABELS = {
  current: 'Current',
  expiring: 'Expiring Soon',
  stale: 'Stale',
  unverified: 'Unverified',
};

const VERIFICATION_BADGE_COLORS = {
  current: 'green',
  expiring: 'yellow',
  stale: 'red',
  unverified: 'gray',
};

// Helper: renders a verification badge using the shared Badge component.
function VerificationBadge({ status }) {
  return html`
    <${Badge} color=${VERIFICATION_BADGE_COLORS[status] || 'gray'}>
      ${VERIFICATION_LABELS[status] || status}
    <//>
  `;
}

// ─── Category icon lookup ────────────────────────────────────────────────────

const CATEGORY_ICONS = {
  process: IconFolder,
  decision: IconScale,
  stakeholder: IconUsers,
  calendar: IconCalendar,
  lesson: IconLightbulb,
  issue: IconFlag,
};

// ─── Category color classes ──────────────────────────────────────────────────

const CATEGORY_BADGE_COLORS = {
  process: 'bg-blue-100 text-blue-700 border-blue-200',
  decision: 'bg-purple-100 text-purple-700 border-purple-200',
  stakeholder: 'bg-green-100 text-green-700 border-green-200',
  calendar: 'bg-orange-100 text-orange-700 border-orange-200',
  lesson: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  issue: 'bg-red-100 text-red-700 border-red-200',
};

// ─── Priority color classes ──────────────────────────────────────────────────

const PRIORITY_COLORS = {
  high: 'text-red-600',
  medium: 'text-yellow-600',
  low: 'text-slate-400',
};

const PRIORITY_DOTS = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-slate-300',
};

// ─── Sort options ────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'updated-desc', label: 'Recently Updated' },
  { value: 'updated-asc', label: 'Oldest Updated' },
  { value: 'title-asc', label: 'Title A-Z' },
  { value: 'title-desc', label: 'Title Z-A' },
  { value: 'priority-desc', label: 'Priority (High First)' },
  { value: 'priority-asc', label: 'Priority (Low First)' },
  { value: 'verification', label: 'Verification Status' },
];

const PRIORITY_ORDER = { high: 3, medium: 2, low: 1 };
const VERIFICATION_ORDER = { stale: 4, expiring: 3, unverified: 2, current: 1 };

// ─── Plain text truncation ──────────────────────────────────────────────────

function truncatePlainText(content, maxLines = 2) {
  if (!content) return '';
  const plain = content
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[>\-*+]\s+/g, '')
    .replace(/\n{2,}/g, '\n');

  const lines = plain.split('\n').filter(l => l.trim());
  const truncated = lines.slice(0, maxLines).join(' ');
  return truncated.length > 180 ? truncated.slice(0, 180) + '...' : truncated;
}

// ─── Format date ────────────────────────────────────────────────────────────

function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EntryList Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function EntryList() {
  const ctx = useContext(AppContext);
  const { entries, updateEntry, deleteEntry, navigate } = ctx;

  // ─── View Mode ─────────────────────────────────────────────────────────────

  const [viewMode, setViewMode] = useState('card'); // 'card' | 'table'

  // ─── Filters ──────────────────────────────────────────────────────────────

  const [filterCategories, setFilterCategories] = useState(new Set());
  const [filterPriorities, setFilterPriorities] = useState(new Set());
  const [filterVerification, setFilterVerification] = useState(new Set());
  const [filterTags, setFilterTags] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // ─── Search ───────────────────────────────────────────────────────────────

  const [searchQuery, setSearchQuery] = useState('');

  // ─── Sort ─────────────────────────────────────────────────────────────────

  const [sortBy, setSortBy] = useState('updated-desc');

  // ─── Bulk Selection ───────────────────────────────────────────────────────

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkPrioritySelect, setShowBulkPrioritySelect] = useState(false);

  // ─── Compute tag cloud ────────────────────────────────────────────────────

  const tagCloud = useMemo(() => {
    const counts = {};
    for (const entry of entries) {
      if (Array.isArray(entry.tags)) {
        for (const tag of entry.tags) {
          counts[tag] = (counts[tag] || 0) + 1;
        }
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [entries]);

  // ─── Compute category counts ──────────────────────────────────────────────

  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const cat of CATEGORIES) counts[cat.id] = 0;
    for (const entry of entries) {
      if (counts[entry.category] !== undefined) counts[entry.category]++;
    }
    return counts;
  }, [entries]);

  // ─── Compute verification counts ──────────────────────────────────────────

  const verificationCounts = useMemo(() => {
    const counts = { current: 0, expiring: 0, stale: 0, unverified: 0 };
    for (const entry of entries) {
      const status = getVerificationStatus(entry);
      counts[status]++;
    }
    return counts;
  }, [entries]);

  // ─── Filtered + Sorted Entries ────────────────────────────────────────────

  const filteredEntries = useMemo(() => {
    let result = [...entries];

    // Search filter (simple substring match)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(entry => {
        const searchable = [
          entry.title || '',
          entry.content || '',
          ...(entry.tags || []),
          entry.category || '',
          entry.priority || '',
        ].join(' ').toLowerCase();
        return searchable.includes(q);
      });
    }

    // Category filter
    if (filterCategories.size > 0) {
      result = result.filter(e => filterCategories.has(e.category));
    }

    // Priority filter
    if (filterPriorities.size > 0) {
      result = result.filter(e => filterPriorities.has(e.priority));
    }

    // Verification filter
    if (filterVerification.size > 0) {
      result = result.filter(e => filterVerification.has(getVerificationStatus(e)));
    }

    // Tag filter
    if (filterTags.size > 0) {
      result = result.filter(e =>
        Array.isArray(e.tags) && e.tags.some(t => filterTags.has(t))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'updated-desc':
          return (b.updatedAt || '').localeCompare(a.updatedAt || '');
        case 'updated-asc':
          return (a.updatedAt || '').localeCompare(b.updatedAt || '');
        case 'title-asc':
          return (a.title || '').localeCompare(b.title || '');
        case 'title-desc':
          return (b.title || '').localeCompare(a.title || '');
        case 'priority-desc':
          return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
        case 'priority-asc':
          return (PRIORITY_ORDER[a.priority] || 0) - (PRIORITY_ORDER[b.priority] || 0);
        case 'verification': {
          const sa = VERIFICATION_ORDER[getVerificationStatus(a)] || 0;
          const sb = VERIFICATION_ORDER[getVerificationStatus(b)] || 0;
          return sb - sa;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [entries, searchQuery, filterCategories, filterPriorities, filterVerification, filterTags, sortBy]);

  // ─── Clear selection when entries change ──────────────────────────────────

  useEffect(() => {
    setSelectedIds(prev => {
      const entryIds = new Set(entries.map(e => e.id));
      const next = new Set([...prev].filter(id => entryIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [entries]);

  // ─── Toggle helpers ───────────────────────────────────────────────────────

  const toggleSetValue = useCallback((setter, value) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  const toggleSelectEntry = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const ids = filteredEntries.map(e => e.id);
    setSelectedIds(new Set(ids));
  }, [filteredEntries]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ─── Bulk Actions ─────────────────────────────────────────────────────────

  const handleBulkVerify = useCallback(() => {
    if (selectedIds.size === 0) return;
    const now = new Date().toISOString();
    for (const id of selectedIds) {
      const entry = entries.find(e => e.id === id);
      if (!entry) continue;
      const intervalDays = entry.verifyIntervalDays || entry.expiresInDays || VERIFICATION_INTERVAL_DAYS;
      const verifyBy = new Date(Date.now() + intervalDays * 86400000).toISOString();
      updateEntry(id, { verifiedAt: now, verifyBy });
    }
    showToast(selectedIds.size + ' entries verified.', 'success');
    setSelectedIds(new Set());
  }, [selectedIds, entries, updateEntry]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      deleteEntry(id);
    }
    // deleteEntry already shows individual toasts; show a summary instead
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
  }, [selectedIds, deleteEntry]);

  const handleBulkPriority = useCallback((priority) => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      updateEntry(id, { priority });
    }
    showToast(selectedIds.size + ' entries updated to ' + priority + ' priority.', 'success');
    setSelectedIds(new Set());
    setShowBulkPrioritySelect(false);
  }, [selectedIds, updateEntry]);

  // ─── Quick Actions ────────────────────────────────────────────────────────

  const handleQuickVerify = useCallback((id) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const now = new Date().toISOString();
    const intervalDays = entry.verifyIntervalDays || entry.expiresInDays || VERIFICATION_INTERVAL_DAYS;
    const verifyBy = new Date(Date.now() + intervalDays * 86400000).toISOString();
    updateEntry(id, { verifiedAt: now, verifyBy });
    showToast('Entry verified.', 'success');
  }, [entries, updateEntry]);

  const handleQuickDelete = useCallback((id) => {
    deleteEntry(id);
    // deleteEntry shows its own toast
  }, [deleteEntry]);

  // ─── Active filter count ──────────────────────────────────────────────────

  const activeFilterCount = filterCategories.size + filterPriorities.size + filterVerification.size + filterTags.size;

  const clearAllFilters = useCallback(() => {
    setFilterCategories(new Set());
    setFilterPriorities(new Set());
    setFilterVerification(new Set());
    setFilterTags(new Set());
    setSearchQuery('');
  }, []);

  // ═════════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════════

  return html`
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-4">

      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold text-navy-900">Knowledge Base</h2>
          <p class="text-sm text-slate-500">
            ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} total
            ${filteredEntries.length !== entries.length
              ? ' (' + filteredEntries.length + ' shown)'
              : ''}
          </p>
        </div>
        <${Button}
          variant="primary"
          onClick=${() => navigate('capture')}>
          <${IconPlus} size=${16} /> Add Entry
        <//>
      </div>

      <!-- Search & Controls Bar -->
      <div class="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
        <div class="flex flex-col sm:flex-row gap-3">
          <!-- Search -->
          <div class="relative flex-1">
            <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <${IconSearch} size=${16} />
            </div>
            <input
              type="text"
              value=${searchQuery}
              onChange=${(e) => setSearchQuery(e.target.value)}
              placeholder="Search entries..."
              class="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md
                     text-slate-700 placeholder-slate-400
                     focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500 focus:bg-white"
            />
            ${searchQuery && html`
              <button
                onClick=${() => setSearchQuery('')}
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600">
                <${IconX} size=${14} />
              </button>
            `}
          </div>

          <!-- Sort -->
          <div class="flex items-center gap-2">
            <select
              value=${sortBy}
              onChange=${(e) => setSortBy(e.target.value)}
              class="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-700
                     focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500
                     appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-8">
              ${SORT_OPTIONS.map(opt => html`
                <option key=${opt.value} value=${opt.value}>${opt.label}</option>
              `)}
            </select>

            <!-- Filter Toggle -->
            <button
              onClick=${() => setShowFilters(prev => !prev)}
              class=${'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border transition-colors '
                + (showFilters || activeFilterCount > 0
                  ? 'bg-navy-50 border-navy-200 text-navy-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100')}>
              Filters
              ${activeFilterCount > 0 && html`
                <span class="bg-navy-700 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  ${activeFilterCount}
                </span>
              `}
            </button>

            <!-- View Mode Toggle -->
            <div class="flex border border-slate-200 rounded-md overflow-hidden">
              <button
                onClick=${() => setViewMode('card')}
                title="Card view"
                class=${'px-2.5 py-2 text-sm transition-colors '
                  + (viewMode === 'card' ? 'bg-navy-700 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
              <button
                onClick=${() => setViewMode('table')}
                title="Table view"
                class=${'px-2.5 py-2 text-sm border-l border-slate-200 transition-colors '
                  + (viewMode === 'table' ? 'bg-navy-700 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Filter Panel (expandable) -->
        ${showFilters && html`
          <div class="mt-3 pt-3 border-t border-slate-100">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              <!-- Category Filters -->
              <div>
                <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Category</h4>
                <div class="space-y-1.5">
                  ${CATEGORIES.map(cat => {
                    const count = categoryCounts[cat.id] || 0;
                    const isActive = filterCategories.has(cat.id);
                    return html`
                      <label key=${cat.id} class="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked=${isActive}
                          onChange=${() => toggleSetValue(setFilterCategories, cat.id)}
                          class="w-3.5 h-3.5 rounded border-slate-300 text-navy-700 focus:ring-navy-500"
                        />
                        <span class="flex-1 text-sm text-slate-700">${cat.label}</span>
                        <span class="text-xs text-slate-400">${count}</span>
                      </label>
                    `;
                  })}
                </div>
              </div>

              <!-- Priority Filters -->
              <div>
                <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Priority</h4>
                <div class="space-y-1.5">
                  ${PRIORITIES.map(pri => {
                    const count = entries.filter(e => e.priority === pri.id).length;
                    const isActive = filterPriorities.has(pri.id);
                    return html`
                      <label key=${pri.id} class="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked=${isActive}
                          onChange=${() => toggleSetValue(setFilterPriorities, pri.id)}
                          class="w-3.5 h-3.5 rounded border-slate-300 text-navy-700 focus:ring-navy-500"
                        />
                        <span class="flex items-center gap-1.5 flex-1 text-sm text-slate-700">
                          <span class=${'w-2 h-2 rounded-full ' + (PRIORITY_DOTS[pri.id] || 'bg-slate-300')}></span>
                          ${pri.label}
                        </span>
                        <span class="text-xs text-slate-400">${count}</span>
                      </label>
                    `;
                  })}
                </div>
              </div>

              <!-- Verification Filters -->
              <div>
                <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Verification</h4>
                <div class="space-y-1.5">
                  ${['current', 'expiring', 'stale', 'unverified'].map(status => {
                    const count = verificationCounts[status] || 0;
                    const isActive = filterVerification.has(status);
                    return html`
                      <label key=${status} class="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked=${isActive}
                          onChange=${() => toggleSetValue(setFilterVerification, status)}
                          class="w-3.5 h-3.5 rounded border-slate-300 text-navy-700 focus:ring-navy-500"
                        />
                        <span class="flex-1 text-sm text-slate-700">${VERIFICATION_LABELS[status]}</span>
                        <span class="text-xs text-slate-400">${count}</span>
                      </label>
                    `;
                  })}
                </div>
              </div>

              <!-- Tag Cloud -->
              <div>
                <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tags</h4>
                ${tagCloud.length > 0
                  ? html`
                    <div class="flex flex-wrap gap-1 max-h-[140px] overflow-y-auto">
                      ${tagCloud.map(({ tag, count }) => {
                        const isActive = filterTags.has(tag);
                        return html`
                          <button key=${tag}
                            onClick=${() => toggleSetValue(setFilterTags, tag)}
                            class=${'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors '
                              + (isActive
                                ? 'bg-navy-100 text-navy-700 border-navy-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100')}>
                            ${tag}
                            <span class="text-[10px] opacity-60">${count}</span>
                          </button>
                        `;
                      })}
                    </div>
                  `
                  : html`<p class="text-xs text-slate-400 italic">No tags yet.</p>`
                }
              </div>
            </div>

            ${activeFilterCount > 0 && html`
              <div class="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span class="text-xs text-slate-500">${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active</span>
                <button
                  onClick=${clearAllFilters}
                  class="text-xs text-navy-600 hover:text-navy-800 font-medium">
                  Clear all filters
                </button>
              </div>
            `}
          </div>
        `}
      </div>

      <!-- Bulk Actions Bar -->
      ${selectedIds.size > 0 && html`
        <div class="bg-navy-50 border border-navy-200 rounded-lg p-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-navy-800">
              ${selectedIds.size} selected
            </span>
            <button onClick=${deselectAll} class="text-xs text-navy-600 hover:text-navy-800 underline">
              Clear selection
            </button>
          </div>
          <div class="flex items-center gap-2">
            <${Button}
              variant="secondary"
              size="sm"
              onClick=${handleBulkVerify}>
              <${IconCheck} size=${14} /> Verify
            <//>
            <div class="relative">
              <${Button}
                variant="secondary"
                size="sm"
                onClick=${() => setShowBulkPrioritySelect(prev => !prev)}>
                Set Priority
              <//>
              ${showBulkPrioritySelect && html`
                <div class="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg border border-slate-200 shadow-lg py-1 min-w-[120px]">
                  ${PRIORITIES.map(pri => html`
                    <button key=${pri.id}
                      onClick=${() => handleBulkPriority(pri.id)}
                      class="w-full px-3 py-1.5 text-sm text-left hover:bg-slate-50 flex items-center gap-2">
                      <span class=${'w-2 h-2 rounded-full ' + (PRIORITY_DOTS[pri.id] || 'bg-slate-300')}></span>
                      ${pri.label}
                    </button>
                  `)}
                </div>
              `}
            </div>
            <${Button}
              variant="danger"
              size="sm"
              onClick=${() => setShowBulkDeleteConfirm(true)}>
              <${IconTrash} size=${14} /> Delete
            <//>
          </div>
        </div>
      `}

      <!-- Content -->
      ${filteredEntries.length === 0
        ? html`
          <${EmptyState}
            icon=${html`<${IconFolder} size=${48} />`}
            title=${entries.length === 0 ? 'No entries yet.' : 'No entries match your filters.'}
            description=${entries.length === 0
              ? 'Start capturing knowledge!'
              : 'Try adjusting your search or filters.'}
            action=${entries.length === 0
              ? html`<${Button} variant="primary" size="sm" onClick=${() => navigate('capture')}>
                  <${IconPlus} size=${16} /> Add Entry
                <//>`
              : activeFilterCount > 0
                ? html`<${Button} variant="secondary" size="sm" onClick=${clearAllFilters}>
                    Clear Filters
                  <//>`
                : null}
          />
        `
        : viewMode === 'card'
          ? html`<${CardView}
              entries=${filteredEntries}
              selectedIds=${selectedIds}
              onToggleSelect=${toggleSelectEntry}
              onSelectAll=${selectAll}
              onDeselectAll=${deselectAll}
              onQuickVerify=${handleQuickVerify}
              onQuickDelete=${handleQuickDelete}
              onNavigate=${navigate}
            />`
          : html`<${TableView}
              entries=${filteredEntries}
              selectedIds=${selectedIds}
              onToggleSelect=${toggleSelectEntry}
              onSelectAll=${selectAll}
              onDeselectAll=${deselectAll}
              sortBy=${sortBy}
              onSort=${setSortBy}
              onNavigate=${navigate}
            />`
      }

      <!-- Bulk Delete Confirmation -->
      <${ConfirmDialog}
        isOpen=${showBulkDeleteConfirm}
        onCancel=${() => setShowBulkDeleteConfirm(false)}
        onConfirm=${handleBulkDelete}
        title="Delete Entries"
        message=${'Are you sure you want to delete ' + selectedIds.size + ' selected entries? This action cannot be undone.'}
        confirmText="Delete All"
        danger=${true}
      />
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Card View
// ═══════════════════════════════════════════════════════════════════════════════

function CardView({ entries, selectedIds, onToggleSelect, onSelectAll, onDeselectAll, onQuickVerify, onQuickDelete, onNavigate }) {
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const allSelected = selectedIds.size > 0 && selectedIds.size === entries.length;

  return html`
    <div>
      <!-- Select All -->
      <div class="flex items-center justify-between mb-2">
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked=${allSelected}
            onChange=${() => {
              if (allSelected) {
                onDeselectAll();
              } else {
                onSelectAll();
              }
            }}
            class="w-3.5 h-3.5 rounded border-slate-300 text-navy-700 focus:ring-navy-500"
          />
          <span class="text-xs text-slate-500">Select all (${entries.length})</span>
        </label>
      </div>

      <!-- Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        ${entries.map(entry => {
          const catObj = CATEGORIES.find(c => c.id === entry.category);
          const CatIcon = CATEGORY_ICONS[entry.category];
          const vStatus = getVerificationStatus(entry);
          const isSelected = selectedIds.has(entry.id);

          return html`
            <div key=${entry.id}
              class=${'bg-white rounded-lg border shadow-sm transition-all hover:shadow-md '
                + (isSelected ? 'border-navy-400 ring-1 ring-navy-200' : 'border-slate-200')}>

              <!-- Card Header -->
              <div class="p-4 pb-2">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-start gap-2 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked=${isSelected}
                      onChange=${() => onToggleSelect(entry.id)}
                      class="mt-1 w-3.5 h-3.5 rounded border-slate-300 text-navy-700 focus:ring-navy-500 flex-shrink-0"
                    />
                    <div class="min-w-0 flex-1">
                      <!-- Category Badge -->
                      <div class="flex items-center gap-2 mb-1.5">
                        <span class=${'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border '
                          + (CATEGORY_BADGE_COLORS[entry.category] || 'bg-slate-100 text-slate-600 border-slate-200')}>
                          ${CatIcon && html`<${CatIcon} size=${12} />`}
                          ${catObj?.label || entry.category}
                        </span>
                        ${entry.essentialReading && html`
                          <span class="text-yellow-500" title="Essential Reading">
                            <${IconStar} size=${14} />
                          </span>
                        `}
                      </div>
                      <!-- Title -->
                      <button
                        onClick=${() => onNavigate('capture?id=' + entry.id)}
                        class="text-sm font-semibold text-navy-900 hover:text-navy-700 text-left leading-snug block truncate w-full">
                        ${entry.title}
                      </button>
                    </div>
                  </div>

                  <!-- Priority dot -->
                  <span class=${'w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 '
                    + (PRIORITY_DOTS[entry.priority] || 'bg-slate-300')}
                    title=${(entry.priority || 'medium') + ' priority'}>
                  </span>
                </div>
              </div>

              <!-- Card Body -->
              <div class="px-4 pb-3">
                ${entry.content && html`
                  <p class="text-xs text-slate-500 leading-relaxed mb-2 line-clamp-2">
                    ${truncatePlainText(entry.content, 2)}
                  </p>
                `}

                <!-- Tags -->
                ${(entry.tags || []).length > 0 && html`
                  <div class="flex flex-wrap gap-1 mb-2">
                    ${entry.tags.slice(0, 4).map(tag => html`
                      <span key=${tag}
                        class="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-500">
                        ${tag}
                      </span>
                    `)}
                    ${entry.tags.length > 4 && html`
                      <span class="px-1.5 py-0.5 text-[10px] text-slate-400">+${entry.tags.length - 4} more</span>
                    `}
                  </div>
                `}
              </div>

              <!-- Card Footer -->
              <div class="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <${VerificationBadge} status=${vStatus} />
                  <span class="text-[10px] text-slate-400">${formatDate(entry.updatedAt)}</span>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    onClick=${() => onNavigate('capture?id=' + entry.id)}
                    title="Edit"
                    class="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <${IconEdit} size=${14} />
                  </button>
                  <button
                    onClick=${() => onQuickVerify(entry.id)}
                    title="Verify"
                    class="p-1.5 rounded hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors">
                    <${IconCheck} size=${14} />
                  </button>
                  <button
                    onClick=${() => setDeleteConfirmId(entry.id)}
                    title="Delete"
                    class="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                    <${IconTrash} size=${14} />
                  </button>
                </div>
              </div>
            </div>
          `;
        })}
      </div>

      <!-- Inline delete confirm -->
      <${ConfirmDialog}
        isOpen=${deleteConfirmId !== null}
        onCancel=${() => setDeleteConfirmId(null)}
        onConfirm=${() => {
          onQuickDelete(deleteConfirmId);
          setDeleteConfirmId(null);
        }}
        title="Delete Entry"
        message="Are you sure you want to delete this entry? This action cannot be undone."
        confirmText="Delete"
        danger=${true}
      />
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Table View
// ═══════════════════════════════════════════════════════════════════════════════

function TableView({ entries, selectedIds, onToggleSelect, onSelectAll, onDeselectAll, sortBy, onSort, onNavigate }) {
  const allSelected = selectedIds.size > 0 && selectedIds.size === entries.length;

  const handleSelectAllToggle = useCallback(() => {
    if (allSelected) onDeselectAll();
    else onSelectAll();
  }, [allSelected, onSelectAll, onDeselectAll]);

  // Sortable column header helper
  const SortHeader = ({ label, sortAsc, sortDesc }) => {
    const isAsc = sortBy === sortAsc;
    const isDesc = sortBy === sortDesc;
    const isActive = isAsc || isDesc;
    return html`
      <button
        onClick=${() => onSort(isAsc ? sortDesc : sortAsc)}
        class=${'flex items-center gap-1 text-xs font-semibold uppercase tracking-wide hover:text-navy-700 transition-colors '
          + (isActive ? 'text-navy-700' : 'text-slate-500')}>
        ${label}
        ${isAsc && html`<span class="text-[10px]">\u25B2</span>`}
        ${isDesc && html`<span class="text-[10px]">\u25BC</span>`}
      </button>
    `;
  };

  return html`
    <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50">
              <th class="px-3 py-2.5 text-left w-10">
                <input
                  type="checkbox"
                  checked=${allSelected}
                  onChange=${handleSelectAllToggle}
                  class="w-3.5 h-3.5 rounded border-slate-300 text-navy-700 focus:ring-navy-500"
                />
              </th>
              <th class="px-3 py-2.5 text-left">
                <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</span>
              </th>
              <th class="px-3 py-2.5 text-left">
                <${SortHeader} label="Title" sortAsc="title-asc" sortDesc="title-desc" />
              </th>
              <th class="px-3 py-2.5 text-left">
                <${SortHeader} label="Priority" sortAsc="priority-asc" sortDesc="priority-desc" />
              </th>
              <th class="px-3 py-2.5 text-left">
                <${SortHeader} label="Verification" sortAsc="verification" sortDesc="verification" />
              </th>
              <th class="px-3 py-2.5 text-left">
                <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tags</span>
              </th>
              <th class="px-3 py-2.5 text-left">
                <${SortHeader} label="Updated" sortAsc="updated-asc" sortDesc="updated-desc" />
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${entries.map(entry => {
              const catObj = CATEGORIES.find(c => c.id === entry.category);
              const CatIcon = CATEGORY_ICONS[entry.category];
              const vStatus = getVerificationStatus(entry);
              const isSelected = selectedIds.has(entry.id);

              return html`
                <tr key=${entry.id}
                  class=${'transition-colors cursor-pointer '
                    + (isSelected ? 'bg-navy-50' : 'hover:bg-slate-50')}
                  onClick=${(e) => {
                    if (e.target.type === 'checkbox') return;
                    onNavigate('capture?id=' + entry.id);
                  }}>
                  <td class="px-3 py-2.5" onClick=${(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked=${isSelected}
                      onChange=${() => onToggleSelect(entry.id)}
                      class="w-3.5 h-3.5 rounded border-slate-300 text-navy-700 focus:ring-navy-500"
                    />
                  </td>
                  <td class="px-3 py-2.5">
                    <span class=${'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border '
                      + (CATEGORY_BADGE_COLORS[entry.category] || 'bg-slate-100 text-slate-600 border-slate-200')}>
                      ${CatIcon && html`<${CatIcon} size=${12} />`}
                      ${catObj?.label || entry.category}
                    </span>
                  </td>
                  <td class="px-3 py-2.5">
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm font-medium text-navy-900 truncate max-w-[300px]">
                        ${entry.title}
                      </span>
                      ${entry.essentialReading && html`
                        <span class="text-yellow-500 flex-shrink-0" title="Essential Reading">
                          <${IconStar} size=${12} />
                        </span>
                      `}
                    </div>
                  </td>
                  <td class="px-3 py-2.5">
                    <span class="flex items-center gap-1.5 text-xs">
                      <span class=${'w-2 h-2 rounded-full ' + (PRIORITY_DOTS[entry.priority] || 'bg-slate-300')}></span>
                      <span class=${PRIORITY_COLORS[entry.priority] || 'text-slate-500'}>
                        ${(entry.priority || 'medium').charAt(0).toUpperCase() + (entry.priority || 'medium').slice(1)}
                      </span>
                    </span>
                  </td>
                  <td class="px-3 py-2.5">
                    <${VerificationBadge} status=${vStatus} />
                  </td>
                  <td class="px-3 py-2.5">
                    <div class="flex flex-wrap gap-1 max-w-[200px]">
                      ${(entry.tags || []).slice(0, 3).map(tag => html`
                        <span key=${tag}
                          class="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-500">
                          ${tag}
                        </span>
                      `)}
                      ${(entry.tags || []).length > 3 && html`
                        <span class="text-[10px] text-slate-400">+${entry.tags.length - 3}</span>
                      `}
                    </div>
                  </td>
                  <td class="px-3 py-2.5">
                    <span class="text-xs text-slate-500">${formatDate(entry.updatedAt)}</span>
                  </td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
