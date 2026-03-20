// ─── Export / Import ─────────────────────────────────────────────────────────
// Full export, import (replace/merge), and template loading.

import { html } from '../core/config.js';
import CONFIG, { CATEGORIES } from '../core/config.js';
import { useApp } from './app.js';
import Store from '../core/store.js';
import { Button, Modal, ConfirmDialog, showToast } from '../shared/ui.js';
import { IconDownload, IconPrinter } from '../shared/icons.js';

const { useState, useCallback, useMemo, useEffect, useRef } = React;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(dateStr) {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function sanitizeFilename(str) {
  return (str || 'untitled').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

function getCategoryLabel(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.label : categoryId;
}

// ─── Default Templates ───────────────────────────────────────────────────────

const DEFAULT_TEMPLATES = [
  {
    id: 'basic-billet',
    name: 'Basic Billet Template',
    description: 'Starter entries: key processes, stakeholders, and calendar events.',
    entries: [
      { title: 'Morning Report Process', category: 'process', content: 'Describe the daily morning report procedure:\n- Who needs to be notified\n- What data to collect\n- Submission timeline\n- System/portal used', priority: 'high', tags: ['daily', 'report'] },
      { title: 'Weekly Staff Meeting', category: 'calendar', content: 'Document the weekly staff meeting including agenda preparation and minutes distribution.', priority: 'medium', tags: ['weekly', 'meeting'], meta: { recurrence: 'weekly', months: [1,2,3,4,5,6,7,8,9,10,11,12] } },
      { title: 'Higher HQ POC', category: 'stakeholder', content: 'Primary point of contact at higher headquarters for taskers and reporting.', priority: 'high', tags: ['HQ', 'tasker'], meta: { frequency: 'weekly', org: 'Higher HQ' } },
      { title: 'Adjacent Unit POC', category: 'stakeholder', content: 'Lateral coordination contact for adjacent unit operations.', priority: 'medium', tags: ['coordination'], meta: { frequency: 'monthly', org: 'Adjacent Unit' } },
      { title: 'Annual Training Plan', category: 'calendar', content: 'Unit annual training plan milestones and submission requirements.', priority: 'high', tags: ['training', 'annual'], meta: { recurrence: 'annual', months: [10], prepLeadDays: 30 } },
    ],
  },
  {
    id: 'staff-officer',
    name: 'Staff Officer Template',
    description: 'Template for S-shop or staff officer billets.',
    entries: [
      { title: 'Battle Rhythm', category: 'process', content: 'Document the unit battle rhythm:\n- Daily syncs\n- Weekly meetings\n- Monthly reviews\n- Quarterly assessments', priority: 'high', tags: ['battle-rhythm'] },
      { title: 'Commander Update Brief', category: 'calendar', content: 'Preparation and delivery of the Commander Update Brief.', priority: 'high', tags: ['CUB', 'brief'], meta: { recurrence: 'weekly', months: [1,2,3,4,5,6,7,8,9,10,11,12], prepLeadDays: 2 } },
      { title: 'Leave/Liberty Policy', category: 'process', content: 'Outline the current leave and liberty policy, approval chain, and standing restrictions.', priority: 'medium', tags: ['leave', 'policy'] },
      { title: 'Supply Chain POC', category: 'stakeholder', content: 'Supply and logistics coordination point of contact.', priority: 'medium', tags: ['supply'], meta: { frequency: 'weekly', org: 'S-4 / Logistics' } },
      { title: 'Annual Inspection Prep', category: 'calendar', content: 'CG/IG inspection preparation timeline and requirements.', priority: 'high', tags: ['inspection'], meta: { recurrence: 'annual', months: [3], prepLeadDays: 60 } },
    ],
  },
];

// ─── Export Section ──────────────────────────────────────────────────────────

function ExportSection() {
  const { entries, billet } = useApp();
  const [lastExport, setLastExport] = useState(() => {
    try { return localStorage.getItem('passdown_last_export'); } catch { return null; }
  });
  const storageSize = useMemo(() => Store.getStorageSize(), [entries]);

  const handleExportJSON = useCallback(() => {
    const data = Store.exportAll();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const billetSlug = sanitizeFilename(billet.title || 'knowledge-base');
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'passdown_' + billetSlug + '_' + dateStr + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const now = new Date().toISOString();
    localStorage.setItem('passdown_last_export', now);
    setLastExport(now);
    showToast('Knowledge base exported', 'success');
  }, [billet]);

  const handleExportPrint = useCallback(() => {
    window.location.hash = '#print';
  }, []);

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 class="text-lg font-semibold text-navy-900">Export</h2>
      <div class="flex flex-wrap gap-3">
        <${Button} onClick=${handleExportJSON}>${IconDownload({ size: 16 })} Export Knowledge Base<//>
        <${Button} variant="secondary" onClick=${handleExportPrint}>${IconPrinter({ size: 16 })} Export for Print<//>
      </div>
      <div class="flex flex-wrap gap-6 text-xs text-slate-500">
        ${lastExport && html`<span>Last export: ${formatDate(lastExport)}</span>`}
        <span>Storage used: ${formatBytes(storageSize)} of ~5 MB</span>
      </div>
    </div>
  `;
}

// ─── Import Section ──────────────────────────────────────────────────────────

function ImportSection() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState('merge');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef(null);

  const handleFileChange = useCallback((e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object') throw new Error('Invalid data');
        const entryCount = Array.isArray(data.entries) ? data.entries.length : 0;
        const narrativeCount = Array.isArray(data.narratives) ? data.narratives.length : 0;
        const categories = {};
        if (Array.isArray(data.entries)) {
          for (const entry of data.entries) categories[entry.category || 'unknown'] = (categories[entry.category || 'unknown'] || 0) + 1;
        }
        setPreview({ data, entryCount, narrativeCount, categories, version: data.version || 'unknown', exportedAt: data.exportedAt });
      } catch (err) {
        showToast('Invalid JSON file: ' + err.message, 'error');
        setFile(null); setPreview(null);
      }
    };
    reader.readAsText(f);
  }, []);

  const handleImport = useCallback(() => {
    if (!preview) return;
    try {
      Store.importAll(preview.data, mode);
      showToast('Import complete (' + mode + ' mode)', 'success');
      setFile(null); setPreview(null); setConfirmOpen(false);
      if (fileRef.current) fileRef.current.value = '';
      window.location.reload();
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    }
  }, [preview, mode]);

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 class="text-lg font-semibold text-navy-900">Import</h2>
      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Select File</label>
          <input ref=${fileRef} type="file" accept=".json" onChange=${handleFileChange}
            class="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
                   file:text-sm file:font-medium file:bg-navy-50 file:text-navy-700 hover:file:bg-navy-100 file:cursor-pointer cursor-pointer" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Import Mode</label>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="radio" name="importMode" value="merge" checked=${mode === 'merge'} onChange=${() => setMode('merge')}
                class="text-navy-600 focus:ring-navy-500" />
              <span><strong>Merge</strong> -- Add new, update existing</span>
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="radio" name="importMode" value="replace" checked=${mode === 'replace'} onChange=${() => setMode('replace')}
                class="text-navy-600 focus:ring-navy-500" />
              <span><strong>Replace All</strong></span>
            </label>
          </div>
        </div>
      </div>

      ${preview && html`
        <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
          <h3 class="text-sm font-semibold text-slate-700">Preview</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600">
            <div><span class="font-medium">${preview.entryCount}</span> entries</div>
            <div><span class="font-medium">${preview.narrativeCount}</span> narratives</div>
            <div>Version: <span class="font-medium">${preview.version}</span></div>
            ${preview.exportedAt && html`<div>Exported: <span class="font-medium">${formatDate(preview.exportedAt)}</span></div>`}
          </div>
          ${Object.keys(preview.categories).length > 0 && html`
            <div class="flex flex-wrap gap-2 pt-1">
              ${Object.entries(preview.categories).map(([cat, count]) => html`
                <span key=${cat} class="text-xs px-2 py-0.5 bg-white border border-slate-200 rounded">
                  ${getCategoryLabel(cat)}: ${count}
                </span>
              `)}
            </div>
          `}
          ${mode === 'replace' && html`
            <p class="text-xs text-red-600 font-medium pt-1">Warning: Replace mode will overwrite all existing data.</p>
          `}
        </div>
        <${Button} onClick=${() => setConfirmOpen(true)}>Apply Import<//>
      `}

      <${ConfirmDialog} isOpen=${confirmOpen} onCancel=${() => setConfirmOpen(false)} onConfirm=${handleImport}
        title="Confirm Import"
        message=${mode === 'replace'
          ? 'This will REPLACE all existing data. This cannot be undone. Continue?'
          : 'This will MERGE imported data with existing entries. Continue?'}
        confirmText="Apply Import" danger=${mode === 'replace'} />
    </div>
  `;
}

// ─── Templates Section ───────────────────────────────────────────────────────

function TemplatesSection() {
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [confirmTemplate, setConfirmTemplate] = useState(null);

  useEffect(() => {
    fetch('./data/templates/index.json')
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(data => { if (Array.isArray(data) && data.length > 0) setTemplates(data); })
      .catch(() => {});
  }, []);

  const handleLoadTemplate = useCallback((template) => {
    try {
      for (const entry of template.entries) {
        Store.addEntry({ ...entry, tags: entry.tags || [], meta: entry.meta || {} });
      }
      showToast(template.entries.length + ' entries added from template', 'success');
      setConfirmTemplate(null);
      window.location.reload();
    } catch (err) {
      showToast('Failed to load template: ' + err.message, 'error');
    }
  }, []);

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 class="text-lg font-semibold text-navy-900">Templates</h2>
      <p class="text-sm text-slate-500">Load a pre-built template to populate your knowledge base.</p>
      <div class="space-y-3">
        ${templates.map(template => html`
          <div key=${template.id} class="border border-slate-200 rounded-lg p-4 space-y-2">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="text-sm font-semibold text-navy-900">${template.name}</h3>
                <p class="text-xs text-slate-500 mt-0.5">${template.description}</p>
                <span class="text-xs text-slate-400 mt-1 inline-block">${template.entries.length} entries</span>
              </div>
              <div class="flex gap-2 flex-shrink-0">
                <${Button} variant="ghost" size="sm" onClick=${() => setPreviewTemplate(template)}>Preview<//>
                <${Button} variant="secondary" size="sm" onClick=${() => setConfirmTemplate(template)}>Load<//>
              </div>
            </div>
          </div>
        `)}
      </div>

      <${Modal} isOpen=${previewTemplate != null} onClose=${() => setPreviewTemplate(null)}
        title=${previewTemplate ? previewTemplate.name : ''} size="lg">
        ${previewTemplate && html`
          <div class="space-y-3">
            <p class="text-sm text-slate-500">${previewTemplate.description}</p>
            <div class="divide-y divide-slate-100">
              ${previewTemplate.entries.map((entry, i) => html`
                <div key=${i} class="py-3">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-navy-900">${entry.title}</span>
                    <span class="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">${getCategoryLabel(entry.category)}</span>
                  </div>
                  <p class="text-xs text-slate-500 mt-1">${entry.content.slice(0, 200)}</p>
                </div>
              `)}
            </div>
          </div>
        `}
      <//>

      <${ConfirmDialog} isOpen=${confirmTemplate != null} onCancel=${() => setConfirmTemplate(null)}
        onConfirm=${() => handleLoadTemplate(confirmTemplate)}
        title="Load Template"
        message=${'This will add ' + (confirmTemplate ? confirmTemplate.entries.length : 0) + ' template entries. Existing entries will not be affected.'}
        confirmText="Load Template" />
    </div>
  `;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ExportImport() {
  return html`
    <div class="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
        ${IconDownload({ size: 24 })} Export / Import
      </h1>
      <${ExportSection} />
      <${ImportSection} />
      <${TemplatesSection} />
    </div>
  `;
}
