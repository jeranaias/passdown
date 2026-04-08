// ─── Search Panel ────────────────────────────────────────────────────────────
// Full-text search with filters, highlighted results, and category/status facets.

import { html } from '../core/config.js';
import { CATEGORIES, PRIORITIES } from '../core/config.js';
import AIService from '../core/ai-service.js';
import { useApp } from './app.js';
import { buildIndex, search, highlightMatches, getVerificationStatus } from '../core/search.js';
import { Badge, Button, EmptyState } from '../shared/ui.js';
import { IconSearch } from '../shared/icons.js';

const { useState, useEffect, useCallback, useMemo, useRef } = React;

// ─── Debounce hook ───────────────────────────────────────────────────────────

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const VERIFICATION_STATUSES = [
  { id: 'current',    label: 'Current' },
  { id: 'expiring',   label: 'Expiring' },
  { id: 'stale',      label: 'Stale' },
  { id: 'unverified', label: 'Unverified' },
];

const VER_BADGE = {
  current:    { color: 'green',  label: 'Current' },
  expiring:   { color: 'yellow', label: 'Expiring' },
  stale:      { color: 'red',    label: 'Stale' },
  unverified: { color: 'gray',   label: 'Unverified' },
};

function getCategoryInfo(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return { label: categoryId, color: 'gray' };
  return { label: cat.label, color: cat.color };
}

// ─── Highlighted Text ────────────────────────────────────────────────────────

function HighlightedText({ text, query }) {
  if (!query || !text) return html`<span>${text || ''}</span>`;
  const highlighted = highlightMatches(text, query);
  return html`<span dangerouslySetInnerHTML=${{ __html: highlighted }} />`;
}

// ─── Result Card ─────────────────────────────────────────────────────────────

function ResultCard({ result, query, onEdit }) {
  const { entry, highlights } = result;
  const status = getVerificationStatus(entry);
  const catInfo = getCategoryInfo(entry.category);
  const vb = VER_BADGE[status] || VER_BADGE.unverified;

  const contentSnippet = useMemo(() => {
    const contentHighlight = highlights.find(h => h.field === 'content');
    if (contentHighlight) return contentHighlight.text;
    return (entry.content || '').slice(0, 200);
  }, [highlights, entry.content]);

  return html`
    <div onClick=${() => onEdit(entry)}
      class="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer">
      <div class="flex items-start justify-between gap-2 mb-2">
        <h3 class="text-base font-semibold text-navy-900 flex-1">
          <${HighlightedText} text=${entry.title} query=${query} />
        </h3>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <${Badge} color=${catInfo.color}>${catInfo.label}<//>
          <${Badge} color=${vb.color}>${vb.label}<//>
        </div>
      </div>

      ${contentSnippet && html`
        <p class="text-sm text-slate-600 line-clamp-3 mb-2">
          <${HighlightedText} text=${contentSnippet} query=${query} />
        </p>
      `}

      ${entry.tags && entry.tags.length > 0 && html`
        <div class="flex flex-wrap gap-1">
          ${entry.tags.slice(0, 5).map(tag => html`
            <span key=${tag} class="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
              <${HighlightedText} text=${tag} query=${query} />
            </span>
          `)}
          ${entry.tags.length > 5 && html`
            <span class="text-xs text-slate-400">+${entry.tags.length - 5} more</span>
          `}
        </div>
      `}
    </div>
  `;
}

// ─── Filter Sidebar ──────────────────────────────────────────────────────────

