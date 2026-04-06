// ─── Print View ──────────────────────────────────────────────────────────────
// Print-optimized rendering of the full knowledge base.

import { html } from '../core/config.js';
import CONFIG, { CATEGORIES } from '../core/config.js';
import { useApp } from './app.js';
import Store from '../core/store.js';
import { Button } from '../shared/ui.js';
import { IconPrinter } from '../shared/icons.js';
import { MarkdownPreview } from '../shared/markdown.js';
import { getVerificationStatus } from '../core/search.js';

const { useMemo } = React;

function formatDate(dateStr) {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function PrintView() {
  const { entries, billet } = useApp();

  const grouped = useMemo(() => {
    const groups = {};
    for (const cat of CATEGORIES) {
      const catEntries = entries.filter(e => e.category === cat.id);
      if (catEntries.length > 0) groups[cat.id] = { category: cat, entries: catEntries };
    }
    return groups;
  }, [entries]);

  const groupKeys = Object.keys(grouped);

  const essentialEntries = useMemo(() =>
    entries.filter(e => e.essentialReading).sort((a, b) => {
      const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2);
    }),
    [entries]
  );

  const PRIORITY_LABELS = { critical: 'CRITICAL', high: 'High', medium: 'Medium', low: 'Low' };
  const PRIORITY_COLORS = { critical: 'text-red-700', high: 'text-orange-700', medium: 'text-slate-600', low: 'text-slate-400' };
  const STATUS_LABELS = { current: 'Verified', expiring: 'Expiring', stale: 'Stale', unverified: 'Unverified' };

  return html`
    <div class="max-w-4xl mx-auto px-4 py-8">
      <!-- Controls (hidden in print) -->
      <div class="no-print flex items-center justify-between mb-6 bg-white border border-slate-200 rounded-lg p-4">
        <${Button} variant="secondary" onClick=${() => { window.location.hash = '#list'; }}>
          Back to App
        <//>
        <${Button} onClick=${() => window.print()}>
          ${IconPrinter({ size: 16 })} Print
        <//>
      </div>

      <div class="print-content">
        <!-- Header -->
        <div class="print-header bg-navy-900 text-white p-6 rounded-lg mb-6">
          <h1 class="text-2xl font-bold">${billet.title || 'Billet Passdown'}</h1>
          ${billet.unit && html`<p class="mt-1 opacity-80">${billet.unit}</p>`}
          <p class="mt-2 text-sm opacity-60">
            Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            ${' | '}${entries.length} entries
            ${' | '}v${CONFIG.VERSION}
          </p>
        </div>

        <!-- Table of Contents -->
        <div class="toc-section bg-white border border-slate-200 rounded-lg p-6 mb-6">
          <h2 class="text-lg font-bold text-navy-900 mb-3">Table of Contents</h2>
          <ol class="list-decimal list-inside space-y-1 text-sm text-slate-700">
            ${groupKeys.map(key => {
              const { category, entries: catEntries } = grouped[key];
              return html`
                <li key=${key}>
                  <strong>${category.label}</strong>
                  <span class="text-slate-400 ml-1">(${catEntries.length} entries)</span>
                </li>
              `;
            })}
          </ol>
        </div>

        <!-- Start Here: Essential Reading -->
        ${essentialEntries.length > 0 && html`
          <div class="essential-section bg-amber-50 border border-amber-300 rounded-lg p-6 mb-6">
            <h2 class="text-lg font-bold text-amber-900 mb-3">Start Here -- Essential Reading</h2>
            <p class="text-sm text-amber-700 mb-4">These entries have been flagged as essential reading for onboarding. Review them first.</p>
            <ol class="list-decimal list-inside space-y-2 text-sm text-slate-700">
              ${essentialEntries.map(entry => {
                const cat = CATEGORIES.find(c => c.id === entry.category);
                return html`
                  <li key=${entry.id}>
                    <strong>${entry.title}</strong>
                    <span class="text-slate-400 ml-1">(${cat ? cat.label : entry.category})</span>
                    ${entry.priority && html`
                      <span class=${'ml-1 ' + (PRIORITY_COLORS[entry.priority] || '')}>[${PRIORITY_LABELS[entry.priority] || entry.priority}]</span>
                    `}
                  </li>
                `;
              })}
            </ol>
          </div>
        `}

        <!-- Entries by Category -->
        ${groupKeys.map((key, idx) => {
          const { category, entries: catEntries } = grouped[key];
          return html`
            <div key=${key} class=${'category-section mb-8 ' + (idx > 0 ? 'print-break' : '')}>
              <h2 class="text-xl font-bold text-navy-900 mb-4 pb-2 border-b-2 border-navy-200">
                ${category.label}
              </h2>
              <div class="space-y-4">
                ${catEntries.map(entry => {
                  const status = getVerificationStatus(entry);
                  return html`
                    <div key=${entry.id} class="entry-card bg-white border border-slate-200 rounded-lg p-4">
                      <div class="flex items-start justify-between mb-2">
                        <div class="flex items-center gap-2">
                          <h3 class="text-base font-semibold text-navy-900">${entry.title}</h3>
                          ${entry.essentialReading && html`
                            <span class="text-xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Essential Reading</span>
                          `}
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0">
                          ${entry.priority && html`
                            <span class=${'text-xs font-medium ' + (PRIORITY_COLORS[entry.priority] || 'text-slate-500')}>
                              ${PRIORITY_LABELS[entry.priority] || entry.priority}
                            </span>
                          `}
                          <span class=${'text-xs ' + (status === 'current' ? 'text-green-600' : status === 'expiring' ? 'text-amber-600' : status === 'stale' ? 'text-red-600' : 'text-slate-400')}>
                            ${STATUS_LABELS[status] || status}
                          </span>
                        </div>
                      </div>
                      ${entry.content && html`
                        <div class="mb-2">
                          <${MarkdownPreview} content=${entry.content} />
                        </div>
                      `}
                      <div class="flex flex-wrap gap-3 text-xs text-slate-500">
                        ${entry.tags && entry.tags.length > 0 && html`
                          <span>Tags: ${entry.tags.join(', ')}</span>
                        `}
                        ${entry.priority && html`
                          <span>Priority: ${PRIORITY_LABELS[entry.priority] || entry.priority}</span>
                        `}
                        <span>Verification: ${STATUS_LABELS[status] || status}</span>
                        ${entry.verifiedAt && html`
                          <span>Last verified: ${formatDate(entry.verifiedAt)}</span>
                        `}
                      </div>
                    </div>
                  `;
                })}
              </div>
            </div>
          `;
        })}

        <!-- OPSEC Footer -->
        <div class="opsec-footer mt-8 pt-4 border-t border-slate-300 text-center text-xs text-slate-500">
          OPSEC NOTICE: Review all content for classification and operational sensitivity before distribution.
        </div>
      </div>
    </div>
  `;
}
