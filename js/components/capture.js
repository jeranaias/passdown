// ─── Knowledge Entry Create/Edit Form ─────────────────────────────────────────
// Rendered at #capture. If hash includes ?id=xxx, edit mode; otherwise create mode.
// Optional ?category=xxx to pre-select a category.

import { html, CATEGORIES, PRIORITIES, FREQUENCIES, RECURRENCES, VERIFICATION_INTERVAL_DAYS } from '../core/config.js';
import AIService from '../core/ai-service.js';
import { AppContext } from './app.js';
import { Button, Tag, TextInput, TextArea, Select, ConfirmDialog, showToast } from '../shared/ui.js';
import {
  IconFolder, IconScale, IconUsers, IconCalendar, IconLightbulb, IconFlag,
  IconEdit, IconEye, IconTrash, IconCheck, IconStar,
} from '../shared/icons.js';
import { MarkdownPreview } from '../shared/markdown.js';
import FileDropZone from './file-drop-zone.js';

const { useState, useCallback, useContext, useMemo, useRef, useEffect } = React;

// ─── Category icon lookup ────────────────────────────────────────────────────

const CATEGORY_ICON_MAP = {
  process: IconFolder,
  decision: IconScale,
  stakeholder: IconUsers,
  calendar: IconCalendar,
  lesson: IconLightbulb,
  issue: IconFlag,
};

// ─── Month options ──────────────────────────────────────────────────────────

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

// ─── Issue status options ───────────────────────────────────────────────────

const ISSUE_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'resolved', label: 'Resolved' },
];

// ─── Urgency options ────────────────────────────────────────────────────────

const URGENCY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

// ─── Frequency display labels ───────────────────────────────────────────────

const FREQUENCY_OPTIONS = FREQUENCIES.map(f => ({
  value: f,
  label: f === 'asNeeded' ? 'As Needed' : f.charAt(0).toUpperCase() + f.slice(1),
}));

// ─── Recurrence display labels ──────────────────────────────────────────────

const RECURRENCE_OPTIONS = RECURRENCES.map(r => ({
  value: r,
  label: r === 'oneTime' ? 'One-Time' : r.charAt(0).toUpperCase() + r.slice(1),
}));

// ─── Parse hash params ──────────────────────────────────────────────────────

function getHashParams() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const qIndex = hash.indexOf('?');
  if (qIndex === -1) return new URLSearchParams();
  return new URLSearchParams(hash.slice(qIndex + 1));
}

// ─── Default meta by category ───────────────────────────────────────────────

