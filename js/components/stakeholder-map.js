// ─── Stakeholder Map ─────────────────────────────────────────────────────────
// Card-based stakeholder view grouped by contact frequency.

import { html } from '../core/config.js';
import { useApp } from './app.js';
import { Badge, Button, Card, EmptyState } from '../shared/ui.js';
import { IconUsers, IconPlus, IconSearch } from '../shared/icons.js';
import { getVerificationStatus } from '../core/search.js';

const { useState, useCallback, useMemo } = React;

// ─── Constants ───────────────────────────────────────────────────────────────

const FREQUENCY_GROUPS = [
  { id: 'daily',     label: 'Daily',     headerColor: 'text-red-800 bg-red-100' },
  { id: 'weekly',    label: 'Weekly',    headerColor: 'text-orange-800 bg-orange-100' },
  { id: 'monthly',   label: 'Monthly',   headerColor: 'text-blue-800 bg-blue-100' },
  { id: 'quarterly', label: 'Quarterly', headerColor: 'text-purple-800 bg-purple-100' },
  { id: 'asNeeded',  label: 'As Needed', headerColor: 'text-slate-700 bg-slate-100' },
];

const VERIFICATION_BADGE_MAP = {
  current:    { color: 'green',  label: 'Current' },
  expiring:   { color: 'yellow', label: 'Expiring' },
  stale:      { color: 'red',    label: 'Stale' },
  unverified: { color: 'gray',   label: 'Unverified' },
};

function VerificationBadge({ entry }) {
  const status = getVerificationStatus(entry);
  const { color, label } = VERIFICATION_BADGE_MAP[status] || VERIFICATION_BADGE_MAP.unverified;
  return html`<${Badge} color=${color}>${label}<//>`;
}

// ─── Stakeholder Card ────────────────────────────────────────────────────────

function StakeholderCard({ entry, onEdit }) {
  const meta = entry.meta || {};

  return html`
    <${Card} onClick=${() => onEdit(entry)} className="p-4 group">
      <div class="flex items-start justify-between mb-2">
        <h3 class="text-base font-semibold text-navy-900 group-hover:text-navy-700 leading-tight flex-1 mr-2">
          ${entry.title}
        </h3>
        <${VerificationBadge} entry=${entry} />
      </div>

      ${meta.org && html`
        <p class="text-sm text-slate-500 mb-2">${meta.org}</p>
      `}

      ${meta.relationship && html`
        <p class="text-sm text-slate-600 mb-3 line-clamp-2">${meta.relationship}</p>
      `}

      <div class="flex flex-wrap gap-3 text-xs text-slate-500">
        ${meta.phone && html`
          <span class="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            ${meta.phone}
          </span>
        `}
        ${meta.email && html`
          <span class="flex items-center gap-1 truncate max-w-[200px]" title=${meta.email}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            ${meta.email}
          </span>
        `}
      </div>
    <//>
  `;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function StakeholderMap() {
  const { entries, navigate } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const stakeholders = useMemo(() => {
    return entries.filter(e => e.category === 'stakeholder');
  }, [entries]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return stakeholders;
    const q = searchQuery.toLowerCase();
    return stakeholders.filter(e => {
      const meta = e.meta || {};
      return (
        (e.title || '').toLowerCase().includes(q) ||
        (meta.org || '').toLowerCase().includes(q) ||
        (meta.relationship || '').toLowerCase().includes(q) ||
        (meta.phone || '').toLowerCase().includes(q) ||
        (meta.email || '').toLowerCase().includes(q) ||
        (e.content || '').toLowerCase().includes(q)
      );
    });
  }, [stakeholders, searchQuery]);

  const grouped = useMemo(() => {
    const groups = {};
    for (const fg of FREQUENCY_GROUPS) {
      groups[fg.id] = [];
    }
    for (const entry of filtered) {
      const freq = (entry.meta && entry.meta.frequency) || 'asNeeded';
      if (groups[freq]) {
        groups[freq].push(entry);
      } else {
        groups.asNeeded.push(entry);
      }
    }
    return groups;
  }, [filtered]);

  const handleEdit = useCallback((entry) => {
    navigate('capture?id=' + entry.id + '&category=stakeholder');
  }, [navigate]);

  const handleAdd = useCallback(() => {
    navigate('capture?category=stakeholder');
  }, [navigate]);

  if (stakeholders.length === 0) {
    return html`
      <div class="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
          ${IconUsers({ size: 24 })}
          Stakeholder Map
        </h1>
        <${EmptyState}
          icon=${IconUsers({ size: 48 })}
          title="No stakeholders yet"
          description="Build your stakeholder map by adding the people and offices you work with most."
          action=${html`<${Button} onClick=${handleAdd}>${IconPlus({ size: 16 })} Add Stakeholder<//>`}
        />
      </div>
    `;
  }

  return html`
    <div class="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
          ${IconUsers({ size: 24 })}
          Stakeholder Map
          <span class="text-base font-normal text-slate-500">(${stakeholders.length})</span>
        </h1>
        <${Button} onClick=${handleAdd}>${IconPlus({ size: 16 })} Add Stakeholder<//>
      </div>

      <!-- Search -->
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          ${IconSearch({ size: 18 })}
        </div>
        <input
          type="text"
          value=${searchQuery}
          onChange=${e => setSearchQuery(e.target.value)}
          placeholder="Search stakeholders by name, org, role..."
          class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm
                 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500
                 placeholder-slate-400"
        />
      </div>

      ${filtered.length === 0 && searchQuery && html`
        <div class="text-center py-8 text-slate-500 text-sm">
          No stakeholders match "${searchQuery}". Try different terms.
        </div>
      `}

      <!-- Frequency Groups -->
      ${FREQUENCY_GROUPS.map(fg => {
        const groupEntries = grouped[fg.id] || [];
        if (groupEntries.length === 0) return null;

        return html`
          <div key=${fg.id} class="space-y-3">
            <div class="flex items-center gap-2">
              <span class=${'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ' + fg.headerColor}>
                ${fg.label}
              </span>
              <span class="text-xs text-slate-400">
                ${groupEntries.length} contact${groupEntries.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              ${groupEntries.map(entry => html`
                <${StakeholderCard} key=${entry.id} entry=${entry} onEdit=${handleEdit} />
              `)}
            </div>
          </div>
        `;
      })}
    </div>
  `;
}
