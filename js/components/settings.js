// ─── Settings ────────────────────────────────────────────────────────────────
// Billet setup, preferences, AI placeholder, data management, and about.

import { html } from '../core/config.js';
import CONFIG, { VERIFICATION_INTERVAL_DAYS } from '../core/config.js';
import { useApp } from './app.js';
import Store from '../core/store.js';
import { Button, ConfirmDialog, showToast } from '../shared/ui.js';
import { IconWarning } from '../shared/icons.js';

const { useState, useCallback, useMemo } = React;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ─── Settings Icon (inline to avoid name collisions) ─────────────────────────

function SettingsPageIcon({ size = 24 }) {
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  `;
}

// ─── Billet Setup ────────────────────────────────────────────────────────────

function BilletSetup() {
  const { billet, setBillet } = useApp();
  const [form, setForm] = useState({ ...billet });
  const [dirty, setDirty] = useState(false);

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    setBillet(form);
    setDirty(false);
    showToast('Billet information saved', 'success');
  };

  const inputClass = 'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 class="text-lg font-semibold text-navy-900">Billet Setup</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class=${labelClass}>Billet Title</label>
          <input type="text" value=${form.title || ''} onChange=${e => update('title', e.target.value)}
            class=${inputClass} placeholder="e.g., S-3 Operations Officer" />
        </div>
        <div>
          <label class=${labelClass}>Organization / Unit</label>
          <input type="text" value=${form.unit || ''} onChange=${e => update('unit', e.target.value)}
            class=${inputClass} placeholder="e.g., 1st Bn, 5th Marines" />
        </div>
      </div>
      <div>
        <label class=${labelClass}>Mission</label>
        <textarea value=${form.billetDescription || ''} onChange=${e => update('billetDescription', e.target.value)}
          rows="3" class=${inputClass}
          placeholder="Brief description of the billet mission and primary responsibilities..." />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class=${labelClass}>Outgoing PCS / Turnover Date</label>
          <input type="date" value=${form.turnoverDate || ''} onChange=${e => update('turnoverDate', e.target.value)}
            class=${inputClass} />
        </div>
        <div>
          <label class=${labelClass}>Incoming Arrival Date (optional)</label>
          <input type="date" value=${form.incomingDate || ''} onChange=${e => update('incomingDate', e.target.value)}
            class=${inputClass} />
        </div>
      </div>
      <div class="flex justify-end pt-2">
        <${Button} onClick=${handleSave} disabled=${!dirty}>Save Billet Info<//>
      </div>
    </div>
  `;
}

// ─── Preferences ─────────────────────────────────────────────────────────────

function Preferences() {
  const { settings, setSettings } = useApp();
  const [interval, setInterval] = useState(settings.verifyIntervalDays || VERIFICATION_INTERVAL_DAYS);
  const [dirty, setDirty] = useState(false);

  const handleChange = (value) => {
    setInterval(parseInt(value) || VERIFICATION_INTERVAL_DAYS);
    setDirty(true);
  };

  const handleSave = () => {
    setSettings({ ...settings, verifyIntervalDays: interval });
    setDirty(false);
    showToast('Preferences saved', 'success');
  };

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 class="text-lg font-semibold text-navy-900">Preferences</h2>
      <div class="max-w-xs">
        <label class="block text-sm font-medium text-slate-700 mb-1">Verification Interval (days)</label>
        <input type="number" min="1" max="365" value=${interval}
          onChange=${e => handleChange(e.target.value)}
          class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm text-slate-700
                 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500" />
        <p class="text-xs text-slate-500 mt-1">
          Entries flagged "expiring" 30 days before this interval, "stale" after. Default: ${VERIFICATION_INTERVAL_DAYS} days.
        </p>
      </div>
      <div class="flex justify-end pt-2">
        <${Button} onClick=${handleSave} disabled=${!dirty}>Save Preferences<//>
      </div>
    </div>
  `;
}

// ─── AI Configuration (Phase 2 placeholder) ──────────────────────────────────

function AIConfiguration() {
  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-3 opacity-60">
      <h2 class="text-lg font-semibold text-slate-500">AI Configuration</h2>
      <div class="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <p class="text-sm text-slate-500">
          AI features coming in Phase 2. Firebase AI Logic will enable natural language Q&A
          over your knowledge base.
        </p>
      </div>
      <div class="space-y-3 pointer-events-none">
        <div>
          <label class="block text-sm font-medium text-slate-400 mb-1">Firebase Project ID</label>
          <input type="text" disabled placeholder="my-project-id"
            class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-400 cursor-not-allowed" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-400 mb-1">Firebase API Key</label>
          <input type="text" disabled placeholder="AIza..."
            class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-400 cursor-not-allowed" />
        </div>
      </div>
    </div>
  `;
}