function defaultMeta(category) {
  switch (category) {
    case 'stakeholder':
      return {
        billetTitle: '',
        organization: '',
        phone: '',
        email: '',
        contactFrequency: 'asNeeded',
        relationshipContext: '',
      };
    case 'calendar':
      return {
        recurrence: 'annual',
        month: '',
        dayOfMonth: '',
        duration: '',
        prepLeadDays: '',
      };
    case 'decision':
      return {
        decisionDate: '',
        alternativesConsidered: '',
        outcomeRationale: '',
        reversible: false,
      };
    case 'issue':
      return {
        openedDate: '',
        status: 'open',
        urgency: 'medium',
        relatedStakeholders: '',
      };
    default:
      return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Capture Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function Capture() {
  const ctx = useContext(AppContext);
  const { entries, addEntry, updateEntry, deleteEntry, navigate } = ctx;

  // ─── Determine mode from hash params ──────────────────────────────────────

  const params = useMemo(() => getHashParams(), [ctx.activeHash]);
  const entryId = params.get('id') || '';
  const initialCategory = params.get('category') || '';
  const isEdit = Boolean(entryId);

  // ─── Load existing entry for edit mode ─────────────────────────────────────

  const existingEntry = useMemo(() => {
    if (!isEdit) return null;
    return entries.find(e => e.id === entryId) || null;
  }, [isEdit, entryId, entries]);

  // ─── Form State ───────────────────────────────────────────────────────────

  const resolvedCategory = existingEntry?.category || initialCategory || 'process';

  const [category, setCategory] = useState(resolvedCategory);
  const [title, setTitle] = useState(existingEntry?.title || '');
  const [content, setContent] = useState(existingEntry?.content || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState(existingEntry?.tags || []);
  const [priority, setPriority] = useState(existingEntry?.priority || 'medium');
  const [essentialReading, setEssentialReading] = useState(existingEntry?.essentialReading || false);
  const [meta, setMeta] = useState(() => {
    if (existingEntry?.meta) {
      return { ...defaultMeta(resolvedCategory), ...existingEntry.meta };
    }
    return defaultMeta(resolvedCategory);
  });

  // ─── Content editor: edit vs preview ──────────────────────────────────────

  const [showPreview, setShowPreview] = useState(false);

  // ─── File import section ────────────────────────────────────────────────

  const [fileImportOpen, setFileImportOpen] = useState(false);

  // ─── Validation state ─────────────────────────────────────────────────────

  const [errors, setErrors] = useState({});

  // ─── Delete confirmation ──────────────────────────────────────────────────

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ─── Unsaved changes warning ─────────────────────────────────────────────

  const [dirty, setDirty] = useState(false);

  // ─── Post-save success state ──────────────────────────────────────────────

  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // ─── Tag input ref ────────────────────────────────────────────────────────

  const tagInputRef = useRef(null);

  // ─── Handle category change ───────────────────────────────────────────────

  const handleCategoryChange = useCallback((newCat) => {
    setCategory(newCat);
    setMeta(prev => {
      const base = defaultMeta(newCat);
      if (existingEntry?.category === newCat && existingEntry?.meta) {
        return { ...base, ...existingEntry.meta };
      }
      return base;
    });
  }, [existingEntry]);

  // ─── Meta field updater ───────────────────────────────────────────────────

  const updateMeta = useCallback((field, value) => {
    setMeta(prev => ({ ...prev, [field]: value }));
  }, []);

  // ─── Tag Management ───────────────────────────────────────────────────────

  const addTagsFromInput = useCallback(() => {
    const newTags = tagInput
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0 && !tags.includes(t));

    if (newTags.length > 0) {
      setTags(prev => [...prev, ...newTags]);
    }
    setTagInput('');
  }, [tagInput, tags]);

  const handleTagKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTagsFromInput();
    }
    if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  }, [addTagsFromInput, tagInput, tags]);

  const removeTag = useCallback((tagToRemove) => {
    setTags(prev => prev.filter(t => t !== tagToRemove));
  }, []);

  // ─── Validation ───────────────────────────────────────────────────────────

  const validate = useCallback(() => {
    const errs = {};

    if (!title.trim()) {
      errs.title = 'Title is required.';
    }

    if (category === 'stakeholder' && !meta.billetTitle?.trim()) {
      errs.billetTitle = 'Billet Title is required for stakeholders.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [title, category, meta]);

  // ─── Save ─────────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (!validate()) {
      showToast('Please fix the highlighted errors.', 'error');
      return;
    }

    const entryData = {
      category,
      title: title.trim(),
      content,
      tags,
      priority,
      essentialReading,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
      verifyIntervalDays: VERIFICATION_INTERVAL_DAYS,
    };

    if (isEdit) {
      updateEntry(entryId, entryData);
      showToast('Entry updated.', 'success');
      setDirty(false);
      navigate('browse');
    } else {
      addEntry(entryData);
      // addEntry already shows its own toast
      setDirty(false);
      setShowSuccess(true);
    }
  }, [category, title, content, tags, priority, essentialReading, meta, isEdit, entryId, addEntry, updateEntry, navigate, validate]);

  // ─── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = useCallback(() => {
    deleteEntry(entryId);
    // deleteEntry already shows its own toast
    setShowDeleteConfirm(false);
    navigate('browse');
  }, [deleteEntry, entryId, navigate]);

  // ─── Cancel ───────────────────────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    navigate('search');
  }, [navigate]);

  // ─── Not found in edit mode ───────────────────────────────────────────────

  if (isEdit && !existingEntry) {
    return html`
      <div class="max-w-4xl mx-auto px-4 py-8">
        <div class="bg-white rounded-lg border border-slate-200 shadow-sm p-8 text-center">
          <p class="text-slate-500 mb-4">Entry not found.</p>
          <${Button} onClick=${handleCancel}>Back to List<//>
        </div>
      </div>
    `;
  }

  // ─── Post-save success card ────────────────────────────────────────────────

  if (showSuccess) {
    return html`
      <div class="max-w-3xl mx-auto px-4 py-12">
        <div class="bg-white rounded-xl border border-green-200 p-8 text-center space-y-4">
          <div class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 class="text-xl font-bold text-navy-900">Entry Created</h2>
          <p class="text-sm text-slate-600">Your knowledge has been captured and saved.</p>
          <div class="flex flex-wrap justify-center gap-3 pt-2">
            <${Button} onClick=${() => { setShowSuccess(false); setTitle(''); setContent(''); setTags([]); setTagInput(''); setPriority('medium'); setEssentialReading(false); setMeta(defaultMeta(category)); setErrors({}); }}>Add Another Entry<//>
            <${Button} variant="secondary" onClick=${() => navigate('browse')}>View in Browse<//>
            <${Button} variant="secondary" onClick=${() => navigate('guided')}>Back to Guided Setup<//>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Category color helpers ───────────────────────────────────────────────

  const categoryColorClasses = {
    process:     { active: 'bg-blue-50 border-blue-500 text-blue-800', hover: 'hover:bg-blue-50/50' },
    decision:    { active: 'bg-purple-50 border-purple-500 text-purple-800', hover: 'hover:bg-purple-50/50' },
    stakeholder: { active: 'bg-green-50 border-green-500 text-green-800', hover: 'hover:bg-green-50/50' },
    calendar:    { active: 'bg-orange-50 border-orange-500 text-orange-800', hover: 'hover:bg-orange-50/50' },
    lesson:      { active: 'bg-yellow-50 border-yellow-500 text-yellow-800', hover: 'hover:bg-yellow-50/50' },
    issue:       { active: 'bg-red-50 border-red-500 text-red-800', hover: 'hover:bg-red-50/50' },
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════════

  return html`
    <div class="max-w-4xl mx-auto px-4 py-6 space-y-6">

      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-navy-900">
            ${isEdit ? 'Edit Entry' : 'New Entry'}
          </h2>
          <p class="text-sm text-slate-500 mt-0.5">
            ${isEdit ? 'Update this knowledge entry.' : 'Capture institutional knowledge before it walks out the door.'}
          </p>
        </div>
        <${Button} variant="ghost" onClick=${handleCancel} size="sm">
          Cancel
        <//>
      </div>

      <!-- Category Progress Strip -->
      <div class="bg-slate-50 rounded-lg border border-slate-200 p-3 mb-4">
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          ${CATEGORIES.map(cat => {
            const count = entries.filter(e => e.category === cat.id).length;
            return html`
              <span key=${cat.id} class=${count === 0 ? 'text-red-500 font-medium' : 'text-slate-600'}>
                ${cat.label}: ${count}
              </span>
            `;
          })}
        </div>
      </div>

      <!-- Category Tabs -->
      <div class="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div class="px-4 py-3 border-b border-slate-100">
          <label class="text-sm font-medium text-slate-700">Category</label>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-4">
          ${CATEGORIES.map(cat => {
            const isActive = category === cat.id;
            const CatIcon = CATEGORY_ICON_MAP[cat.id];
            const colors = categoryColorClasses[cat.id];
            return html`
              <button key=${cat.id}
                type="button"
                onClick=${() => handleCategoryChange(cat.id)}
                class=${'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-sm font-medium '
                  + (isActive
                    ? colors.active + ' shadow-sm'
                    : 'border-slate-200 text-slate-600 ' + colors.hover)}>
                ${CatIcon && html`<${CatIcon} size=${20} />`}
                <span class="text-xs leading-tight text-center">${cat.label}</span>
              </button>
            `;
          })}
        </div>
      </div>

      <!-- Main Form -->
      <div class="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div class="p-6 space-y-6">

          <!-- Title -->
          <div>
            <${TextInput}
              label="Title"
              required=${true}
              value=${title}
              onChange=${(v) => { setTitle(v); setDirty(true); }}
              placeholder="Descriptive title for this entry..."
            />
            ${errors.title && html`
              <p class="text-red-500 text-xs mt-1">${errors.title}</p>
            `}
          </div>

          <!-- File Import -->
          <div>
            <button
              type="button"
              onClick=${() => setFileImportOpen(o => !o)}
              class="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
            >
              <span class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                  class="text-slate-500">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <polyline points="9 15 12 12 15 15" />
                </svg>
                Import from File
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                class=${'transition-transform ' + (fileImportOpen ? '' : '-rotate-90')}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            ${fileImportOpen && html`
              <div class="mt-2">
                <${FileDropZone}
                  onContent=${({ content: fileContent, title: fileTitle }) => {
                    setContent(prev => prev ? prev + '\n\n' + fileContent : fileContent);
                    if (!title.trim() && fileTitle) setTitle(fileTitle);
                    showToast('File converted to markdown. Review and edit as needed.', 'success');
                  }}
                  onError=${(msg) => showToast(msg, 'error')}
                />
              </div>
            `}
          </div>

          <!-- Content with Markdown Toggle -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-sm font-medium text-slate-700">
                Content
              </label>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  onClick=${() => setShowPreview(false)}
                  class=${'px-2.5 py-1 text-xs font-medium rounded-md transition-colors '
                    + (!showPreview
                      ? 'bg-navy-100 text-navy-700'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100')}>
                  <span class="flex items-center gap-1">
                    <${IconEdit} size=${14} />
                    Write
                  </span>
                </button>
                <button
                  type="button"
                  onClick=${() => setShowPreview(true)}
                  class=${'px-2.5 py-1 text-xs font-medium rounded-md transition-colors '
                    + (showPreview
                      ? 'bg-navy-100 text-navy-700'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100')}>
                  <span class="flex items-center gap-1">
                    <${IconEye} size=${14} />
                    Preview
                  </span>
                </button>
              </div>
            </div>

            ${!showPreview
              ? html`
                <textarea
                  value=${content}
                  onChange=${(e) => { setContent(e.target.value); setDirty(true); }}
                  rows=${10}
                  placeholder="Write your knowledge here... Markdown is supported."
                  class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                         text-slate-700 placeholder-slate-400 resize-y font-mono
                         focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                />
              `
              : html`
                <div class="min-h-[240px] p-4 border border-slate-300 rounded-md bg-slate-50 overflow-auto">
                  ${content.trim()
                    ? html`<${MarkdownPreview} content=${content} />`
                    : html`<p class="text-slate-400 italic text-sm">Nothing to preview.</p>`
                  }
                </div>
              `
            }
            <p class="text-xs text-slate-400 mt-1">Supports Markdown: **bold**, *italic*, ## headings, - lists, \`code\`, etc.</p>
          </div>

          <!-- Tags -->
          <div>
            <label class="text-sm font-medium text-slate-700 block mb-1">Tags</label>
            <div class="flex flex-wrap items-center gap-1.5 p-2 border border-slate-300 rounded-md bg-white
                        focus-within:ring-2 focus-within:ring-navy-500 focus-within:border-navy-500 min-h-[42px]">
              ${tags.map(tag => html`
                <${Tag} key=${tag} label=${tag} onRemove=${() => removeTag(tag)} />
              `)}
              <input
                ref=${tagInputRef}
                type="text"
                value=${tagInput}
                onChange=${(e) => { setTagInput(e.target.value); setDirty(true); }}
                onKeyDown=${handleTagKeyDown}
                onBlur=${() => { if (tagInput.trim()) addTagsFromInput(); }}
                placeholder=${tags.length === 0 ? 'Add tags (comma-separated)...' : 'Add more...'}
                class="flex-1 min-w-[120px] px-1 py-1 text-sm border-0 outline-none bg-transparent placeholder-slate-400"
              />
            </div>
            <p class="text-xs text-slate-400 mt-1">Press Enter or comma to add. Backspace to remove last tag.</p>
          </div>

          <!-- Priority & Essential Reading row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <${Select}
              label="Priority"
              value=${priority}
              onChange=${(v) => { setPriority(v); setDirty(true); }}
              options=${PRIORITIES.map(p => ({ value: p.id, label: p.label }))}
            />
            <div class="flex items-end pb-1">
              <label class="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked=${essentialReading}
                  onChange=${(e) => setEssentialReading(e.target.checked)}
                  class="w-4 h-4 rounded border-slate-300 text-navy-700 focus:ring-navy-500"
                />
                <span class="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <${IconStar} size=${16} className="text-yellow-500" />
                  Essential Reading
                </span>
                <span class="text-xs text-slate-400">(flags for Start Here list)</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Category-Specific Meta Fields -->
      ${category === 'stakeholder' && html`
        <${StakeholderFields} meta=${meta} updateMeta=${updateMeta} errors=${errors} />
      `}
      ${category === 'calendar' && html`
        <${CalendarFields} meta=${meta} updateMeta=${updateMeta} />
      `}
      ${category === 'decision' && html`
        <${DecisionFields} meta=${meta} updateMeta=${updateMeta} />
      `}
      ${category === 'issue' && html`
        <${IssueFields} meta=${meta} updateMeta=${updateMeta} />
      `}

      <!-- AI Assist -->
      <${AIAssistPanel}
        title=${title}
        content=${content}
        category=${category}
        tags=${tags}
        priority=${priority}
        isEdit=${isEdit}
        onAddTag=${(tag) => { if (!tags.includes(tag)) setTags(prev => [...prev, tag]); }}
        onSetContent=${setContent}
      />

      <!-- OPSEC Reminder -->
      <p class="text-xs text-slate-400 mb-3">Use billet titles, not personal names. Review for OPSEC before sharing.</p>

      <!-- Action Buttons -->
      <div class="flex items-center justify-between">
        <div>
          ${isEdit && html`
            <${Button}
              variant="danger"
              onClick=${() => setShowDeleteConfirm(true)}
              size="md">
              <${IconTrash} size=${16} /> Delete Entry
            <//>
          `}
        </div>
        <div class="flex items-center gap-3">
          <${Button} variant="secondary" onClick=${handleCancel}>
            Cancel
          <//>
          <${Button}
            variant="primary"
            onClick=${handleSave}>
            <${IconCheck} size=${16} /> ${isEdit ? 'Save Changes' : 'Create Entry'}
          <//>
        </div>
      </div>

      <!-- Delete Confirmation -->
      <${ConfirmDialog}
        isOpen=${showDeleteConfirm}
        onCancel=${() => setShowDeleteConfirm(false)}
        onConfirm=${handleDelete}
        title="Delete Entry"
        message=${'Are you sure you want to delete "' + title + '"? This action cannot be undone.'}
        confirmText="Delete"
        danger=${true}
      />
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI Assist Panel
// ═══════════════════════════════════════════════════════════════════════════════

function AIAssistPanel({ title, content, category, tags, priority, isEdit, onAddTag, onSetContent }) {
  const [expanded, setExpanded] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [improvements, setImprovements] = useState('');
  const [genDescription, setGenDescription] = useState('');
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingImprove, setLoadingImprove] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);

  const aiAvailable = AIService.isAvailable();

  const handleSuggestTags = useCallback(async () => {
    setLoadingTags(true);
    setSuggestedTags([]);
    try {
      const result = await AIService.suggestTags(title, content);
      if (Array.isArray(result) && result.length > 0) {
        setSuggestedTags(result.filter(t => !tags.includes(t)));
      } else {
        showToast('No tag suggestions generated.', 'info');
      }
    } catch (err) {
      showToast('Failed to suggest tags: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setLoadingTags(false);
    }
  }, [title, content, tags]);

  const handleImproveContent = useCallback(async () => {
    setLoadingImprove(true);
    setImprovements('');
    try {
      const result = await AIService.improveContent({ title, content, category, tags, priority });
      if (result && typeof result === 'string') {
        setImprovements(result);
      } else {
        showToast('No improvement suggestions generated.', 'info');
      }
    } catch (err) {
      showToast('Failed to get suggestions: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setLoadingImprove(false);
    }
  }, [title, content, category, tags, priority]);

  const handleGenerate = useCallback(async () => {
    if (!genDescription.trim()) {
      showToast('Enter a brief description first.', 'info');
      return;
    }
    setLoadingGenerate(true);
    try {
      const result = await AIService.generateFromDescription(genDescription.trim(), category);
      if (result) {
        onSetContent(result);
        setGenDescription('');
        showToast('Content generated. Review and edit as needed.', 'success');
      } else {
        showToast('No content generated.', 'info');
      }
    } catch (err) {
      showToast('Failed to generate content: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setLoadingGenerate(false);
    }
  }, [genDescription, category, onSetContent]);

  const spinner = html`
    <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  `;

  if (!aiAvailable) {
    return html`
      <div class="bg-slate-50 rounded-lg border border-slate-200 px-4 py-3">
        <p class="text-sm text-slate-400 italic">AI assist available when Firebase is configured in Settings.</p>
      </div>
    `;
  }

  return html`
    <div class="bg-white rounded-lg border border-slate-200 shadow-sm">
      <button
        type="button"
        onClick=${() => setExpanded(e => !e)}
        class="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors rounded-lg"
      >
        <span class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          AI Assist
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          class=${'transition-transform ' + (expanded ? '' : '-rotate-90')}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      ${expanded && html`
        <div class="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">

          <!-- Suggest Tags -->
          <div>
            <${Button}
              variant="secondary"
              size="sm"
              onClick=${handleSuggestTags}
              disabled=${loadingTags}
            >
              ${loadingTags ? spinner : 'Suggest Tags'}
            <//>
            ${suggestedTags.length > 0 && html`
              <div class="flex flex-wrap gap-1.5 mt-2">
                ${suggestedTags.map(tag => html`
                  <button
                    key=${tag}
                    type="button"
                    onClick=${() => { onAddTag(tag); setSuggestedTags(prev => prev.filter(t => t !== tag)); }}
                    class="px-2 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full hover:bg-purple-100 transition-colors cursor-pointer"
                    title="Click to add this tag"
                  >
                    + ${tag}
                  </button>
                `)}
              </div>
            `}
          </div>

          <!-- Improve Content -->
          <div>
            <${Button}
              variant="secondary"
              size="sm"
              onClick=${handleImproveContent}
              disabled=${loadingImprove}
            >
              ${loadingImprove ? spinner : 'Improve Content'}
            <//>
            ${improvements && html`
              <div class="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                ${improvements}
              </div>
            `}
          </div>

          <!-- Generate from Description (create mode only) -->
          ${!isEdit && html`
            <div>
              <label class="text-sm font-medium text-slate-600 block mb-1">Generate from Description</label>
              <textarea
                value=${genDescription}
                onChange=${(e) => setGenDescription(e.target.value)}
                rows="3"
                placeholder="Briefly describe what this entry should cover, and AI will generate structured content..."
                class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                       text-slate-700 placeholder-slate-400 resize-y
                       focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
              />
              <${Button}
                variant="secondary"
                size="sm"
                onClick=${handleGenerate}
                disabled=${loadingGenerate || !genDescription.trim()}
                className="mt-1"
              >
                ${loadingGenerate ? spinner : 'Generate Content'}
              <//>
            </div>
          `}
        </div>
      `}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Category-Specific Field Panels
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Stakeholder Fields ──────────────────────────────────────────────────────

function StakeholderFields({ meta, updateMeta, errors }) {
  return html`
    <div class="bg-white rounded-lg border border-green-200 shadow-sm">
      <div class="px-6 py-3 border-b border-green-100 bg-green-50/50 rounded-t-lg">
        <div class="flex items-center gap-2">
          <${IconUsers} size=${16} className="text-green-600" />
          <span class="text-sm font-semibold text-green-800">Stakeholder Details</span>
        </div>
      </div>
      <div class="p-6 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <${TextInput}
              label="Billet Title"
              required=${true}
              value=${meta.billetTitle || ''}
              onChange=${(v) => updateMeta('billetTitle', v)}
              placeholder="e.g., S-3 Operations Officer"
            />
            ${errors.billetTitle && html`
              <p class="text-red-500 text-xs mt-1">${errors.billetTitle}</p>
            `}
          </div>
          <${TextInput}
            label="Organization"
            value=${meta.organization || ''}
            onChange=${(v) => updateMeta('organization', v)}
            placeholder="e.g., 1st Marine Division G-3"
          />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <${TextInput}
            label="Phone"
            value=${meta.phone || ''}
            onChange=${(v) => updateMeta('phone', v)}
            placeholder="DSN or commercial"
          />
          <${TextInput}
            label="Email"
            value=${meta.email || ''}
            onChange=${(v) => updateMeta('email', v)}
            placeholder="official email"
            type="email"
          />
        </div>
        <${Select}
          label="Contact Frequency"
          value=${meta.contactFrequency || 'asNeeded'}
          onChange=${(v) => updateMeta('contactFrequency', v)}
          options=${FREQUENCY_OPTIONS}
        />
        <${TextArea}
          label="Relationship Context"
          value=${meta.relationshipContext || ''}
          onChange=${(v) => updateMeta('relationshipContext', v)}
          placeholder="Why do you contact this person? Under what circumstances? What do they need from you?"
          rows=${4}
        />
      </div>
    </div>
  `;
}

// ─── Calendar Fields ─────────────────────────────────────────────────────────

function CalendarFields({ meta, updateMeta }) {
  const recurrence = meta.recurrence || 'annual';
  const showMonth = recurrence === 'annual';
  const showDayOfMonth = recurrence === 'annual' || recurrence === 'monthly';

  return html`
    <div class="bg-white rounded-lg border border-orange-200 shadow-sm">
      <div class="px-6 py-3 border-b border-orange-100 bg-orange-50/50 rounded-t-lg">
        <div class="flex items-center gap-2">
          <${IconCalendar} size=${16} className="text-orange-600" />
          <span class="text-sm font-semibold text-orange-800">Calendar Details</span>
        </div>
      </div>
      <div class="p-6 space-y-4">
        <${Select}
          label="Recurrence"
          value=${recurrence}
          onChange=${(v) => updateMeta('recurrence', v)}
          options=${RECURRENCE_OPTIONS}
        />
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          ${showMonth && html`
            <${Select}
              label="Month"
              value=${meta.month || ''}
              onChange=${(v) => updateMeta('month', v)}
              options=${MONTH_OPTIONS}
              placeholder="Select month..."
            />
          `}
          ${showDayOfMonth && html`
            <div>
              <label class="text-sm font-medium text-slate-700 block mb-1">Day of Month</label>
              <input
                type="number"
                min="1"
                max="31"
                value=${meta.dayOfMonth || ''}
                onChange=${(e) => updateMeta('dayOfMonth', e.target.value)}
                placeholder="1-31"
                class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                       text-slate-700 placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
              />
            </div>
          `}
          <${TextInput}
            label="Duration"
            value=${meta.duration || ''}
            onChange=${(v) => updateMeta('duration', v)}
            placeholder='e.g., "2 weeks", "3 days"'
          />
        </div>
        <div>
          <label class="text-sm font-medium text-slate-700 block mb-1">Prep Lead Days</label>
          <input
            type="number"
            min="0"
            value=${meta.prepLeadDays || ''}
            onChange=${(e) => updateMeta('prepLeadDays', e.target.value)}
            placeholder="Days before event to start preparing"
            class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                   text-slate-700 placeholder-slate-400 sm:max-w-xs
                   focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
          />
          <p class="text-xs text-slate-400 mt-1">How many days before the event should preparation begin?</p>
        </div>
      </div>
    </div>
  `;
}

// ─── Decision Fields ─────────────────────────────────────────────────────────

function DecisionFields({ meta, updateMeta }) {
  return html`
    <div class="bg-white rounded-lg border border-purple-200 shadow-sm">
      <div class="px-6 py-3 border-b border-purple-100 bg-purple-50/50 rounded-t-lg">
        <div class="flex items-center gap-2">
          <${IconScale} size=${16} className="text-purple-600" />
          <span class="text-sm font-semibold text-purple-800">Decision Details</span>
        </div>
      </div>
      <div class="p-6 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="text-sm font-medium text-slate-700 block mb-1">Decision Date</label>
            <input
              type="date"
              value=${meta.decisionDate || ''}
              onChange=${(e) => updateMeta('decisionDate', e.target.value)}
              class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                     text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
            />
          </div>
          <div class="flex items-end pb-1">
            <label class="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked=${meta.reversible || false}
                onChange=${(e) => updateMeta('reversible', e.target.checked)}
                class="w-4 h-4 rounded border-slate-300 text-navy-700 focus:ring-navy-500"
              />
              <span class="text-sm font-medium text-slate-700">Reversible?</span>
              <span class="text-xs text-slate-400">(can this decision be undone?)</span>
            </label>
          </div>
        </div>
        <${TextArea}
          label="Alternatives Considered"
          value=${meta.alternativesConsidered || ''}
          onChange=${(v) => updateMeta('alternativesConsidered', v)}
          placeholder="What other options were evaluated? Why were they rejected?"
          rows=${3}
        />
        <${TextArea}
          label="Outcome & Rationale"
          value=${meta.outcomeRationale || ''}
          onChange=${(v) => updateMeta('outcomeRationale', v)}
          placeholder="What was decided and why? What were the key factors?"
          rows=${3}
        />
      </div>
    </div>
  `;
}

// ─── Issue Fields ────────────────────────────────────────────────────────────

function IssueFields({ meta, updateMeta }) {
  return html`
    <div class="bg-white rounded-lg border border-red-200 shadow-sm">
      <div class="px-6 py-3 border-b border-red-100 bg-red-50/50 rounded-t-lg">
        <div class="flex items-center gap-2">
          <${IconFlag} size=${16} className="text-red-600" />
          <span class="text-sm font-semibold text-red-800">Issue Details</span>
        </div>
      </div>
      <div class="p-6 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="text-sm font-medium text-slate-700 block mb-1">Opened Date</label>
            <input
              type="date"
              value=${meta.openedDate || ''}
              onChange=${(e) => updateMeta('openedDate', e.target.value)}
              class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                     text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
            />
          </div>
          <${Select}
            label="Status"
            value=${meta.status || 'open'}
            onChange=${(v) => updateMeta('status', v)}
            options=${ISSUE_STATUS_OPTIONS}
          />
          <${Select}
            label="Urgency"
            value=${meta.urgency || 'medium'}
            onChange=${(v) => updateMeta('urgency', v)}
            options=${URGENCY_OPTIONS}
          />
        </div>
        <${TextInput}
          label="Related Stakeholders"
          value=${meta.relatedStakeholders || ''}
          onChange=${(v) => updateMeta('relatedStakeholders', v)}
          placeholder="Names or references to stakeholder entries (comma-separated)"
        />
      </div>
    </div>
  `;
}
