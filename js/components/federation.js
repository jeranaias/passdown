// ─── Federation ──────────────────────────────────────────────────────────────
// Cross-unit template sharing: publish, gallery, and diff/merge.

import { html } from '../core/config.js';
import CONFIG, { CATEGORIES } from '../core/config.js';
import { useApp } from './app.js';
import Store from '../core/store.js';
import { Button, Modal, ConfirmDialog, Badge, Card, showToast } from '../shared/ui.js';
import { IconDownload, IconUpload, IconEye, IconCheck, IconX, IconExternalLink } from '../shared/icons.js';

const { useState, useCallback, useMemo, useEffect, useRef } = React;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCategoryLabel(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.label : categoryId;
}

function getCategoryColor(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.color : 'gray';
}

function sanitizeFilename(str) {
  return (str || 'untitled').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

function countByCategory(entries) {
  const counts = {};
  for (const e of entries) {
    const cat = e.category || 'unknown';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return counts;
}

function stripBilletSpecificData(entry) {
  const stripped = { ...entry };
  // Remove IDs and timestamps -- these will be regenerated on import
  delete stripped.id;
  delete stripped.createdAt;
  delete stripped.updatedAt;
  delete stripped.verifiedAt;

  // Strip contact info / PII fields from stakeholder meta
  if (stripped.meta) {
    const cleanMeta = { ...stripped.meta };
    delete cleanMeta.email;
    delete cleanMeta.phone;
    delete cleanMeta.dsn;
    delete cleanMeta.contactName;
    stripped.meta = cleanMeta;
  }

  // Generalize specific date references in content
  // (keep structure but remove things that look like specific names/dates)
  return stripped;
}

// ─── Publish Template Section ────────────────────────────────────────────────

function PublishSection() {
  const { entries, billet } = useApp();
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const strippedEntries = useMemo(() => entries.map(stripBilletSpecificData), [entries]);
  const categoryBreakdown = useMemo(() => countByCategory(entries), [entries]);
  const categoriesCovered = useMemo(() => Object.keys(categoryBreakdown).length, [categoryBreakdown]);

  const handlePublish = useCallback(() => {
    if (!templateName.trim()) {
      showToast('Please enter a template name', 'warning');
      return;
    }

    const templateData = {
      templateVersion: '1.0',
      type: 'passdown-template',
      name: templateName.trim(),
      description: templateDesc.trim() || 'Passdown knowledge base template',
      createdAt: new Date().toISOString(),
      sourceUnit: billet.unit || 'Unknown Unit',
      sourceBillet: billet.title || 'Unknown Billet',
      entryCount: strippedEntries.length,
      categories: categoryBreakdown,
      entries: strippedEntries,
    };

    const json = JSON.stringify(templateData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const slug = sanitizeFilename(templateName);
    const a = document.createElement('a');
    a.href = url;
    a.download = `passdown-template-${slug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Template published and downloaded', 'success');
  }, [templateName, templateDesc, strippedEntries, categoryBreakdown, billet]);

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 class="text-lg font-semibold text-navy-900 flex items-center gap-2">
        ${IconUpload({ size: 20 })} Publish as Template
      </h2>
      <p class="text-sm text-slate-500">
        Strip billet-specific data (contacts, PII, dates) from your knowledge base and export
        it as a reusable template that other billets can adopt.
      </p>

      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Template Name</label>
          <input
            type="text"
            value=${templateName}
            onInput=${(e) => setTemplateName(e.target.value)}
            placeholder="e.g., S-3 Operations Officer"
            class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                   text-slate-700 placeholder-slate-400
                   focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            value=${templateDesc}
            onInput=${(e) => setTemplateDesc(e.target.value)}
            placeholder="Brief description of what this template covers..."
            rows="2"
            class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                   text-slate-700 placeholder-slate-400 resize-y
                   focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
          />
        </div>
      </div>

      <!-- Preview stats -->
      <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-700">Template Preview</h3>
          <${Button} variant="ghost" size="sm" onClick=${() => setShowPreview(true)}>
            ${IconEye({ size: 14 })} View Entries
          <//>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-600">
          <div><span class="font-medium">${entries.length}</span> entries</div>
          <div><span class="font-medium">${categoriesCovered}</span> categories</div>
          <div><span class="font-medium">${CATEGORIES.length - categoriesCovered}</span> empty categories</div>
        </div>
        <div class="flex flex-wrap gap-2 pt-1">
          ${Object.entries(categoryBreakdown).map(([cat, count]) => html`
            <${Badge} key=${cat} color=${getCategoryColor(cat)}>
              ${getCategoryLabel(cat)}: ${count}
            <//>
          `)}
        </div>
      </div>

      <${Button} onClick=${handlePublish} disabled=${entries.length === 0}>
        ${IconDownload({ size: 16 })} Download Template
      <//>
      ${entries.length === 0 && html`
        <p class="text-xs text-slate-400">Add entries to your knowledge base before publishing a template.</p>
      `}

      <${Modal} isOpen=${showPreview} onClose=${() => setShowPreview(false)}
        title="Template Entry Preview" size="lg">
        <div class="space-y-1 divide-y divide-slate-100">
          ${strippedEntries.map((entry, i) => html`
            <div key=${i} class="py-2.5 flex items-center gap-3">
              <${Badge} color=${getCategoryColor(entry.category)}>
                ${getCategoryLabel(entry.category)}
              <//>
              <span class="text-sm text-navy-900 font-medium">${entry.title}</span>
              ${entry.tags && entry.tags.length > 0 && html`
                <span class="text-xs text-slate-400 ml-auto">${entry.tags.join(', ')}</span>
              `}
            </div>
          `)}
          ${strippedEntries.length === 0 && html`
            <p class="text-sm text-slate-400 py-4 text-center">No entries to preview.</p>
          `}
        </div>
      <//>
    </div>
  `;
}

// ─── Template Gallery Section ────────────────────────────────────────────────

function GallerySection() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [confirmTemplate, setConfirmTemplate] = useState(null);
  const [loadedFile, setLoadedFile] = useState(null);
  const fileRef = useRef(null);

  // Load templates from data/templates/ directory
  useEffect(() => {
    setLoading(true);
    fetch('./data/templates/index.json')
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setTemplates(data);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, []);

  const handleFileLoad = useCallback((e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.type !== 'passdown-template' || !Array.isArray(data.entries)) {
          showToast('Invalid template file. Expected a Passdown template.', 'error');
          return;
        }
        setLoadedFile(data);
        showToast(`Loaded "${data.name}" with ${data.entries.length} entries`, 'info');
      } catch (err) {
        showToast('Failed to parse template: ' + err.message, 'error');
      }
    };
    reader.readAsText(f);
  }, []);

  const handleImportTemplate = useCallback((template) => {
    try {
      const entries = template.entries || [];
      for (const entry of entries) {
        Store.addEntry({
          ...entry,
          tags: entry.tags || [],
          meta: entry.meta || {},
        });
      }
      showToast(`${entries.length} entries added from "${template.name}"`, 'success');
      setConfirmTemplate(null);
      setLoadedFile(null);
      if (fileRef.current) fileRef.current.value = '';
      window.location.reload();
    } catch (err) {
      showToast('Failed to load template: ' + err.message, 'error');
    }
  }, []);

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 class="text-lg font-semibold text-navy-900 flex items-center gap-2">
        ${IconExternalLink({ size: 20 })} Template Gallery
      </h2>
      <p class="text-sm text-slate-500">
        Load a shared template from another unit or billet to jumpstart your knowledge base.
      </p>

      <!-- Load from file -->
      <div class="border border-dashed border-slate-300 rounded-lg p-4 space-y-3">
        <label class="block text-sm font-medium text-slate-700">Load Template File</label>
        <input ref=${fileRef} type="file" accept=".json" onChange=${handleFileLoad}
          class="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
                 file:text-sm file:font-medium file:bg-navy-50 file:text-navy-700 hover:file:bg-navy-100 file:cursor-pointer cursor-pointer" />

        ${loadedFile && html`
          <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="text-sm font-semibold text-navy-900">${loadedFile.name}</h3>
                <p class="text-xs text-slate-500 mt-0.5">${loadedFile.description}</p>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="text-xs text-slate-400">${loadedFile.entryCount || loadedFile.entries.length} entries</span>
                  ${loadedFile.sourceUnit && html`
                    <span class="text-xs text-slate-400">from ${loadedFile.sourceUnit}</span>
                  `}
                </div>
              </div>
              <div class="flex gap-2 flex-shrink-0">
                <${Button} variant="ghost" size="sm" onClick=${() => setPreviewTemplate(loadedFile)}>Preview<//>
                <${Button} variant="secondary" size="sm" onClick=${() => setConfirmTemplate(loadedFile)}>Load<//>
              </div>
            </div>
            ${loadedFile.categories && html`
              <div class="flex flex-wrap gap-1.5 pt-1">
                ${Object.entries(loadedFile.categories).map(([cat, count]) => html`
                  <${Badge} key=${cat} color=${getCategoryColor(cat)}>
                    ${getCategoryLabel(cat)}: ${count}
                  <//>
                `)}
              </div>
            `}
          </div>
        `}
      </div>

      <!-- Built-in / remote templates -->
      ${loading && html`
        <div class="flex items-center gap-2 text-sm text-slate-400 py-4">
          <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading templates...
        </div>
      `}

      ${!loading && templates.length > 0 && html`
        <div class="space-y-3">
          <h3 class="text-sm font-medium text-slate-700">Available Templates</h3>
          ${templates.map(template => html`
            <div key=${template.id || template.name} class="border border-slate-200 rounded-lg p-4">
              <div class="flex items-start justify-between">
                <div>
                  <h4 class="text-sm font-semibold text-navy-900">${template.name}</h4>
                  <p class="text-xs text-slate-500 mt-0.5">${template.description}</p>
                  <span class="text-xs text-slate-400 mt-1 inline-block">
                    ${(template.entries || []).length} entries
                  </span>
                </div>
                <div class="flex gap-2 flex-shrink-0">
                  <${Button} variant="ghost" size="sm" onClick=${() => setPreviewTemplate(template)}>Preview<//>
                  <${Button} variant="secondary" size="sm" onClick=${() => setConfirmTemplate(template)}>Load<//>
                </div>
              </div>
            </div>
          `)}
        </div>
      `}

      ${!loading && templates.length === 0 && html`
        <p class="text-sm text-slate-400 py-2">No remote templates available. Load a template file above.</p>
      `}

      <!-- Preview Modal -->
      <${Modal} isOpen=${previewTemplate != null} onClose=${() => setPreviewTemplate(null)}
        title=${previewTemplate ? previewTemplate.name : ''} size="lg">
        ${previewTemplate && html`
          <div class="space-y-3">
            <p class="text-sm text-slate-500">${previewTemplate.description}</p>
            <div class="divide-y divide-slate-100">
              ${(previewTemplate.entries || []).map((entry, i) => html`
                <div key=${i} class="py-3">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-navy-900">${entry.title}</span>
                    <${Badge} color=${getCategoryColor(entry.category)}>
                      ${getCategoryLabel(entry.category)}
                    <//>
                  </div>
                  <p class="text-xs text-slate-500 mt-1">${(entry.content || '').slice(0, 200)}</p>
                </div>
              `)}
            </div>
          </div>
        `}
      <//>

      <!-- Confirm Dialog -->
      <${ConfirmDialog}
        isOpen=${confirmTemplate != null}
        onCancel=${() => setConfirmTemplate(null)}
        onConfirm=${() => handleImportTemplate(confirmTemplate)}
        title="Load Template"
        message=${'This will add ' + (confirmTemplate ? (confirmTemplate.entries || []).length : 0) + ' template entries to your knowledge base. Existing entries will not be affected.'}
        confirmText="Load Template"
      />
    </div>
  `;
}

// ─── Diff / Merge Section ────────────────────────────────────────────────────

function DiffMergeSection() {
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);
  const [diffResult, setDiffResult] = useState(null);
  const [selectedEntries, setSelectedEntries] = useState(new Set());
  const [confirmMerge, setConfirmMerge] = useState(false);
  const fileRefA = useRef(null);
  const fileRefB = useRef(null);

  const loadFile = useCallback((file, setter, nameSetter) => {
    if (!file) return;
    nameSetter(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.entries)) {
          showToast('Invalid Passdown export file', 'error');
          return;
        }
        setter(data);
      } catch (err) {
        showToast('Failed to parse file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleFileA = useCallback((e) => {
    loadFile(e.target.files[0], setDataA, (name) => setFileA(name));
  }, [loadFile]);

  const handleFileB = useCallback((e) => {
    loadFile(e.target.files[0], setDataB, (name) => setFileB(name));
  }, [loadFile]);

  // Compute diff when both files are loaded
  useEffect(() => {
    if (!dataA || !dataB) { setDiffResult(null); return; }

    const titlesA = new Map(dataA.entries.map(e => [e.title.trim().toLowerCase(), e]));
    const titlesB = new Map(dataB.entries.map(e => [e.title.trim().toLowerCase(), e]));

    const onlyA = [];
    const onlyB = [];
    const both = [];

    for (const [key, entry] of titlesA) {
      if (titlesB.has(key)) {
        both.push({ titleKey: key, a: entry, b: titlesB.get(key) });
      } else {
        onlyA.push(entry);
      }
    }

    for (const [key, entry] of titlesB) {
      if (!titlesA.has(key)) {
        onlyB.push(entry);
      }
    }

    setDiffResult({ onlyA, onlyB, both });
    setSelectedEntries(new Set());
  }, [dataA, dataB]);

  const toggleSelection = useCallback((key) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAllInGroup = useCallback((entries, prefix) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      for (let i = 0; i < entries.length; i++) {
        next.add(prefix + '-' + i);
      }
      return next;
    });
  }, []);

  const handleMerge = useCallback(() => {
    if (!diffResult) return;
    let count = 0;

    // Add selected entries from "only in A"
    diffResult.onlyA.forEach((entry, i) => {
      if (selectedEntries.has('a-' + i)) {
        Store.addEntry({ ...entry, id: undefined, tags: entry.tags || [], meta: entry.meta || {} });
        count++;
      }
    });

    // Add selected entries from "only in B"
    diffResult.onlyB.forEach((entry, i) => {
      if (selectedEntries.has('b-' + i)) {
        Store.addEntry({ ...entry, id: undefined, tags: entry.tags || [], meta: entry.meta || {} });
        count++;
      }
    });

    // Add selected entries from "in both" (use whichever version was selected)
    diffResult.both.forEach((pair, i) => {
      if (selectedEntries.has('both-a-' + i)) {
        Store.addEntry({ ...pair.a, id: undefined, tags: pair.a.tags || [], meta: pair.a.meta || {} });
        count++;
      } else if (selectedEntries.has('both-b-' + i)) {
        Store.addEntry({ ...pair.b, id: undefined, tags: pair.b.tags || [], meta: pair.b.meta || {} });
        count++;
      }
    });

    if (count === 0) {
      showToast('No entries selected to merge', 'warning');
    } else {
      showToast(`Merged ${count} entries into your knowledge base`, 'success');
      setConfirmMerge(false);
      window.location.reload();
    }
  }, [diffResult, selectedEntries]);

  const handleReset = useCallback(() => {
    setFileA(null); setFileB(null);
    setDataA(null); setDataB(null);
    setDiffResult(null);
    setSelectedEntries(new Set());
    if (fileRefA.current) fileRefA.current.value = '';
    if (fileRefB.current) fileRefB.current.value = '';
  }, []);

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 class="text-lg font-semibold text-navy-900 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 3h5v5" /><path d="M8 3H3v5" />
          <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
          <path d="m15 9 6-6" />
        </svg>
        Compare & Merge
      </h2>
      <p class="text-sm text-slate-500">
        Upload two Passdown export files to compare them side-by-side. Pick entries from either
        to merge into your current knowledge base.
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">File A</label>
          <input ref=${fileRefA} type="file" accept=".json" onChange=${handleFileA}
            class="block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0
                   file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer cursor-pointer" />
          ${dataA && html`
            <p class="text-xs text-slate-400 mt-1">${dataA.entries.length} entries loaded</p>
          `}
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">File B</label>
          <input ref=${fileRefB} type="file" accept=".json" onChange=${handleFileB}
            class="block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0
                   file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100 file:cursor-pointer cursor-pointer" />
          ${dataB && html`
            <p class="text-xs text-slate-400 mt-1">${dataB.entries.length} entries loaded</p>
          `}
        </div>
      </div>

      ${diffResult && html`
        <div class="space-y-4 pt-2">
          <!-- Summary -->
          <div class="grid grid-cols-3 gap-3 text-center">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div class="text-lg font-bold text-blue-700">${diffResult.onlyA.length}</div>
              <div class="text-xs text-blue-600">Only in A</div>
            </div>
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div class="text-lg font-bold text-amber-700">${diffResult.both.length}</div>
              <div class="text-xs text-amber-600">In Both</div>
            </div>
            <div class="bg-green-50 border border-green-200 rounded-lg p-3">
              <div class="text-lg font-bold text-green-700">${diffResult.onlyB.length}</div>
              <div class="text-xs text-green-600">Only in B</div>
            </div>
          </div>

          <!-- Only in A -->
          ${diffResult.onlyA.length > 0 && html`
            <div class="border border-blue-200 rounded-lg overflow-hidden">
              <div class="bg-blue-50 px-4 py-2 flex items-center justify-between">
                <h3 class="text-sm font-semibold text-blue-800">Only in File A (${diffResult.onlyA.length})</h3>
                <button onClick=${() => selectAllInGroup(diffResult.onlyA, 'a')}
                  class="text-xs text-blue-600 hover:text-blue-800 font-medium">Select All</button>
              </div>
              <div class="divide-y divide-blue-100">
                ${diffResult.onlyA.map((entry, i) => {
                  const key = 'a-' + i;
                  const selected = selectedEntries.has(key);
                  return html`
                    <label key=${key}
                      class=${'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ' + (selected ? 'bg-blue-50/50' : 'hover:bg-slate-50')}>
                      <input type="checkbox" checked=${selected} onChange=${() => toggleSelection(key)}
                        class="rounded border-slate-300 text-navy-600 focus:ring-navy-500" />
                      <${Badge} color=${getCategoryColor(entry.category)}>
                        ${getCategoryLabel(entry.category)}
                      <//>
                      <span class="text-sm text-navy-900">${entry.title}</span>
                    </label>
                  `;
                })}
              </div>
            </div>
          `}

          <!-- Only in B -->
          ${diffResult.onlyB.length > 0 && html`
            <div class="border border-green-200 rounded-lg overflow-hidden">
              <div class="bg-green-50 px-4 py-2 flex items-center justify-between">
                <h3 class="text-sm font-semibold text-green-800">Only in File B (${diffResult.onlyB.length})</h3>
                <button onClick=${() => selectAllInGroup(diffResult.onlyB, 'b')}
                  class="text-xs text-green-600 hover:text-green-800 font-medium">Select All</button>
              </div>
              <div class="divide-y divide-green-100">
                ${diffResult.onlyB.map((entry, i) => {
                  const key = 'b-' + i;
                  const selected = selectedEntries.has(key);
                  return html`
                    <label key=${key}
                      class=${'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ' + (selected ? 'bg-green-50/50' : 'hover:bg-slate-50')}>
                      <input type="checkbox" checked=${selected} onChange=${() => toggleSelection(key)}
                        class="rounded border-slate-300 text-navy-600 focus:ring-navy-500" />
                      <${Badge} color=${getCategoryColor(entry.category)}>
                        ${getCategoryLabel(entry.category)}
                      <//>
                      <span class="text-sm text-navy-900">${entry.title}</span>
                    </label>
                  `;
                })}
              </div>
            </div>
          `}

          <!-- In Both (changed) -->
          ${diffResult.both.length > 0 && html`
            <div class="border border-amber-200 rounded-lg overflow-hidden">
              <div class="bg-amber-50 px-4 py-2">
                <h3 class="text-sm font-semibold text-amber-800">In Both Files (${diffResult.both.length})</h3>
                <p class="text-xs text-amber-600 mt-0.5">Select a version to import, or skip to keep your current data.</p>
              </div>
              <div class="divide-y divide-amber-100">
                ${diffResult.both.map((pair, i) => {
                  const keyA = 'both-a-' + i;
                  const keyB = 'both-b-' + i;
                  const selA = selectedEntries.has(keyA);
                  const selB = selectedEntries.has(keyB);
                  const contentChanged = (pair.a.content || '') !== (pair.b.content || '');
                  return html`
                    <div key=${i} class="px-4 py-3 space-y-2">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium text-navy-900">${pair.a.title}</span>
                        <${Badge} color=${getCategoryColor(pair.a.category)}>
                          ${getCategoryLabel(pair.a.category)}
                        <//>
                        ${contentChanged && html`
                          <${Badge} color="yellow">Content differs<//>
                        `}
                        ${!contentChanged && html`
                          <${Badge} color="gray">Identical<//>
                        `}
                      </div>
                      ${contentChanged && html`
                        <div class="grid grid-cols-2 gap-2">
                          <label class=${'flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors text-xs '
                            + (selA ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300')}>
                            <input type="radio" name=${'both-' + i} checked=${selA}
                              onChange=${() => {
                                setSelectedEntries(prev => {
                                  const next = new Set(prev);
                                  next.delete(keyB);
                                  next.add(keyA);
                                  return next;
                                });
                              }}
                              class="mt-0.5 text-navy-600 focus:ring-navy-500" />
                            <div>
                              <span class="font-medium text-blue-700">Version A</span>
                              <p class="text-slate-500 mt-0.5">${(pair.a.content || '').slice(0, 120)}...</p>
                            </div>
                          </label>
                          <label class=${'flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors text-xs '
                            + (selB ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-slate-300')}>
                            <input type="radio" name=${'both-' + i} checked=${selB}
                              onChange=${() => {
                                setSelectedEntries(prev => {
                                  const next = new Set(prev);
                                  next.delete(keyA);
                                  next.add(keyB);
                                  return next;
                                });
                              }}
                              class="mt-0.5 text-navy-600 focus:ring-navy-500" />
                            <div>
                              <span class="font-medium text-green-700">Version B</span>
                              <p class="text-slate-500 mt-0.5">${(pair.b.content || '').slice(0, 120)}...</p>
                            </div>
                          </label>
                        </div>
                      `}
                    </div>
                  `;
                })}
              </div>
            </div>
          `}

          <!-- Actions -->
          <div class="flex items-center gap-3 pt-2">
            <${Button} onClick=${() => setConfirmMerge(true)} disabled=${selectedEntries.size === 0}>
              ${IconCheck({ size: 16 })} Merge Selected (${selectedEntries.size})
            <//>
            <${Button} variant="secondary" onClick=${handleReset}>
              Reset
            <//>
          </div>
        </div>
      `}

      <${ConfirmDialog}
        isOpen=${confirmMerge}
        onCancel=${() => setConfirmMerge(false)}
        onConfirm=${handleMerge}
        title="Merge Selected Entries"
        message=${'This will add ' + selectedEntries.size + ' selected entries to your current knowledge base. Existing entries will not be modified.'}
        confirmText="Merge Entries"
      />
    </div>
  `;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Federation() {
  return html`
    <div class="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
        ${IconExternalLink({ size: 24 })} Federation
      </h1>
      <p class="text-sm text-slate-500">
        Share knowledge base templates across units and compare exports to stay in sync.
      </p>
      <${PublishSection} />
      <${GallerySection} />
      <${DiffMergeSection} />
    </div>
  `;
}
