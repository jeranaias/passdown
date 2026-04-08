// ─── Functional Area Checklist ──────────────────────────────────────────────
// Structured checklist of key functional areas for complete billet turnover.
// Items auto-check when a related KB entry exists (matched by tags/title keywords).
// Manual overrides persist to localStorage.

import { html } from '../core/config.js';
import { useApp } from './app.js';
import { Button, Badge, Card, ProgressBar, EmptyState, Modal } from '../shared/ui.js';
import { IconCheck, IconChevronDown, IconChevronRight, IconExternalLink, IconUpload, IconDownload, IconTrash, IconX } from '../shared/icons.js';
import FileConverter from '../core/file-converter.js';

const { useState, useEffect, useMemo, useCallback, useRef } = React;

// ─── Storage ────────────────────────────────────────────────────────────────

const MANUAL_CHECKS_KEY = 'passdown_checklist_manual';

function loadManualChecks() {
  try {
    const raw = localStorage.getItem(MANUAL_CHECKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveManualChecks(checks) {
  try {
    localStorage.setItem(MANUAL_CHECKS_KEY, JSON.stringify(checks));
  } catch (e) {
    console.warn('[Checklist] Failed to save manual checks:', e);
  }
}

// ─── FAC Storage ───────────────────────────────────────────────────────────

const FAC_STORAGE_KEY = 'passdown_fac_sections';
const FAC_ACCEPTED_TYPES = '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown';

function loadFACData() {
  try {
    const raw = localStorage.getItem(FAC_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveFACData(data) {
  try {
    localStorage.setItem(FAC_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[Checklist] Failed to save FAC data:', e);
  }
}

function clearFACData() {
  try {
    localStorage.removeItem(FAC_STORAGE_KEY);
  } catch (e) {
    console.warn('[Checklist] Failed to clear FAC data:', e);
  }
}

// ─── FAC Document Parser ───────────────────────────────────────────────────

let _facIdCounter = 0;
function nextFacId(prefix) {
  _facIdCounter++;
  return prefix + '_' + String(_facIdCounter).padStart(3, '0');
}

/**
 * Parse raw text from a FAC document into structured sections and items.
 * Heuristic-based: extracts numbered items, section headers, compliance markers.
 */
function parseFACDocument(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let currentSection = null;

  // Patterns
  const sectionHeaderPattern = /^#{1,3}\s+(.+)/;                          // Markdown headers
  const allCapsPattern = /^([A-Z][A-Z\s\-/:&]{4,})$/;                     // ALL CAPS lines (5+ chars)
  const numberedItemPattern = /^\s*(\d+\.[\d.]*)\s+(.+)/;                 // 1. or 1.1 or 1.1.2
  const bulletItemPattern = /^\s*[-*+]\s+(.+)/;                           // - or * or + bullets
  const compliancePattern = /(?:Y\/N|Yes\/No|N\/A|[\u2610\u2611\u2612\u25A1\u25A0\u25CB\u25CF]|\[\s*[xX]?\s*\])/i;
  const indentPattern = /^(\s{2,}|\t+)/;                                  // Indented lines

  _facIdCounter = 0; // Reset counter for fresh parse

  function ensureSection(title) {
    if (!currentSection) {
      currentSection = {
        id: nextFacId('fac'),
        title: title || 'General',
        items: []
      };
      sections.push(currentSection);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip page breaks and horizontal rules
    if (/^[-=_*]{3,}$/.test(trimmed) || /^---\s*$/.test(trimmed)) continue;

    // Check for markdown header
    const mdMatch = trimmed.match(sectionHeaderPattern);
    if (mdMatch) {
      currentSection = {
        id: nextFacId('fac'),
        title: mdMatch[1].trim(),
        items: []
      };
      sections.push(currentSection);
      continue;
    }

    // Check for ALL CAPS header (min 5 chars, not a short acronym)
    if (allCapsPattern.test(trimmed) && trimmed.length >= 5) {
      // Title-case it for display
      const titleCased = trimmed.replace(/\b\w+/g, w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      );
      currentSection = {
        id: nextFacId('fac'),
        title: titleCased,
        items: []
      };
      sections.push(currentSection);
      continue;
    }

    // Check for numbered item
    const numMatch = trimmed.match(numberedItemPattern);
    if (numMatch) {
      ensureSection('General');
      const label = numMatch[2].trim()
        .replace(/[\u2610\u2611\u2612\u25A1\u25A0\u25CB\u25CF]/g, '')  // strip checkbox chars
        .replace(/\[\s*[xX]?\s*\]/g, '')                                // strip [x] / [ ]
        .replace(/\b(Y\/N|Yes\/No|N\/A)\b/gi, '')                       // strip Y/N markers
        .trim();
      if (label) {
        const hasCompliance = compliancePattern.test(trimmed);
        currentSection.items.push({
          id: nextFacId(currentSection.id),
          label,
          status: hasCompliance ? 'not-assessed' : 'not-assessed',
          notes: '',
          linkedEntryId: null
        });
      }
      continue;
    }

    // Check for bullet item
    const bulletMatch = trimmed.match(bulletItemPattern);
    if (bulletMatch) {
      ensureSection('General');
      const label = bulletMatch[1].trim()
        .replace(/[\u2610\u2611\u2612\u25A1\u25A0\u25CB\u25CF]/g, '')
        .replace(/\[\s*[xX]?\s*\]/g, '')
        .replace(/\b(Y\/N|Yes\/No|N\/A)\b/gi, '')
        .trim();
      if (label) {
        currentSection.items.push({
          id: nextFacId(currentSection.id),
          label,
          status: 'not-assessed',
          notes: '',
          linkedEntryId: null
        });
      }
      continue;
    }

    // Check for indented sub-item
    if (indentPattern.test(line) && currentSection && currentSection.items.length > 0) {
      // Treat as a continuation/sub-item
      const label = trimmed
        .replace(/[\u2610\u2611\u2612\u25A1\u25A0\u25CB\u25CF]/g, '')
        .replace(/\[\s*[xX]?\s*\]/g, '')
        .replace(/\b(Y\/N|Yes\/No|N\/A)\b/gi, '')
        .trim();
      if (label && label.length > 3) {
        currentSection.items.push({
          id: nextFacId(currentSection.id),
          label,
          status: 'not-assessed',
          notes: '',
          linkedEntryId: null
        });
      }
      continue;
    }

    // Lines with compliance markers that didn't match above patterns
    if (compliancePattern.test(trimmed) && trimmed.length > 5) {
      ensureSection('General');
      const label = trimmed
        .replace(/[\u2610\u2611\u2612\u25A1\u25A0\u25CB\u25CF]/g, '')
        .replace(/\[\s*[xX]?\s*\]/g, '')
        .replace(/\b(Y\/N|Yes\/No|N\/A)\b/gi, '')
        .trim();
      if (label && label.length > 3) {
        currentSection.items.push({
          id: nextFacId(currentSection.id),
          label,
          status: 'not-assessed',
          notes: '',
          linkedEntryId: null
        });
      }
      continue;
    }

    // Remaining non-trivial lines: if they look like standalone items (short-to-medium length)
    // and a section exists, add them as items. Otherwise they may be section headers.
    if (trimmed.length > 5 && trimmed.length < 200) {
      // If the line ends with a colon, treat as a section header
      if (trimmed.endsWith(':')) {
        currentSection = {
          id: nextFacId('fac'),
          title: trimmed.slice(0, -1).trim(),
          items: []
        };
        sections.push(currentSection);
        continue;
      }

      // If we have a current section, add as an item
      if (currentSection) {
        currentSection.items.push({
          id: nextFacId(currentSection.id),
          label: trimmed,
          status: 'not-assessed',
          notes: '',
          linkedEntryId: null
        });
      }
    }
  }

  // Filter out empty sections
  return sections.filter(s => s.items.length > 0);
}

// ─── FAC Report Generator ──────────────────────────────────────────────────

function generateFACReportJSON(facData) {
  if (!facData) return null;
  const report = {
    document: facData.documentName,
    uploadedAt: facData.uploadedAt,
    generatedAt: new Date().toISOString(),
    summary: { total: 0, compliant: 0, nonCompliant: 0, na: 0, notAssessed: 0 },
    sections: []
  };

  for (const section of facData.sections) {
    const sectionReport = {
      title: section.title,
      items: section.items.map(item => ({
        label: item.label,
        status: item.status,
        notes: item.notes || undefined,
        linkedEntryId: item.linkedEntryId || undefined,
      })),
      summary: { total: 0, compliant: 0, nonCompliant: 0, na: 0, notAssessed: 0 }
    };

    for (const item of section.items) {
      report.summary.total++;
      sectionReport.summary.total++;
      const key = item.status === 'compliant' ? 'compliant'
        : item.status === 'non-compliant' ? 'nonCompliant'
        : item.status === 'na' ? 'na'
        : 'notAssessed';
      report.summary[key]++;
      sectionReport.summary[key]++;
    }

    sectionReport.items = sectionReport.items.map(it => {
      const clean = { ...it };
      if (!clean.notes) delete clean.notes;
      if (!clean.linkedEntryId) delete clean.linkedEntryId;
      return clean;
    });

    report.sections.push(sectionReport);
  }

  return report;
}

function generateFACReportHTML(facData, entries) {
  if (!facData) return '';

  const statusLabel = { compliant: 'Compliant', 'non-compliant': 'Non-Compliant', na: 'N/A', 'not-assessed': 'Not Assessed' };
  const statusColor = { compliant: '#16a34a', 'non-compliant': '#dc2626', na: '#64748b', 'not-assessed': '#ca8a04' };

  let total = 0, compliant = 0, nonCompliant = 0;
  for (const s of facData.sections) {
    for (const it of s.items) {
      total++;
      if (it.status === 'compliant') compliant++;
      if (it.status === 'non-compliant') nonCompliant++;
    }
  }

  const entryMap = {};
  (entries || []).forEach(e => { entryMap[e.id] = e; });

  let sectionsHtml = '';
  for (const section of facData.sections) {
    let itemsHtml = '';
    for (const item of section.items) {
      const color = statusColor[item.status] || statusColor['not-assessed'];
      const label = statusLabel[item.status] || 'Not Assessed';
      const highlight = item.status === 'non-compliant' ? 'background:#fef2f2;' : '';
      const linkedEntry = item.linkedEntryId ? entryMap[item.linkedEntryId] : null;

      itemsHtml += '<tr style="' + highlight + '">'
        + '<td style="padding:6px 12px;border:1px solid #e2e8f0;color:' + color + ';font-weight:600;font-size:13px;white-space:nowrap;">' + label + '</td>'
        + '<td style="padding:6px 12px;border:1px solid #e2e8f0;font-size:13px;">' + item.label + '</td>'
        + '<td style="padding:6px 12px;border:1px solid #e2e8f0;font-size:12px;color:#475569;">' + (item.notes || '--') + '</td>'
        + '<td style="padding:6px 12px;border:1px solid #e2e8f0;font-size:12px;color:#475569;">' + (linkedEntry ? linkedEntry.title : '--') + '</td>'
        + '</tr>';
    }

    sectionsHtml += '<h3 style="margin:20px 0 8px;color:#1e293b;font-size:16px;">' + section.title + '</h3>'
      + '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">'
      + '<thead><tr style="background:#f1f5f9;">'
      + '<th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left;font-size:12px;color:#475569;">Status</th>'
      + '<th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left;font-size:12px;color:#475569;">Item</th>'
      + '<th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left;font-size:12px;color:#475569;">Notes</th>'
      + '<th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left;font-size:12px;color:#475569;">Linked Entry</th>'
      + '</tr></thead><tbody>' + itemsHtml + '</tbody></table>';
  }

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>FAC Report - ' + facData.documentName + '</title>'
    + '<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#1e293b;}'
    + '@media print{body{margin:20px;}}h1{font-size:22px;margin-bottom:4px;}h2{font-size:14px;color:#64748b;font-weight:normal;margin-top:4px;}'
    + '.summary{display:flex;gap:24px;padding:16px;background:#f8fafc;border-radius:8px;margin:16px 0;}'
    + '.summary-item{text-align:center;}.summary-item .num{font-size:28px;font-weight:700;}.summary-item .lbl{font-size:11px;color:#64748b;text-transform:uppercase;}</style></head>'
    + '<body><h1>FAC Compliance Report</h1>'
    + '<h2>' + facData.documentName + ' &mdash; Uploaded ' + new Date(facData.uploadedAt).toLocaleDateString() + ' &mdash; Generated ' + new Date().toLocaleDateString() + '</h2>'
    + '<div class="summary">'
    + '<div class="summary-item"><div class="num">' + total + '</div><div class="lbl">Total Items</div></div>'
    + '<div class="summary-item"><div class="num" style="color:#16a34a">' + compliant + '</div><div class="lbl">Compliant</div></div>'
    + '<div class="summary-item"><div class="num" style="color:#dc2626">' + nonCompliant + '</div><div class="lbl">Non-Compliant</div></div>'
    + '<div class="summary-item"><div class="num" style="color:#ca8a04">' + (total - compliant - nonCompliant) + '</div><div class="lbl">Other</div></div>'
    + '</div>'
    + sectionsHtml
    + '</body></html>';
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── FAC Status Indicators ─────────────────────────────────────────────────

const FAC_STATUS_CONFIG = {
  compliant:      { icon: '\u2713', color: 'text-green-600', bg: 'bg-green-50',  ring: 'ring-green-200',  label: 'Compliant' },
  'non-compliant': { icon: '\u2717', color: 'text-red-600',   bg: 'bg-red-50',    ring: 'ring-red-200',    label: 'Non-Compliant' },
  na:             { icon: '\u2014', color: 'text-slate-400', bg: 'bg-slate-50',  ring: 'ring-slate-200',  label: 'N/A' },
  'not-assessed': { icon: '?',     color: 'text-amber-500', bg: 'bg-amber-50',  ring: 'ring-amber-200',  label: 'Not Assessed' },
};

const FAC_STATUS_OPTIONS = [
  { value: 'not-assessed', label: 'Not Assessed' },
  { value: 'compliant', label: 'Compliant' },
  { value: 'non-compliant', label: 'Non-Compliant' },
  { value: 'na', label: 'N/A' },
];

// ─── Entry Picker Modal ────────────────────────────────────────────────────

function EntryPickerModal({ isOpen, onClose, entries, onSelect }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return (entries || []).slice(0, 20);
    const q = search.toLowerCase();
    return (entries || []).filter(e =>
      (e.title || '').toLowerCase().includes(q) ||
      (e.tags || []).some(t => t.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [entries, search]);

  return html`
    <${Modal} isOpen=${isOpen} onClose=${onClose} title="Link Knowledge Base Entry" size="md">
      <div class="space-y-3">
        <input
          type="text"
          value=${search}
          onInput=${(e) => setSearch(e.target.value)}
          placeholder="Search entries by title or tag..."
          class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                 text-slate-700 placeholder-slate-400
                 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
        />
        <div class="max-h-64 overflow-y-auto divide-y divide-slate-100">
          ${filtered.length === 0 && html`
            <p class="py-4 text-sm text-slate-400 text-center">No entries found</p>
          `}
          ${filtered.map(entry => html`
            <button
              key=${entry.id}
              onClick=${() => { onSelect(entry.id); onClose(); }}
              class="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <span class="flex-1 min-w-0">
                <span class="text-sm font-medium text-navy-900 block truncate">${entry.title}</span>
                ${(entry.tags || []).length > 0 && html`
                  <span class="text-xs text-slate-400 block truncate">${entry.tags.join(', ')}</span>
                `}
              </span>
              ${IconExternalLink({ size: 14, className: 'flex-shrink-0 text-slate-300' })}
            </button>
          `)}
        </div>
        <div class="flex justify-end pt-2 border-t border-slate-100">
          <${Button} variant="ghost" size="sm" onClick=${onClose}>Cancel<//>
        </div>
      </div>
    <//>
  `;
}

// ─── FAC Item Row ──────────────────────────────────────────────────────────

function FACItemRow({ item, entries, onStatusChange, onNotesChange, onLinkEntry, onUnlinkEntry }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const cfg = FAC_STATUS_CONFIG[item.status] || FAC_STATUS_CONFIG['not-assessed'];
  const linkedEntry = item.linkedEntryId
    ? (entries || []).find(e => e.id === item.linkedEntryId)
    : null;

  return html`
    <div class="group">
      <div class="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 transition-colors">
        <!-- Status indicator -->
        <span class=${'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-1 ' + cfg.bg + ' ' + cfg.color + ' ' + cfg.ring}
          title=${cfg.label}>
          ${cfg.icon}
        </span>

        <!-- Status dropdown -->
        <select
          value=${item.status}
          onChange=${(e) => onStatusChange(item.id, e.target.value)}
          class="flex-shrink-0 text-xs border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-navy-500 cursor-pointer"
        >
          ${FAC_STATUS_OPTIONS.map(opt => html`
            <option key=${opt.value} value=${opt.value}>${opt.label}</option>
          `)}
        </select>

        <!-- Label -->
        <span class="flex-1 min-w-0 text-sm text-navy-900 truncate" title=${item.label}>
          ${item.label}
        </span>

        <!-- Linked entry badge -->
        ${linkedEntry && html`
          <span class="flex-shrink-0 inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-full px-2 py-0.5 cursor-pointer transition-colors"
            onClick=${() => onUnlinkEntry(item.id)}
            title=${'Linked: ' + linkedEntry.title + ' (click to unlink)'}>
            ${IconExternalLink({ size: 10 })}
            <span class="truncate max-w-[120px]">${linkedEntry.title}</span>
            ${IconX({ size: 10, className: 'text-blue-400' })}
          </span>
        `}

        <!-- Action buttons -->
        <div class="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          ${!linkedEntry && html`
            <button
              onClick=${() => setPickerOpen(true)}
              class="text-xs text-slate-400 hover:text-navy-600 hover:bg-navy-50 px-2 py-1 rounded transition-colors"
              title="Link to KB entry"
            >
              Link Entry
            </button>
          `}
          <button
            onClick=${() => setNotesOpen(o => !o)}
            class=${'text-xs px-2 py-1 rounded transition-colors ' + (notesOpen ? 'text-navy-600 bg-navy-50' : 'text-slate-400 hover:text-navy-600 hover:bg-navy-50')}
            title=${notesOpen ? 'Hide notes' : 'Add notes / evidence'}
          >
            ${item.notes ? 'Notes' : '+ Notes'}
          </button>
        </div>

        <!-- Notes indicator (always visible if notes exist) -->
        ${item.notes && !notesOpen && html`
          <span class="flex-shrink-0 w-2 h-2 rounded-full bg-navy-400" title="Has notes" />
        `}
      </div>

      <!-- Expandable notes area -->
      ${notesOpen && html`
        <div class="px-4 pb-3 pt-1 ml-9">
          <textarea
            value=${item.notes || ''}
            onInput=${(e) => onNotesChange(item.id, e.target.value)}
            placeholder="Add evidence, comments, or notes..."
            rows=${3}
            class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md
                   text-slate-700 placeholder-slate-400 resize-y
                   focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
          />
        </div>
      `}

      <!-- Entry picker modal -->
      <${EntryPickerModal}
        isOpen=${pickerOpen}
        onClose=${() => setPickerOpen(false)}
        entries=${entries}
        onSelect=${(entryId) => onLinkEntry(item.id, entryId)}
      />
    </div>
  `;
}

// ─── FAC Section (collapsible group of parsed items) ───────────────────────

function FACAreaSection({ section, entries, onStatusChange, onNotesChange, onLinkEntry, onUnlinkEntry }) {
  const [expanded, setExpanded] = useState(true);

  const counts = useMemo(() => {
    const c = { total: 0, compliant: 0, nonCompliant: 0, na: 0, notAssessed: 0 };
    for (const item of section.items) {
      c.total++;
      if (item.status === 'compliant') c.compliant++;
      else if (item.status === 'non-compliant') c.nonCompliant++;
      else if (item.status === 'na') c.na++;
      else c.notAssessed++;
    }
    return c;
  }, [section.items]);

  const assessedCount = counts.compliant + counts.nonCompliant + counts.na;
  const assessedPct = counts.total > 0 ? Math.round((assessedCount / counts.total) * 100) : 0;

  const headerColor = counts.nonCompliant > 0
    ? 'bg-red-50/50 border-red-200'
    : assessedPct === 100
      ? 'bg-green-50 border-green-200'
      : 'bg-white border-slate-200';

  return html`
    <div class="rounded-lg border border-slate-200 overflow-hidden">
      <button
        onClick=${() => setExpanded(e => !e)}
        class=${'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ' + headerColor}
      >
        <span class="flex-shrink-0 text-slate-400 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}">
          ${IconChevronDown({ size: 16 })}
        </span>
        <span class="flex-1 min-w-0">
          <span class="text-sm font-semibold text-navy-900">${section.title}</span>
          <span class="text-xs text-slate-500 ml-2">${section.items.length} item${section.items.length !== 1 ? 's' : ''}</span>
        </span>
        <!-- Status pills -->
        <div class="flex-shrink-0 flex items-center gap-1.5">
          ${counts.compliant > 0 && html`
            <span class="text-xs bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 font-medium">${counts.compliant}</span>
          `}
          ${counts.nonCompliant > 0 && html`
            <span class="text-xs bg-red-100 text-red-700 rounded-full px-1.5 py-0.5 font-medium">${counts.nonCompliant}</span>
          `}
          ${counts.na > 0 && html`
            <span class="text-xs bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5 font-medium">${counts.na}</span>
          `}
          ${counts.notAssessed > 0 && html`
            <span class="text-xs bg-amber-100 text-amber-600 rounded-full px-1.5 py-0.5 font-medium">${counts.notAssessed}</span>
          `}
        </div>
        <span class="flex-shrink-0 w-16">
          <${ProgressBar}
            value=${assessedPct}
            color=${counts.nonCompliant > 0 ? 'bg-red-400' : 'bg-green-500'}
            height="h-1.5"
          />
        </span>
      </button>

      ${expanded && html`
        <div class="divide-y divide-slate-100">
          ${section.items.map(item => html`
            <${FACItemRow}
              key=${item.id}
              item=${item}
              entries=${entries}
              onStatusChange=${onStatusChange}
              onNotesChange=${onNotesChange}
              onLinkEntry=${onLinkEntry}
              onUnlinkEntry=${onUnlinkEntry}
            />
          `)}
        </div>
      `}
    </div>
  `;
}

// ─── FAC Upload Section (main FAC component) ──────────────────────────────

function FACUploadSection({ entries }) {
  const [facData, setFacData] = useState(() => loadFACData());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const exportRef = useRef(null);

  // Persist FAC data on change
  useEffect(() => {
    if (facData) {
      saveFACData(facData);
    }
  }, [facData]);

  // Close export menu on outside click
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportMenuOpen]);

  // Handle file processing
  const processFile = useCallback(async (file) => {
    setError(null);
    setUploading(true);

    try {
      // Validate file type
      const ext = (file.name.lastIndexOf('.') >= 0
        ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
        : '');
      if (!['.pdf', '.docx', '.txt', '.md'].includes(ext)) {
        throw new Error('Unsupported file type. Please upload a PDF, DOCX, TXT, or MD file.');
      }

      // Convert file to text
      const result = await FileConverter.convert(file);
      const text = result.content || '';

      if (!text.trim()) {
        throw new Error('The document appears to be empty or could not be read.');
      }

      // Parse into sections
      const sections = parseFACDocument(text);

      if (sections.length === 0) {
        throw new Error('No checklist items could be extracted from this document. The parser looks for numbered lists, bullet points, and section headers.');
      }

      const data = {
        documentName: file.name,
        uploadedAt: new Date().toISOString(),
        sections
      };

      setFacData(data);
    } catch (err) {
      setError(err.message || 'Failed to process document.');
    } finally {
      setUploading(false);
    }
  }, []);

  // File input handler
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files && e.target.files[0];
    if (file) processFile(file);
    // Reset input so same file can be re-selected
    if (e.target) e.target.value = '';
  }, [processFile]);

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  // Item status change
  const handleStatusChange = useCallback((itemId, newStatus) => {
    setFacData(prev => {
      if (!prev) return prev;
      const sections = prev.sections.map(s => ({
        ...s,
        items: s.items.map(it => it.id === itemId ? { ...it, status: newStatus } : it)
      }));
      return { ...prev, sections };
    });
  }, []);

  // Item notes change
  const handleNotesChange = useCallback((itemId, notes) => {
    setFacData(prev => {
      if (!prev) return prev;
      const sections = prev.sections.map(s => ({
        ...s,
        items: s.items.map(it => it.id === itemId ? { ...it, notes } : it)
      }));
      return { ...prev, sections };
    });
  }, []);

  // Link entry to item
  const handleLinkEntry = useCallback((itemId, entryId) => {
    setFacData(prev => {
      if (!prev) return prev;
      const sections = prev.sections.map(s => ({
        ...s,
        items: s.items.map(it => it.id === itemId ? { ...it, linkedEntryId: entryId } : it)
      }));
      return { ...prev, sections };
    });
  }, []);

  // Unlink entry from item
  const handleUnlinkEntry = useCallback((itemId) => {
    setFacData(prev => {
      if (!prev) return prev;
      const sections = prev.sections.map(s => ({
        ...s,
        items: s.items.map(it => it.id === itemId ? { ...it, linkedEntryId: null } : it)
      }));
      return { ...prev, sections };
    });
  }, []);

  // Clear FAC data
  const handleClear = useCallback(() => {
    if (!confirm('Remove the uploaded FAC document and all assessment data? This cannot be undone.')) return;
    clearFACData();
    setFacData(null);
    setError(null);
  }, []);

  // Export handlers
  const handleExportJSON = useCallback(() => {
    const report = generateFACReportJSON(facData);
    if (!report) return;
    const filename = (facData.documentName || 'fac').replace(/\.[^.]+$/, '') + '_report.json';
    downloadBlob(JSON.stringify(report, null, 2), filename, 'application/json');
    setExportMenuOpen(false);
  }, [facData]);

  const handleExportHTML = useCallback(() => {
    const htmlContent = generateFACReportHTML(facData, entries);
    if (!htmlContent) return;
    const filename = (facData.documentName || 'fac').replace(/\.[^.]+$/, '') + '_report.html';
    downloadBlob(htmlContent, filename, 'text/html');
    setExportMenuOpen(false);
  }, [facData, entries]);

  // Compute overall FAC stats
  const facStats = useMemo(() => {
    if (!facData) return null;
    const s = { total: 0, compliant: 0, nonCompliant: 0, na: 0, notAssessed: 0 };
    for (const sec of facData.sections) {
      for (const it of sec.items) {
        s.total++;
        if (it.status === 'compliant') s.compliant++;
        else if (it.status === 'non-compliant') s.nonCompliant++;
        else if (it.status === 'na') s.na++;
        else s.notAssessed++;
      }
    }
    s.assessedPct = s.total > 0 ? Math.round(((s.compliant + s.nonCompliant + s.na) / s.total) * 100) : 0;
    return s;
  }, [facData]);

  // ─── Upload state (no FAC loaded) ─────────────────────────────────────
  if (!facData) {
    return html`
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <span class="text-slate-400">${IconUpload({ size: 18 })}</span>
          <h2 class="text-sm font-semibold text-navy-900">Unit FAC Document</h2>
        </div>

        <!-- Drop zone -->
        <div
          onDragOver=${handleDragOver}
          onDragLeave=${handleDragLeave}
          onDrop=${handleDrop}
          onClick=${() => fileInputRef.current && fileInputRef.current.click()}
          class=${'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors '
            + (dragOver
              ? 'border-navy-400 bg-navy-50'
              : 'border-slate-300 hover:border-navy-300 hover:bg-slate-50')}
        >
          <input
            ref=${fileInputRef}
            type="file"
            accept=${FAC_ACCEPTED_TYPES}
            onChange=${handleFileSelect}
            class="hidden"
          />
          <div class="text-slate-400 mb-2">${IconUpload({ size: 32, className: 'mx-auto' })}</div>
          ${uploading
            ? html`
              <p class="text-sm font-medium text-navy-700">Processing document...</p>
              <p class="text-xs text-slate-400 mt-1">Extracting sections and checklist items</p>
            `
            : html`
              <p class="text-sm font-medium text-slate-700">Upload your unit's FAC document</p>
              <p class="text-xs text-slate-400 mt-1">
                Drag and drop or click to select. Accepts PDF, DOCX, TXT, MD.
              </p>
              <p class="text-xs text-slate-400 mt-0.5">
                The document will be parsed into editable checklist sections.
              </p>
            `
          }
        </div>

        ${error && html`
          <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            ${error}
          </div>
        `}
      </div>
    `;
  }

  // ─── Loaded state (FAC data present) ──────────────────────────────────
  return html`
    <div class="space-y-4">
      <!-- FAC Header -->
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-navy-500">${IconUpload({ size: 18 })}</span>
            <h2 class="text-sm font-semibold text-navy-900">Unit FAC: ${facData.documentName}</h2>
          </div>
          <p class="text-xs text-slate-400 mt-0.5 ml-7">
            Uploaded ${new Date(facData.uploadedAt).toLocaleDateString()}
            ${' \u2014 '}${facStats.total} items across ${facData.sections.length} section${facData.sections.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <!-- Export dropdown -->
          <div class="relative" ref=${exportRef}>
            <${Button} variant="secondary" size="sm" onClick=${() => setExportMenuOpen(o => !o)}>
              ${IconDownload({ size: 14 })} Export Report
            <//>
            ${exportMenuOpen && html`
              <div class="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 min-w-[160px]">
                <button onClick=${handleExportJSON}
                  class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                  Download as JSON
                </button>
                <button onClick=${handleExportHTML}
                  class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                  Download as HTML
                </button>
              </div>
            `}
          </div>
          <${Button} variant="ghost" size="sm" onClick=${handleClear} title="Remove FAC document">
            ${IconTrash({ size: 14 })} Clear
          <//>
        </div>
      </div>

      <!-- FAC Summary Bar -->
      <div class="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-600 font-medium">FAC Assessment Progress</span>
          <span class="text-slate-500">${facStats.assessedPct}% assessed</span>
        </div>
        <${ProgressBar}
          value=${facStats.assessedPct}
          color=${facStats.nonCompliant > 0 ? 'bg-red-400' : facStats.assessedPct === 100 ? 'bg-green-500' : 'bg-navy-600'}
          height="h-2.5"
        />
        <div class="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-green-500 inline-block" />
            ${facStats.compliant} compliant
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-red-500 inline-block" />
            ${facStats.nonCompliant} non-compliant
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-slate-300 inline-block" />
            ${facStats.na} N/A
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            ${facStats.notAssessed} not assessed
          </span>
        </div>
      </div>

      <!-- Non-compliant alert -->
      ${facStats.nonCompliant > 0 && html`
        <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
          <span class="text-red-500 mt-0.5 flex-shrink-0">${'\u2717'}</span>
          <div>
            <p class="text-sm font-medium text-red-800">
              ${facStats.nonCompliant} non-compliant item${facStats.nonCompliant !== 1 ? 's' : ''} identified
            </p>
            <p class="text-xs text-red-600 mt-0.5">
              Review and add corrective action notes below. Export a report for leadership review.
            </p>
          </div>
        </div>
      `}

      <!-- FAC Sections -->
      <div class="space-y-3">
        ${facData.sections.map(section => html`
          <${FACAreaSection}
            key=${section.id}
            section=${section}
            entries=${entries}
            onStatusChange=${handleStatusChange}
            onNotesChange=${handleNotesChange}
            onLinkEntry=${handleLinkEntry}
            onUnlinkEntry=${handleUnlinkEntry}
          />
        `)}
      </div>
    </div>
  `;
}

// ─── Default Checklist ──────────────────────────────────────────────────────

const DEFAULT_CHECKLIST = [
  {
    area: 'Manning & T/O Management',
    items: [
      { id: 'manning_to_process', label: 'T/O change request process', keywords: ['t-o', 'manning', 'billet'] },
      { id: 'manning_monitor', label: 'Monitor coordination procedures', keywords: ['monitor', 'm&ra', 'coordination'] },
      { id: 'manning_fill_priority', label: 'Fill priority guidance', keywords: ['fill', 'priority', 'manning'] },
      { id: 'manning_inventory', label: 'Current inventory status', keywords: ['inventory', 'mos-health'] },
    ]
  },
  {
    area: 'Training Pipeline',
    items: [
      { id: 'training_seats', label: 'School seat allocation process', keywords: ['school-seats', 'tecom', 'allocation'] },
      { id: 'training_curriculum', label: 'Curriculum review procedures', keywords: ['curriculum', 'review'] },
      { id: 'training_instructors', label: 'Instructor staffing status', keywords: ['instructor', 'staffing'] },
      { id: 'training_pipeline_health', label: 'Pipeline throughput tracking', keywords: ['pipeline', 'throughput', 'training'] },
    ]
  },
  {
    area: 'MOS Management',
    items: [
      { id: 'mos_manual', label: 'MOS Manual change process', keywords: ['mos', 'manual', 'process'] },
      { id: 'mos_restructure', label: 'Recent/pending restructures', keywords: ['restructure', 'mos', 'merge'] },
      { id: 'mos_career_path', label: 'Career path documentation', keywords: ['career', 'path', 'pme'] },
      { id: 'mos_health_reporting', label: 'Quarterly health reporting', keywords: ['quarterly', 'health', 'reporting'] },
    ]
  },
  {
    area: 'Budget & Resources',
    items: [
      { id: 'budget_pom', label: 'POM submission process', keywords: ['pom', 'budget'] },
      { id: 'budget_conference', label: 'Conference/symposium funding', keywords: ['conference', 'symposium', 'funding'] },
      { id: 'budget_travel', label: 'Travel budget management', keywords: ['travel', 'budget'] },
    ]
  },
  {
    area: 'Stakeholder Relationships',
    items: [
      { id: 'stake_mra', label: 'M&RA coordination', keywords: ['m&ra', 'monitor'] },
      { id: 'stake_tecom', label: 'TECOM coordination', keywords: ['tecom'] },
      { id: 'stake_chain', label: 'Chain of command contacts', keywords: ['supervisor', 'dirops', 'chain-of-command'] },
      { id: 'stake_sister', label: 'Sister service/joint contacts', keywords: ['joint', 'interservice', 'army'] },
    ]
  },
  {
    area: 'Reporting & Compliance',
    items: [
      { id: 'report_quarterly', label: 'Quarterly briefs to leadership', keywords: ['quarterly', 'briefing', 'dirops'] },
      { id: 'report_annual', label: 'Annual review cycle', keywords: ['annual', 'review', 'mos-manual'] },
      { id: 'report_data_systems', label: 'Data systems & access (TFDW, MCTFS)', keywords: ['tfdw', 'mctfs', 'data', 'systems'] },
    ]
  },
  {
    area: 'Turnover Readiness',
    items: [
      { id: 'turn_narratives', label: 'Narrative interview completed', keywords: [] },
      { id: 'turn_start_here', label: 'Start Here list curated', keywords: [] },
      { id: 'turn_export', label: 'Knowledge base exported', keywords: [] },
      { id: 'turn_opsec', label: 'OPSEC review completed', keywords: [] },
    ]
  },
];

// ─── Auto-matching Logic ────────────────────────────────────────────────────

function findAutoMatch(item, entries, narratives, startHereIds) {
  // Special cases for Turnover Readiness items
  if (item.id === 'turn_narratives') {
    const completed = (narratives || []).filter(n => n.response);
    return completed.length > 0 ? { matched: true, entry: null, reason: completed.length + ' narrative' + (completed.length !== 1 ? 's' : '') + ' completed' } : { matched: false };
  }
  if (item.id === 'turn_start_here') {
    const count = (startHereIds || []).length;
    return count > 0 ? { matched: true, entry: null, reason: count + ' item' + (count !== 1 ? 's' : '') + ' in Start Here' } : { matched: false };
  }
  if (item.id === 'turn_export' || item.id === 'turn_opsec') {
    return { matched: false }; // manual only
  }

  // Keyword matching against entry tags and titles
  if (!item.keywords || item.keywords.length === 0) return { matched: false };

  for (const entry of entries) {
    const entryTags = (entry.tags || []).map(t => t.toLowerCase());
    const titleWords = (entry.title || '').toLowerCase().split(/\s+/);
    const match = item.keywords.some(kw => {
      const kwLower = kw.toLowerCase();
      return entryTags.includes(kwLower) || titleWords.some(w => w.includes(kwLower));
    });
    if (match) {
      return { matched: true, entry, reason: null };
    }
  }

  return { matched: false };
}

// ─── Clipboard/CheckSquare Icon (inline to avoid import conflicts) ──────────

function ChecklistIcon({ size = 20, className = '' } = {}) {
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      class=${className}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  `;
}

// ─── Checklist Area Section ─────────────────────────────────────────────────

function ChecklistArea({ area, items, manualChecks, autoResults, onToggleManual, onNavigateEntry, onCaptureItem }) {
  const [expanded, setExpanded] = useState(true);

  const completedCount = items.filter(item => {
    const auto = autoResults[item.id];
    return (auto && auto.matched) || manualChecks[item.id];
  }).length;

  const total = items.length;
  const allDone = completedCount === total;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const headerColor = allDone
    ? 'bg-green-50 border-green-200'
    : completedCount > 0
      ? 'bg-blue-50/50 border-slate-200'
      : 'bg-white border-slate-200';

  return html`
    <div class="rounded-lg border border-slate-200 overflow-hidden">
      <!-- Area Header -->
      <button
        onClick=${() => setExpanded(e => !e)}
        class=${'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ' + headerColor}
      >
        <span class="flex-shrink-0 text-slate-400 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}">
          ${IconChevronDown({ size: 16 })}
        </span>
        <span class="flex-1 min-w-0">
          <span class="text-sm font-semibold text-navy-900">${area}</span>
          <span class="text-xs text-slate-500 ml-2">${completedCount} of ${total} complete</span>
        </span>
        ${allDone && html`
          <span class="flex-shrink-0 text-green-600">
            ${IconCheck({ size: 16 })}
          </span>
        `}
        <span class="flex-shrink-0 w-16">
          <${ProgressBar}
            value=${pct}
            color=${allDone ? 'bg-green-500' : 'bg-navy-500'}
            height="h-1.5"
          />
        </span>
      </button>

      <!-- Items -->
      ${expanded && html`
        <div class="divide-y divide-slate-100">
          ${items.map(item => {
            const auto = autoResults[item.id] || { matched: false };
            const isManual = manualChecks[item.id] === true;
            const isChecked = auto.matched || isManual;
            const isAutoOnly = auto.matched && !isManual;

            return html`
              <div key=${item.id}
                class=${'flex items-center gap-3 px-4 py-2.5 transition-colors ' + (isChecked ? 'bg-slate-50/50' : 'hover:bg-slate-50')}>

                <!-- Checkbox -->
                <label class="flex-shrink-0 relative cursor-pointer">
                  <input
                    type="checkbox"
                    checked=${isChecked}
                    onChange=${() => onToggleManual(item.id, auto.matched)}
                    class=${'w-4 h-4 rounded border-slate-300 focus:ring-navy-500 focus:ring-2 ' +
                      (isAutoOnly ? 'text-green-600' : 'text-navy-600')}
                  />
                </label>

                <!-- Label -->
                <div class="flex-1 min-w-0">
                  <span class=${'text-sm ' + (isChecked ? 'text-slate-500 line-through decoration-slate-300' : 'text-navy-900')}>
                    ${item.label}
                  </span>

                  <!-- Auto-match badge -->
                  ${isAutoOnly && auto.entry && html`
                    <button
                      onClick=${() => onNavigateEntry(auto.entry)}
                      class="ml-2 inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 hover:bg-green-100 rounded-full px-2 py-0.5 transition-colors"
                      title=${'Linked to: ' + auto.entry.title}
                    >
                      ${IconExternalLink({ size: 10 })}
                      <span class="truncate max-w-[160px]">${auto.entry.title}</span>
                    </button>
                  `}
                  ${isAutoOnly && !auto.entry && auto.reason && html`
                    <span class="ml-2 inline-flex items-center text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5">
                      ${auto.reason}
                    </span>
                  `}
                  ${isManual && !auto.matched && html`
                    <span class="ml-2 inline-flex items-center text-xs text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
                      Manual
                    </span>
                  `}
                </div>

                <!-- Action for unchecked items -->
                ${!isChecked && html`
                  <button
                    onClick=${() => onCaptureItem(item)}
                    class="flex-shrink-0 text-xs text-slate-400 hover:text-navy-600 hover:bg-navy-50 px-2 py-1 rounded transition-colors"
                    title="Create an entry for this item"
                  >
                    + Add Entry
                  </button>
                `}
              </div>
            `;
          })}
        </div>
      `}
    </div>
  `;
}

// ─── Main Checklist Component ───────────────────────────────────────────────

export default function Checklist() {
  const { entries, narratives, startHereIds, navigate } = useApp();
  const [manualChecks, setManualChecks] = useState(() => loadManualChecks());

  // Persist manual checks whenever they change
  useEffect(() => {
    saveManualChecks(manualChecks);
  }, [manualChecks]);

  // Compute auto-match results for every item
  const autoResults = useMemo(() => {
    const results = {};
    for (const area of DEFAULT_CHECKLIST) {
      for (const item of area.items) {
        results[item.id] = findAutoMatch(item, entries, narratives, startHereIds);
      }
    }
    return results;
  }, [entries, narratives, startHereIds]);

  // Overall stats
  const stats = useMemo(() => {
    let total = 0;
    let checked = 0;
    let autoCount = 0;
    let manualCount = 0;
    for (const area of DEFAULT_CHECKLIST) {
      for (const item of area.items) {
        total++;
        const auto = autoResults[item.id];
        const isAuto = auto && auto.matched;
        const isManual = manualChecks[item.id] === true;
        if (isAuto || isManual) {
          checked++;
          if (isAuto) autoCount++;
          else manualCount++;
        }
      }
    }
    return { total, checked, autoCount, manualCount, pct: total > 0 ? Math.round((checked / total) * 100) : 0 };
  }, [autoResults, manualChecks]);

  // Toggle manual check
  const handleToggleManual = useCallback((itemId, isAutoMatched) => {
    setManualChecks(prev => {
      const next = { ...prev };
      if (isAutoMatched) {
        // Item is auto-matched; toggling should not uncheck an auto-matched item.
        // If the user checks manually on top of auto, we don't store it.
        // If they uncheck, we store a manual override of false.
        if (next[itemId] === false) {
          delete next[itemId]; // remove override, let auto take effect
        } else {
          // Can't uncheck an auto-matched item — they need to remove the entry
          return prev;
        }
      } else {
        // Not auto-matched: simple toggle
        if (next[itemId]) {
          delete next[itemId];
        } else {
          next[itemId] = true;
        }
      }
      return next;
    });
  }, []);

  // Navigate to a matched entry
  const handleNavigateEntry = useCallback((entry) => {
    if (entry && entry.id) {
      navigate('capture?id=' + entry.id);
    }
  }, [navigate]);

  // Navigate to capture form pre-seeded for an unchecked item
  const handleCaptureItem = useCallback((item) => {
    // Navigate to capture with the item label as a hint
    navigate('capture?hint=' + encodeURIComponent(item.label));
  }, [navigate]);

  // Status label
  const statusLabel = useMemo(() => {
    if (stats.pct === 100) return 'Complete';
    if (stats.pct >= 75) return 'Nearly There';
    if (stats.pct >= 50) return 'Halfway';
    if (stats.pct >= 25) return 'In Progress';
    return 'Getting Started';
  }, [stats.pct]);

  const statusColor = useMemo(() => {
    if (stats.pct === 100) return 'green';
    if (stats.pct >= 50) return 'blue';
    if (stats.pct >= 25) return 'yellow';
    return 'gray';
  }, [stats.pct]);

  // Unchecked items for the bottom CTA
  const uncheckedItems = useMemo(() => {
    const items = [];
    for (const area of DEFAULT_CHECKLIST) {
      for (const item of area.items) {
        const auto = autoResults[item.id];
        const isChecked = (auto && auto.matched) || manualChecks[item.id];
        if (!isChecked) {
          items.push({ ...item, area: area.area });
        }
      }
    }
    return items;
  }, [autoResults, manualChecks]);

  return html`
    <div class="max-w-4xl mx-auto px-4 py-8 space-y-6">

      <!-- Header -->
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
            ${ChecklistIcon({ size: 24 })}
            Functional Area Checklist
          </h1>
          <p class="text-sm text-slate-500 mt-1">
            Track coverage across key functional areas for a complete billet turnover.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <${Badge} color=${statusColor}>${statusLabel}<//>
          <span class="text-2xl font-bold text-navy-900">${stats.pct}%</span>
        </div>
      </div>

      <!-- Overall Progress -->
      <div class="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-600 font-medium">Overall Completion</span>
          <span class="text-slate-500">${stats.checked} of ${stats.total} items</span>
        </div>
        <${ProgressBar}
          value=${stats.pct}
          color=${stats.pct === 100 ? 'bg-green-500' : 'bg-navy-600'}
          height="h-3"
        />
        <div class="flex items-center gap-4 text-xs text-slate-500">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-green-500 inline-block" />
            ${stats.autoCount} auto-linked from KB
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-navy-500 inline-block" />
            ${stats.manualCount} manually checked
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-slate-200 inline-block" />
            ${stats.total - stats.checked} remaining
          </span>
        </div>
      </div>

      <!-- FAC Upload Section -->
      <${FACUploadSection} entries=${entries} />

      <!-- Default Area Sections Divider -->
      <div class="relative py-2">
        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-slate-200" /></div>
        <div class="relative flex justify-center">
          <span class="bg-slate-50 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
            Standard Turnover Checklist
          </span>
        </div>
      </div>

      <!-- Area Sections -->
      <div class="space-y-3">
        ${DEFAULT_CHECKLIST.map(area => html`
          <${ChecklistArea}
            key=${area.area}
            area=${area.area}
            items=${area.items}
            manualChecks=${manualChecks}
            autoResults=${autoResults}
            onToggleManual=${handleToggleManual}
            onNavigateEntry=${handleNavigateEntry}
            onCaptureItem=${handleCaptureItem}
          />
        `)}
      </div>

      <!-- Remaining Items CTA -->
      ${uncheckedItems.length > 0 && html`
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <h3 class="text-sm font-semibold text-amber-800">
            ${uncheckedItems.length} item${uncheckedItems.length !== 1 ? 's' : ''} remaining
          </h3>
          <p class="text-xs text-amber-700">
            Create entries in the Knowledge Base to auto-link these items, or check them manually if no dedicated entry is needed.
          </p>
          <div class="flex flex-wrap gap-2">
            ${uncheckedItems.slice(0, 8).map(item => html`
              <button
                key=${item.id}
                onClick=${() => handleCaptureItem(item)}
                class="text-xs px-2.5 py-1.5 bg-white border border-amber-300 text-amber-800 rounded-md hover:bg-amber-100 transition-colors"
                title=${'Add entry for: ' + item.label + ' (' + item.area + ')'}
              >
                + ${item.label}
              </button>
            `)}
            ${uncheckedItems.length > 8 && html`
              <span class="text-xs text-amber-600 self-center">+${uncheckedItems.length - 8} more</span>
            `}
          </div>
        </div>
      `}

      <!-- Completion State -->
      ${stats.pct === 100 && html`
        <div class="bg-green-50 border border-green-200 rounded-lg p-6 text-center space-y-2">
          <div class="text-green-600">${IconCheck({ size: 32, className: 'mx-auto' })}</div>
          <h3 class="text-lg font-semibold text-green-800">All Functional Areas Covered</h3>
          <p class="text-sm text-green-700">
            Your knowledge base covers all checklist items. Consider exporting and running a final OPSEC review.
          </p>
          <div class="flex items-center justify-center gap-3 pt-2">
            <${Button} variant="secondary" size="sm" onClick=${() => navigate('export')}>
              Export Knowledge Base
            <//>
            <${Button} variant="secondary" size="sm" onClick=${() => navigate('verify')}>
              Run Verification
            <//>
          </div>
        </div>
      `}
    </div>
  `;
}