function FilterSidebar({ filters, onFilterChange, entryCounts }) {
  const toggle = (group, id) => {
    const current = filters[group] || [];
    const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    onFilterChange({ ...filters, [group]: updated });
  };

  const hasFilters = (filters.categories || []).length > 0
    || (filters.statuses || []).length > 0
    || (filters.priorities || []).length > 0;

  return html`
    <div class="space-y-5">
      ${hasFilters && html`
        <button onClick=${() => onFilterChange({ categories: [], statuses: [], priorities: [] })}
          class="text-xs text-navy-700 hover:text-navy-900 font-medium underline">
          Clear all filters
        </button>
      `}

      <div>
        <h3 class="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Category</h3>
        <div class="space-y-1.5">
          ${CATEGORIES.map(cat => html`
            <label key=${cat.id} class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900">
              <input type="checkbox" checked=${(filters.categories || []).includes(cat.id)}
                onChange=${() => toggle('categories', cat.id)}
                class="w-3.5 h-3.5 rounded border-slate-300 text-navy-600 focus:ring-navy-500" />
              <span class="flex-1">${cat.label}</span>
              <span class="text-xs text-slate-400">${entryCounts.categories[cat.id] || 0}</span>
            </label>
          `)}
        </div>
      </div>

      <div>
        <h3 class="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Verification</h3>
        <div class="space-y-1.5">
          ${VERIFICATION_STATUSES.map(vs => html`
            <label key=${vs.id} class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900">
              <input type="checkbox" checked=${(filters.statuses || []).includes(vs.id)}
                onChange=${() => toggle('statuses', vs.id)}
                class="w-3.5 h-3.5 rounded border-slate-300 text-navy-600 focus:ring-navy-500" />
              <span class="flex-1">${vs.label}</span>
              <span class="text-xs text-slate-400">${entryCounts.statuses[vs.id] || 0}</span>
            </label>
          `)}
        </div>
      </div>

      <div>
        <h3 class="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Priority</h3>
        <div class="space-y-1.5">
          ${PRIORITIES.map(p => html`
            <label key=${p.id} class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900">
              <input type="checkbox" checked=${(filters.priorities || []).includes(p.id)}
                onChange=${() => toggle('priorities', p.id)}
                class="w-3.5 h-3.5 rounded border-slate-300 text-navy-600 focus:ring-navy-500" />
              <span class="flex-1">${p.label}</span>
              <span class="text-xs text-slate-400">${entryCounts.priorities[p.id] || 0}</span>
            </label>
          `)}
        </div>
      </div>
    </div>
  `;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SearchPanel() {
  const { entries, navigate } = useApp();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ categories: [], statuses: [], priorities: [] });
  const inputRef = useRef(null);
  const debouncedQuery = useDebounce(query, 300);

  const index = useMemo(() => buildIndex(entries), [entries]);

  const entryCounts = useMemo(() => {
    const categories = {};
    const statuses = {};
    const priorities = {};
    for (const e of entries) {
      categories[e.category] = (categories[e.category] || 0) + 1;
      statuses[getVerificationStatus(e)] = (statuses[getVerificationStatus(e)] || 0) + 1;
      priorities[e.priority] = (priorities[e.priority] || 0) + 1;
    }
    return { categories, statuses, priorities };
  }, [entries]);

  const results = useMemo(() => {
    let rawResults = search(debouncedQuery, index, entries);
    if (filters.categories.length > 0) {
      const set = new Set(filters.categories);
      rawResults = rawResults.filter(r => set.has(r.entry.category));
    }
    if (filters.statuses.length > 0) {
      const set = new Set(filters.statuses);
      rawResults = rawResults.filter(r => set.has(getVerificationStatus(r.entry)));
    }
    if (filters.priorities.length > 0) {
      const set = new Set(filters.priorities);
      rawResults = rawResults.filter(r => set.has(r.entry.priority));
    }
    return rawResults;
  }, [debouncedQuery, index, entries, filters]);

  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  const handleEdit = useCallback((entry) => { navigate('capture?id=' + entry.id); }, [navigate]);

  const suggestedSearches = ['training', 'SOP', 'inspection', 'budget', 'stakeholder'];

  return html`
    <div class="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
        ${IconSearch({ size: 24 })} Search
      </h1>

      <!-- Search Input -->
      <div class="flex gap-2 items-stretch">
        <div class="relative flex-1">
          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            ${IconSearch({ size: 22 })}
          </div>
          <input ref=${inputRef} type="text" value=${query}
            onChange=${e => setQuery(e.target.value)}
            placeholder="Search your knowledge base..."
            class="w-full pl-12 pr-10 py-3.5 bg-white border border-slate-300 rounded-xl text-base
                   shadow-sm focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500
                   placeholder-slate-400" />
          ${query && html`
            <button onClick=${() => setQuery('')}
              class="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          `}
        </div>
        ${AIService.isAvailable() ? html`
          <button
            onClick=${() => window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { query: query || '' } }))}
            class="px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-sm font-medium
                   hover:bg-purple-100 transition-colors flex items-center gap-2 flex-shrink-0"
            title="Ask the AI assistant"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Ask AI
          </button>
        ` : html`
          <span
            class="px-4 py-2 bg-slate-50 text-slate-400 border border-slate-200 rounded-xl text-sm font-medium
                   flex items-center gap-2 flex-shrink-0 cursor-default"
            title="Set up Firebase in Settings to enable AI"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Ask AI
          </span>
        `}
      </div>

      <!-- Layout -->
      <div class="flex gap-6">
        ${entries.length > 0 && html`
          <div class="hidden md:block w-52 flex-shrink-0">
            <${FilterSidebar} filters=${filters} onFilterChange=${setFilters} entryCounts=${entryCounts} />
          </div>
        `}

        <div class="flex-1 min-w-0">
          ${(() => {
            if (entries.length === 0) {
              return html`
                <${EmptyState}
                  icon=${IconSearch({ size: 48 })}
                  title="No entries yet"
                  description="Add entries to your knowledge base to search across them. Try Guided Setup for a fast start."
                  action=${html`<${Button} onClick=${() => navigate('guided')}>Guided Setup<//>`}
                />
              `;
            }

            if (!debouncedQuery.trim() && filters.categories.length === 0 && filters.statuses.length === 0 && filters.priorities.length === 0) {
              return html`
                <div class="text-center py-12">
                  <div class="text-slate-300 mb-4">${IconSearch({ size: 48, className: 'mx-auto' })}</div>
                  <h3 class="text-lg font-medium text-slate-600 mb-2">Search your knowledge base</h3>
                  <p class="text-sm text-slate-500 mb-4">${entries.length} entries indexed. Try searching for:</p>
                  <div class="flex flex-wrap justify-center gap-2">
                    ${suggestedSearches.map(s => html`
                      <button key=${s} onClick=${() => setQuery(s)}
                        class="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-sm hover:bg-slate-200 transition-colors">
                        ${s}
                      </button>
                    `)}
                  </div>
                </div>
              `;
            }

            if (results.length === 0) {
              return html`
                <div class="text-center py-12">
                  <h3 class="text-lg font-medium text-slate-600 mb-2">
                    No entries match "${debouncedQuery || 'current filters'}"
                  </h3>
                  <p class="text-sm text-slate-500">Try different terms or adjust your filters.</p>
                  ${AIService.isAvailable() && debouncedQuery && html`
                    <button
                      onClick=${() => window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { query: debouncedQuery } }))}
                      class="mt-3 text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors"
                    >
                      Ask the AI assistant →
                    </button>
                  `}
                </div>
              `;
            }

            return html`
              <div class="space-y-4">
                <div class="text-sm text-slate-500 font-medium">
                  ${results.length} result${results.length !== 1 ? 's' : ''}${debouncedQuery ? ' for "' + debouncedQuery + '"' : ''}
                </div>
                ${results.map(result => html`
                  <${ResultCard} key=${result.entry.id} result=${result} query=${debouncedQuery} onEdit=${handleEdit} />
                `)}
              </div>
            `;
          })()}
        </div>
      </div>
    </div>
  `;
}
