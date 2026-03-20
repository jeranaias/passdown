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
                        <h3 class="text-base font-semibold text-navy-900">${entry.title}</h3>
                        <span class="text-xs text-slate-500">${status}</span>
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