// ─── Data Management ─────────────────────────────────────────────────────────

function DataManagement() {
  const { entries } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);
  const storageSize = useMemo(() => Store.getStorageSize(), [entries]);

  const handleClear = useCallback(() => {
    Store.clearAll();
    setConfirmClear(false);
    showToast('All data cleared', 'info');
    window.location.reload();
  }, []);

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 class="text-lg font-semibold text-navy-900">Data Management</h2>
      <div>
        <p class="text-sm text-slate-700 font-medium">Storage Usage</p>
        <p class="text-xs text-slate-500">${formatBytes(storageSize)} of ~5 MB used</p>
        <div class="w-48 h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
          <div class="h-full bg-navy-600 rounded-full transition-all"
            style=${{ width: Math.min((storageSize / (5 * 1024 * 1024)) * 100, 100) + '%' }} />
        </div>
      </div>
      <div class="pt-2 border-t border-slate-200">
        <${Button} variant="danger" onClick=${() => setConfirmClear(true)}>
          ${IconWarning({ size: 16 })} Clear All Data
        <//>
      </div>
      <${ConfirmDialog} isOpen=${confirmClear} onCancel=${() => setConfirmClear(false)} onConfirm=${handleClear}
        title="Clear All Data"
        message="This will permanently delete all entries, narratives, and settings. Export your data first! This action cannot be undone."
        confirmText="Delete Everything" danger=${true} />
    </div>
  `;
}

// ─── About ───────────────────────────────────────────────────────────────────

function About() {
  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 class="text-lg font-semibold text-navy-900">About</h2>
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <span class="text-sm text-slate-700 font-medium">Version</span>
          <span class="text-sm text-slate-500">${CONFIG.VERSION}</span>
        </div>
        <p class="text-sm text-slate-600">
          <strong>Passdown</strong> -- Zero-cost knowledge transfer for military billet turnover.
        </p>
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div class="flex items-start gap-2">
            <div class="flex-shrink-0 mt-0.5">${IconWarning({ size: 18, className: 'text-amber-600' })}</div>
            <div>
              <h3 class="text-sm font-semibold text-amber-800">OPSEC Notice</h3>
              <p class="text-xs text-amber-700 mt-1 leading-relaxed">
                REMINDER: Do not enter classified information, PII (personal names),
                or specific manning numbers. Use billet titles, not personal names.
                Review all entries for OPSEC compliance before sharing or exporting.
              </p>
            </div>
          </div>
        </div>
        <div class="text-xs text-slate-400 pt-2 border-t border-slate-100">
          <p>MIT License -- Free for government and personal use.</p>
          <p class="mt-1">All data is stored locally in your browser. No data is transmitted to external servers.</p>
        </div>
      </div>
    </div>
  `;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Settings() {
  return html`
    <div class="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
        ${SettingsPageIcon({ size: 24 })} Settings
      </h1>
      <${BilletSetup} />
      <${Preferences} />
      <${AIConfiguration} />
      <${DataManagement} />
      <${About} />
    </div>
  `;
}
