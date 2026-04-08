// ─── Knowledge Entry Create/Edit Form ─────────────────────────────────────────
// Rendered at #capture. If hash includes ?id=xxx, edit mode; otherwise create mode.
// Optional ?category=xxx to pre-select a category.

import { html, CATEGORIES, PRIORITIES, FREQUENCIES, RECURRENCES, VERIFICATION_INTERVAL_DAYS } from '../core/config.js';
import AIService from '../core/ai-service.js';
import { AppContext } from './app.js';
import { Button, Tag, TextInput, TextArea, Select, ConfirmDialog, showToast } from '../shared/ui.js';
import {
  IconFolder, IconScale, IconUsers, IconCalendar, IconLightbulb, IconFlag,
  IconEdit, IconEye, IconTrash, IconCheck, IconStar, IconPlus, IconArrowUp, IconArrowDown, IconX,
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

// ─── Content Parsing Utilities ──────────────────────────────────────────────
// Parse structured fields back from markdown content for edit mode.

function parseStepsFromContent(content, category) {
  if (category !== 'process' || !content) return [''];
  const stepsMatch = content.match(/## Steps\n([\s\S]*?)(?=\n## |$)/);
  if (!stepsMatch) {
    // Try parsing numbered list lines from the whole content
    const lines = content.split('\n').filter(l => /^\d+\.\s/.test(l.trim()));
    return lines.length > 0 ? lines.map(l => l.replace(/^\d+\.\s*/, '').trim()) : [''];
  }
  const lines = stepsMatch[1].split('\n').filter(l => /^\d+\.\s/.test(l.trim()));
  return lines.length > 0 ? lines.map(l => l.replace(/^\d+\.\s*/, '').trim()) : [''];
}

function parseProcessNotes(content, category) {
  if (category !== 'process' || !content) return '';
  const match = content.match(/## Additional Notes\n([\s\S]*?)(?=\n## |$)/);
  return match ? match[1].trim() : '';
}

function parseProcessContacts(content, category) {
  if (category !== 'process' || !content) return '';
  const match = content.match(/## Key Contacts\n([\s\S]*?)(?=\n## |$)/);
  return match ? match[1].trim() : '';
}

function parseProcessTimeline(content, category) {
  if (category !== 'process' || !content) return '';
  const match = content.match(/## Timeline\n([\s\S]*?)(?=\n## |$)/);
  return match ? match[1].trim() : '';
}

function parseLessonSection(content, category, heading) {
  if (category !== 'lesson' || !content) return '';
  const regex = new RegExp('## ' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n([\\s\\S]*?)(?=\\n## |$)');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function parseDecisionSection(content, category, heading) {
  if (category !== 'decision' || !content) return '';
  const regex = new RegExp('## ' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n([\\s\\S]*?)(?=\\n## |$)');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function parseIssueSection(content, category, heading) {
  if (category !== 'issue' || !content) return '';
  const regex = new RegExp('## ' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n([\\s\\S]*?)(?=\\n## |$)');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

// ─── Content Assembly Utilities ──────────────────────────────────────────────
// Assemble structured fields into markdown content for saving.

function assembleProcessContent(steps, notes, contacts, timeline) {
  let parts = [];
  const validSteps = steps.filter(s => s.trim());
  if (validSteps.length > 0) {
    parts.push('## Steps\n' + validSteps.map((s, i) => `${i + 1}. ${s}`).join('\n'));
  }
  if (contacts.trim()) parts.push('## Key Contacts\n' + contacts.trim());
  if (timeline.trim()) parts.push('## Timeline\n' + timeline.trim());
  if (notes.trim()) parts.push('## Additional Notes\n' + notes.trim());
  return parts.join('\n\n');
}

function assembleLessonContent(what, takeaway, apply) {
  let parts = [];
  if (what.trim()) parts.push('## What Happened\n' + what.trim());
  if (takeaway.trim()) parts.push('## The Lesson\n' + takeaway.trim());
  if (apply.trim()) parts.push('## How to Apply This\n' + apply.trim());
  return parts.join('\n\n');
}

function assembleDecisionContent(text, alternatives, rationale, impact) {
  let parts = [];
  if (text.trim()) parts.push('## The Decision\n' + text.trim());
  if (alternatives.trim()) parts.push('## Alternatives Considered\n' + alternatives.trim());
  if (rationale.trim()) parts.push('## Rationale\n' + rationale.trim());
  if (impact.trim()) parts.push('## Impact\n' + impact.trim());
  return parts.join('\n\n');
}

function assembleIssueContent(background, currentStatus, nextSteps) {
  let parts = [];
  if (background.trim()) parts.push('## Background\n' + background.trim());
  if (currentStatus.trim()) parts.push('## Current Status\n' + currentStatus.trim());
  if (nextSteps.trim()) parts.push('## Next Steps\n' + nextSteps.trim());
  return parts.join('\n\n');
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

  // ─── Structured field state (category-specific) ───────────────────────────

  // Process: dynamic steps list
  const [steps, setSteps] = useState(() => parseStepsFromContent(existingEntry?.content, resolvedCategory));
  const [processNotes, setProcessNotes] = useState(() => parseProcessNotes(existingEntry?.content, resolvedCategory));
  const [processContacts, setProcessContacts] = useState(() => parseProcessContacts(existingEntry?.content, resolvedCategory));
  const [processTimeline, setProcessTimeline] = useState(() => parseProcessTimeline(existingEntry?.content, resolvedCategory));
  const [showProcessNotes, setShowProcessNotes] = useState(false);

  // Lessons Learned: three structured textareas
  const [lessonWhat, setLessonWhat] = useState(() => parseLessonSection(existingEntry?.content, resolvedCategory, 'What Happened'));
  const [lessonTakeaway, setLessonTakeaway] = useState(() => parseLessonSection(existingEntry?.content, resolvedCategory, 'The Lesson'));
  const [lessonApply, setLessonApply] = useState(() => parseLessonSection(existingEntry?.content, resolvedCategory, 'How to Apply This'));

  // Decision Log: structured fields
  const [decisionText, setDecisionText] = useState(() => parseDecisionSection(existingEntry?.content, resolvedCategory, 'The Decision'));
  const [decisionAlternatives, setDecisionAlternatives] = useState(() => parseDecisionSection(existingEntry?.content, resolvedCategory, 'Alternatives Considered'));
  const [decisionRationale, setDecisionRationale] = useState(() => parseDecisionSection(existingEntry?.content, resolvedCategory, 'Rationale'));
  const [decisionImpact, setDecisionImpact] = useState(() => parseDecisionSection(existingEntry?.content, resolvedCategory, 'Impact'));

  // Active Issues: structured fields
  const [issueBackground, setIssueBackground] = useState(() => parseIssueSection(existingEntry?.content, resolvedCategory, 'Background'));
  const [issueCurrentStatus, setIssueCurrentStatus] = useState(() => parseIssueSection(existingEntry?.content, resolvedCategory, 'Current Status'));
  const [issueNextSteps, setIssueNextSteps] = useState(() => parseIssueSection(existingEntry?.content, resolvedCategory, 'Next Steps'));

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
    // Preserve structured content into the generic content field before switching
    const oldCat = category;
    if (oldCat === 'process') {
      setContent(assembleProcessContent(steps, processNotes, processContacts, processTimeline));
    } else if (oldCat === 'lesson') {
      setContent(assembleLessonContent(lessonWhat, lessonTakeaway, lessonApply));
    } else if (oldCat === 'decision') {
      setContent(assembleDecisionContent(decisionText, decisionAlternatives, decisionRationale, decisionImpact));
    } else if (oldCat === 'issue') {
      setContent(assembleIssueContent(issueBackground, issueCurrentStatus, issueNextSteps));
    }

    setCategory(newCat);
    setMeta(prev => {
      const base = defaultMeta(newCat);
      if (existingEntry?.category === newCat && existingEntry?.meta) {
        return { ...base, ...existingEntry.meta };
      }
      return base;
    });

    // Reset structured fields for the new category (they'll be empty for a new category)
    if (newCat === 'process') {
      setSteps(['']); setProcessNotes(''); setProcessContacts(''); setProcessTimeline('');
    } else if (newCat === 'lesson') {
      setLessonWhat(''); setLessonTakeaway(''); setLessonApply('');
    } else if (newCat === 'decision') {
      setDecisionText(''); setDecisionAlternatives(''); setDecisionRationale(''); setDecisionImpact('');
    } else if (newCat === 'issue') {
      setIssueBackground(''); setIssueCurrentStatus(''); setIssueNextSteps('');
    }
  }, [existingEntry, category, steps, processNotes, processContacts, processTimeline,
      lessonWhat, lessonTakeaway, lessonApply,
      decisionText, decisionAlternatives, decisionRationale, decisionImpact,
      issueBackground, issueCurrentStatus, issueNextSteps]);

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

  // ─── Assemble final content from structured fields ────────────────────────

  const assembleContent = useCallback(() => {
    switch (category) {
      case 'process':
        return assembleProcessContent(steps, processNotes, processContacts, processTimeline);
      case 'lesson':
        return assembleLessonContent(lessonWhat, lessonTakeaway, lessonApply);
      case 'decision':
        return assembleDecisionContent(decisionText, decisionAlternatives, decisionRationale, decisionImpact);
      case 'issue':
        return assembleIssueContent(issueBackground, issueCurrentStatus, issueNextSteps);
      default:
        return content;
    }
  }, [category, steps, processNotes, processContacts, processTimeline,
      lessonWhat, lessonTakeaway, lessonApply,
      decisionText, decisionAlternatives, decisionRationale, decisionImpact,
      issueBackground, issueCurrentStatus, issueNextSteps, content]);

  const handleSave = useCallback(() => {
    if (!validate()) {
      showToast('Please fix the highlighted errors.', 'error');
      return;
    }

    const finalContent = assembleContent();

    const entryData = {
      category,
      title: title.trim(),
      content: finalContent,
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
  }, [category, title, content, tags, priority, essentialReading, meta, isEdit, entryId, addEntry, updateEntry, navigate, validate, assembleContent]);

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
            <${Button} onClick=${() => { setShowSuccess(false); setTitle(''); setContent(''); setTags([]); setTagInput(''); setPriority('medium'); setEssentialReading(false); setMeta(defaultMeta(category)); setErrors({}); setSteps(['']); setProcessNotes(''); setProcessContacts(''); setProcessTimeline(''); setLessonWhat(''); setLessonTakeaway(''); setLessonApply(''); setDecisionText(''); setDecisionAlternatives(''); setDecisionRationale(''); setDecisionImpact(''); setIssueBackground(''); setIssueCurrentStatus(''); setIssueNextSteps(''); }}>Add Another Entry<//>
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

  // ─── Step management helpers (Process & SOPs) ─────────────────────────────

  const addStep = useCallback(() => {
    setSteps(prev => [...prev, '']);
    setDirty(true);
  }, []);

  const removeStep = useCallback((index) => {
    setSteps(prev => prev.length <= 1 ? [''] : prev.filter((_, i) => i !== index));
    setDirty(true);
  }, []);

  const updateStep = useCallback((index, value) => {
    setSteps(prev => prev.map((s, i) => i === index ? value : s));
    setDirty(true);
  }, []);

  const moveStep = useCallback((index, direction) => {
    setSteps(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  }, []);

  // ─── Color border for current category ───────────────────────────────────

  const catColor = CATEGORIES.find(c => c.id === category)?.color || 'slate';
  const borderColorMap = {
    blue: 'border-blue-400', purple: 'border-purple-400', green: 'border-green-400',
    orange: 'border-orange-400', yellow: 'border-yellow-400', red: 'border-red-400',
  };
  const bgTintMap = {
    blue: 'bg-blue-50/40', purple: 'bg-purple-50/40', green: 'bg-green-50/40',
    orange: 'bg-orange-50/40', yellow: 'bg-yellow-50/40', red: 'bg-red-50/40',
  };
  const formBorder = borderColorMap[catColor] || 'border-slate-200';
  const formBgTint = bgTintMap[catColor] || '';

  // ─── Shared sub-renders ──────────────────────────────────────────────────

  const renderTagsRow = () => html`
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
    </div>
  `;

  const renderPriorityEssentialRow = () => html`
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
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
            onChange=${(e) => { setEssentialReading(e.target.checked); setDirty(true); }}
            class="w-4 h-4 rounded border-slate-300 text-navy-700 focus:ring-navy-500"
          />
          <span class="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <${IconStar} size=${16} className="text-yellow-500" />
            Essential Reading
          </span>
        </label>
      </div>
    </div>
  `;

  const renderFileImport = () => html`
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
  `;

  const renderGenericContentEditor = (label, placeholder, rows) => html`
    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="text-sm font-medium text-slate-700">${label || 'Content'}</label>
        <div class="flex items-center gap-1">
          <button type="button" onClick=${() => setShowPreview(false)}
            class=${'px-2.5 py-1 text-xs font-medium rounded-md transition-colors '
              + (!showPreview ? 'bg-navy-100 text-navy-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100')}>
            <span class="flex items-center gap-1"><${IconEdit} size=${14} /> Write</span>
          </button>
          <button type="button" onClick=${() => setShowPreview(true)}
            class=${'px-2.5 py-1 text-xs font-medium rounded-md transition-colors '
              + (showPreview ? 'bg-navy-100 text-navy-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100')}>
            <span class="flex items-center gap-1"><${IconEye} size=${14} /> Preview</span>
          </button>
        </div>
      </div>
      ${!showPreview
        ? html`
          <textarea
            value=${content}
            onChange=${(e) => { setContent(e.target.value); setDirty(true); }}
            rows=${rows || 10}
            placeholder=${placeholder || 'Write your knowledge here... Markdown is supported.'}
            class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                   text-slate-700 placeholder-slate-400 resize-y font-mono
                   focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
          />
        `
        : html`
          <div class=${'min-h-[' + ((rows || 10) * 24) + 'px] p-4 border border-slate-300 rounded-md bg-slate-50 overflow-auto'}>
            ${content.trim()
              ? html`<${MarkdownPreview} content=${content} />`
              : html`<p class="text-slate-400 italic text-sm">Nothing to preview.</p>`
            }
          </div>
        `
      }
      <p class="text-xs text-slate-400 mt-1">Supports Markdown: **bold**, *italic*, ## headings, - lists, \`code\`, etc.</p>
    </div>
  `;

  // ═════════════════════════════════════════════════════════════════════════════
  // Category-Specific Form Renderers
  // ═════════════════════════════════════════════════════════════════════════════

  const renderProcessForm = () => html`
    <div class="space-y-6">
      <!-- Title -->
      <div>
        <${TextInput}
          label="Process / SOP Title"
          required=${true}
          value=${title}
          onChange=${(v) => { setTitle(v); setDirty(true); }}
          placeholder="e.g., Weekly Readiness Report Submission Process"
        />
        ${errors.title && html`<p class="text-red-500 text-xs mt-1">${errors.title}</p>`}
      </div>

      <!-- Structured Steps -->
      <div>
        <label class="text-sm font-semibold text-slate-700 block mb-2">Steps</label>
        <div class="space-y-2">
          ${steps.map((step, i) => html`
            <div key=${i} class="flex items-start gap-2 group">
              <span class="flex-shrink-0 w-7 h-9 flex items-center justify-center text-xs font-bold text-blue-600 bg-blue-50 rounded-md border border-blue-200 mt-0.5">
                ${i + 1}
              </span>
              <input
                type="text"
                value=${step}
                onChange=${(e) => updateStep(i, e.target.value)}
                placeholder=${'Step ' + (i + 1) + '...'}
                class="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                       text-slate-700 placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick=${() => moveStep(i, -1)} disabled=${i === 0}
                  class="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move up">
                  <${IconArrowUp} size=${14} />
                </button>
                <button type="button" onClick=${() => moveStep(i, 1)} disabled=${i === steps.length - 1}
                  class="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move down">
                  <${IconArrowDown} size=${14} />
                </button>
                <button type="button" onClick=${() => removeStep(i)}
                  class="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  title="Remove step">
                  <${IconX} size=${14} />
                </button>
              </div>
            </div>
          `)}
        </div>
        <button type="button" onClick=${addStep}
          class="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors">
          <${IconPlus} size=${14} /> Add Step
        </button>
      </div>

      <!-- Key Contacts -->
      <${TextInput}
        label="Key Contacts"
        value=${processContacts}
        onChange=${(v) => { setProcessContacts(v); setDirty(true); }}
        placeholder="Who to contact for questions about this process"
      />

      <!-- Timeline -->
      <${TextInput}
        label="Typical Timeline"
        value=${processTimeline}
        onChange=${(v) => { setProcessTimeline(v); setDirty(true); }}
        placeholder='e.g., "Takes 2-3 business days", "Allow 1 week lead time"'
      />

      <!-- Collapsible free-form notes -->
      <div>
        <button type="button" onClick=${() => setShowProcessNotes(p => !p)}
          class="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            class=${'transition-transform ' + (showProcessNotes ? '' : '-rotate-90')}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
          Additional Notes
          ${processNotes.trim() && html`<span class="text-xs text-slate-400">(has content)</span>`}
        </button>
        ${showProcessNotes && html`
          <div class="mt-2">
            <textarea
              value=${processNotes}
              onChange=${(e) => { setProcessNotes(e.target.value); setDirty(true); }}
              rows=${4}
              placeholder="Any additional context, exceptions, or notes about this process..."
              class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                     text-slate-700 placeholder-slate-400 resize-y font-mono
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        `}
      </div>

      ${renderFileImport()}

      <!-- Tags, Priority, Essential Reading -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div class="sm:col-span-2">${renderTagsRow()}</div>
        <${Select}
          label="Priority"
          value=${priority}
          onChange=${(v) => { setPriority(v); setDirty(true); }}
          options=${PRIORITIES.map(p => ({ value: p.id, label: p.label }))}
        />
      </div>
      <label class="flex items-center gap-2.5 cursor-pointer select-none">
        <input type="checkbox" checked=${essentialReading}
          onChange=${(e) => { setEssentialReading(e.target.checked); setDirty(true); }}
          class="w-4 h-4 rounded border-slate-300 text-navy-700 focus:ring-navy-500" />
        <span class="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <${IconStar} size=${16} className="text-yellow-500" /> Essential Reading
        </span>
        <span class="text-xs text-slate-400">(flags for Start Here list)</span>
      </label>
    </div>
  `;

  const renderStakeholderForm = () => html`
    <div class="space-y-6">
      <!-- Title (name / billet reference) -->
      <div>
        <${TextInput}
          label="Contact Name / Reference"
          required=${true}
          value=${title}
          onChange=${(v) => { setTitle(v); setDirty(true); }}
          placeholder="e.g., G-3 Operations Officer"
        />
        ${errors.title && html`<p class="text-red-500 text-xs mt-1">${errors.title}</p>`}
      </div>

      <!-- Contact Card -->
      <div class="bg-green-50/30 border border-green-200 rounded-lg p-5 space-y-4">
        <!-- Billet Title (prominent) -->
        <div>
          <${TextInput}
            label="Billet Title"
            required=${true}
            value=${meta.billetTitle || ''}
            onChange=${(v) => { updateMeta('billetTitle', v); setDirty(true); }}
            placeholder="e.g., S-3 Operations Officer"
          />
          ${errors.billetTitle && html`<p class="text-red-500 text-xs mt-1">${errors.billetTitle}</p>`}
        </div>

        <!-- Organization -->
        <${TextInput}
          label="Organization"
          value=${meta.organization || ''}
          onChange=${(v) => { updateMeta('organization', v); setDirty(true); }}
          placeholder="e.g., 1st Marine Division G-3"
        />

        <!-- Two-column: Phone | Email -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <${TextInput}
            label="Phone"
            value=${meta.phone || ''}
            onChange=${(v) => { updateMeta('phone', v); setDirty(true); }}
            placeholder="DSN or commercial"
          />
          <${TextInput}
            label="Email"
            value=${meta.email || ''}
            onChange=${(v) => { updateMeta('email', v); setDirty(true); }}
            placeholder="official email"
            type="email"
          />
        </div>

        <!-- Contact Frequency: visual selector buttons -->
        <div>
          <label class="text-sm font-medium text-slate-700 block mb-2">Contact Frequency</label>
          <div class="flex flex-wrap gap-2">
            ${FREQUENCY_OPTIONS.map(opt => html`
              <button key=${opt.value} type="button"
                onClick=${() => { updateMeta('contactFrequency', opt.value); setDirty(true); }}
                class=${'px-3 py-1.5 text-xs font-semibold rounded-full border-2 transition-all '
                  + ((meta.contactFrequency || 'asNeeded') === opt.value
                    ? 'bg-green-100 border-green-500 text-green-800 shadow-sm'
                    : 'border-slate-200 text-slate-500 hover:bg-green-50/50')}>
                ${opt.label}
              </button>
            `)}
          </div>
        </div>

        <!-- Relationship Context -->
        <${TextArea}
          label="Relationship Context"
          value=${meta.relationshipContext || ''}
          onChange=${(v) => { updateMeta('relationshipContext', v); setDirty(true); }}
          placeholder="Why do you contact this person? Under what circumstances? What do they need from you?"
          rows=${3}
        />
      </div>

      <!-- Content (collapsed by default for stakeholders) -->
      <div>
        <button type="button" onClick=${() => setShowProcessNotes(p => !p)}
          class="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            class=${'transition-transform ' + (showProcessNotes ? '' : '-rotate-90')}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
          Additional Notes
          ${content.trim() && html`<span class="text-xs text-slate-400">(has content)</span>`}
        </button>
        ${showProcessNotes && html`
          <div class="mt-2">
            <textarea
              value=${content}
              onChange=${(e) => { setContent(e.target.value); setDirty(true); }}
              rows=${4}
              placeholder="Any additional notes about this stakeholder..."
              class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                     text-slate-700 placeholder-slate-400 resize-y font-mono
                     focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        `}
      </div>

      <!-- Tags auto-suggested + Priority row -->
      ${renderTagsRow()}
      ${renderPriorityEssentialRow()}
    </div>
  `;

  const renderCalendarForm = () => {
    const recurrence = meta.recurrence || 'annual';
    const showMonth = recurrence === 'annual';
    const showDayOfMonth = recurrence === 'annual' || recurrence === 'monthly';
    const prepDays = parseInt(meta.prepLeadDays) || 0;

    return html`
      <div class="space-y-6">
        <!-- Event Name -->
        <div>
          <${TextInput}
            label="Event Name"
            required=${true}
            value=${title}
            onChange=${(v) => { setTitle(v); setDirty(true); }}
            placeholder="e.g., Annual Training Plan Submission"
          />
          ${errors.title && html`<p class="text-red-500 text-xs mt-1">${errors.title}</p>`}
        </div>

        <!-- Event Card -->
        <div class="bg-orange-50/30 border border-orange-200 rounded-lg p-5 space-y-5">
          <!-- Recurrence: visual selector -->
          <div>
            <label class="text-sm font-medium text-slate-700 block mb-2">Recurrence</label>
            <div class="flex flex-wrap gap-2">
              ${RECURRENCE_OPTIONS.map(opt => html`
                <button key=${opt.value} type="button"
                  onClick=${() => { updateMeta('recurrence', opt.value); setDirty(true); }}
                  class=${'px-3 py-1.5 text-xs font-semibold rounded-full border-2 transition-all '
                    + (recurrence === opt.value
                      ? 'bg-orange-100 border-orange-500 text-orange-800 shadow-sm'
                      : 'border-slate-200 text-slate-500 hover:bg-orange-50/50')}>
                  ${opt.label}
                </button>
              `)}
            </div>
          </div>

          <!-- Conditional: Month picker (annual) -->
          ${showMonth && html`
            <${Select}
              label="Month"
              value=${meta.month || ''}
              onChange=${(v) => { updateMeta('month', v); setDirty(true); }}
              options=${MONTH_OPTIONS}
              placeholder="Select month..."
            />
          `}

          <!-- Conditional: Day of month (annual, monthly) -->
          ${showDayOfMonth && html`
            <div>
              <label class="text-sm font-medium text-slate-700 block mb-1">Day of Month</label>
              <input type="number" min="1" max="31"
                value=${meta.dayOfMonth || ''}
                onChange=${(e) => { updateMeta('dayOfMonth', e.target.value); setDirty(true); }}
                placeholder="1-31"
                class="w-32 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                       text-slate-700 placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          `}

          <!-- Duration -->
          <${TextInput}
            label="Duration"
            value=${meta.duration || ''}
            onChange=${(v) => { updateMeta('duration', v); setDirty(true); }}
            placeholder='e.g., "2 weeks", "3 days", "4 hours"'
          />

          <!-- Prep Lead Time with visual indicator -->
          <div>
            <label class="text-sm font-medium text-slate-700 block mb-1">Prep Lead Time</label>
            <div class="flex items-center gap-3">
              <input type="number" min="0"
                value=${meta.prepLeadDays || ''}
                onChange=${(e) => { updateMeta('prepLeadDays', e.target.value); setDirty(true); }}
                placeholder="Days"
                class="w-24 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                       text-slate-700 placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <span class="text-sm text-slate-500">days before event</span>
              ${prepDays > 0 && html`
                <span class=${'text-xs font-medium px-2 py-0.5 rounded-full '
                  + (prepDays >= 14 ? 'bg-red-100 text-red-700' : prepDays >= 7 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700')}>
                  ${prepDays >= 14 ? 'Long lead' : prepDays >= 7 ? 'Medium lead' : 'Short lead'}
                </span>
              `}
            </div>
          </div>
        </div>

        <!-- Description (smaller textarea serves as content) -->
        <${TextArea}
          label="What needs to happen?"
          value=${content}
          onChange=${(v) => { setContent(v); setDirty(true); }}
          placeholder="Describe the event and what actions are required..."
          rows=${4}
        />

        ${renderFileImport()}
        ${renderTagsRow()}
        ${renderPriorityEssentialRow()}
      </div>
    `;
  };

  const renderDecisionForm = () => html`
    <div class="space-y-6">
      <!-- Title -->
      <div>
        <${TextInput}
          label="What was decided?"
          required=${true}
          value=${title}
          onChange=${(v) => { setTitle(v); setDirty(true); }}
          placeholder="e.g., Switched to bi-weekly reporting cadence"
        />
        ${errors.title && html`<p class="text-red-500 text-xs mt-1">${errors.title}</p>`}
      </div>

      <!-- Decision Card -->
      <div class="bg-purple-50/30 border border-purple-200 rounded-lg p-5 space-y-5">
        <!-- Decision Date + Reversible row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div>
            <label class="text-sm font-semibold text-slate-700 block mb-1">Decision Date</label>
            <input type="date"
              value=${meta.decisionDate || ''}
              onChange=${(e) => { updateMeta('decisionDate', e.target.value); setDirty(true); }}
              class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                     text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div>
            <label class="flex items-center gap-3 cursor-pointer select-none py-2">
              <div class="relative">
                <input type="checkbox" checked=${meta.reversible || false}
                  onChange=${(e) => { updateMeta('reversible', e.target.checked); setDirty(true); }}
                  class="sr-only peer" />
                <div class="w-10 h-6 bg-slate-200 peer-checked:bg-purple-500 rounded-full transition-colors" />
                <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
              </div>
              <span class="text-sm font-medium text-slate-700">Reversible?</span>
              <span class="text-xs text-slate-400">(can this decision be undone?)</span>
            </label>
          </div>
        </div>

        <!-- The Decision -->
        <${TextArea}
          label="The Decision"
          value=${decisionText}
          onChange=${(v) => { setDecisionText(v); setDirty(true); }}
          placeholder="Describe what was decided in detail..."
          rows=${3}
        />

        <!-- Alternatives Considered -->
        <${TextArea}
          label="Alternatives Considered"
          value=${decisionAlternatives}
          onChange=${(v) => { setDecisionAlternatives(v); setDirty(true); }}
          placeholder="What other options were on the table?"
          rows=${3}
        />

        <!-- Rationale -->
        <${TextArea}
          label="Rationale"
          value=${decisionRationale}
          onChange=${(v) => { setDecisionRationale(v); setDirty(true); }}
          placeholder="Why was this path chosen?"
          rows=${3}
        />

        <!-- Impact -->
        <${TextArea}
          label="Impact"
          value=${decisionImpact}
          onChange=${(v) => { setDecisionImpact(v); setDirty(true); }}
          placeholder="What changed as a result of this decision?"
          rows=${3}
        />
      </div>

      ${renderFileImport()}
      ${renderTagsRow()}
      ${renderPriorityEssentialRow()}
    </div>
  `;

  const renderLessonForm = () => html`
    <div class="space-y-6">
      <!-- Title -->
      <div>
        <${TextInput}
          label="The lesson in one sentence"
          required=${true}
          value=${title}
          onChange=${(v) => { setTitle(v); setDirty(true); }}
          placeholder="e.g., Never assume the POC list is current"
        />
        ${errors.title && html`<p class="text-red-500 text-xs mt-1">${errors.title}</p>`}
      </div>

      <!-- Lesson Card -->
      <div class="bg-yellow-50/30 border border-yellow-300 rounded-lg p-5 space-y-5">
        <!-- What happened? -->
        <${TextArea}
          label="What happened?"
          value=${lessonWhat}
          onChange=${(v) => { setLessonWhat(v); setDirty(true); }}
          placeholder="Describe the situation that led to this lesson..."
          rows=${4}
        />

        <!-- What did you learn? -->
        <${TextArea}
          label="What did you learn?"
          value=${lessonTakeaway}
          onChange=${(v) => { setLessonTakeaway(v); setDirty(true); }}
          placeholder="What is the key takeaway?"
          rows=${3}
        />

        <!-- How to avoid/apply this -->
        <${TextArea}
          label="How to avoid/apply this"
          value=${lessonApply}
          onChange=${(v) => { setLessonApply(v); setDirty(true); }}
          placeholder="What should your successor do differently?"
          rows=${3}
        />
      </div>

      ${renderFileImport()}
      ${renderTagsRow()}
      ${renderPriorityEssentialRow()}
    </div>
  `;

  const renderIssueForm = () => {
    const statusColors = {
      open: 'bg-blue-100 border-blue-500 text-blue-800',
      'in-progress': 'bg-amber-100 border-amber-500 text-amber-800',
      blocked: 'bg-red-100 border-red-500 text-red-800',
      resolved: 'bg-green-100 border-green-500 text-green-800',
    };
    const urgencyColors = {
      high: 'bg-red-100 border-red-500 text-red-800',
      medium: 'bg-amber-100 border-amber-500 text-amber-800',
      low: 'bg-green-100 border-green-500 text-green-800',
    };

    return html`
      <div class="space-y-6">
        <!-- Title -->
        <div>
          <${TextInput}
            label="Issue Summary"
            required=${true}
            value=${title}
            onChange=${(v) => { setTitle(v); setDirty(true); }}
            placeholder="e.g., SIPR token readers failing intermittently in Bldg 2100"
          />
          ${errors.title && html`<p class="text-red-500 text-xs mt-1">${errors.title}</p>`}
        </div>

        <!-- Issue Card -->
        <div class="bg-red-50/20 border border-red-200 rounded-lg p-5 space-y-5">
          <!-- Status: visual selector -->
          <div>
            <label class="text-sm font-medium text-slate-700 block mb-2">Status</label>
            <div class="flex flex-wrap gap-2">
              ${ISSUE_STATUS_OPTIONS.map(opt => html`
                <button key=${opt.value} type="button"
                  onClick=${() => { updateMeta('status', opt.value); setDirty(true); }}
                  class=${'px-3 py-1.5 text-xs font-semibold rounded-full border-2 transition-all '
                    + ((meta.status || 'open') === opt.value
                      ? statusColors[opt.value] + ' shadow-sm'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                  ${opt.label}
                </button>
              `)}
            </div>
          </div>

          <!-- Urgency: visual selector -->
          <div>
            <label class="text-sm font-medium text-slate-700 block mb-2">Urgency</label>
            <div class="flex flex-wrap gap-2">
              ${URGENCY_OPTIONS.map(opt => html`
                <button key=${opt.value} type="button"
                  onClick=${() => { updateMeta('urgency', opt.value); setDirty(true); }}
                  class=${'px-3 py-1.5 text-xs font-semibold rounded-full border-2 transition-all '
                    + ((meta.urgency || 'medium') === opt.value
                      ? urgencyColors[opt.value] + ' shadow-sm'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                  ${opt.label}
                </button>
              `)}
            </div>
          </div>

          <!-- Opened Date -->
          <div>
            <label class="text-sm font-medium text-slate-700 block mb-1">Opened Date</label>
            <input type="date"
              value=${meta.openedDate || ''}
              onChange=${(e) => { updateMeta('openedDate', e.target.value); setDirty(true); }}
              class="w-full sm:w-48 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm
                     text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <!-- Background -->
          <${TextArea}
            label="Background"
            value=${issueBackground}
            onChange=${(v) => { setIssueBackground(v); setDirty(true); }}
            placeholder="What caused this issue? What's the context?"
            rows=${3}
          />

          <!-- Current Status -->
          <${TextArea}
            label="Current Status"
            value=${issueCurrentStatus}
            onChange=${(v) => { setIssueCurrentStatus(v); setDirty(true); }}
            placeholder="Where does this stand right now?"
            rows=${3}
          />

          <!-- Next Steps -->
          <${TextArea}
            label="Next Steps"
            value=${issueNextSteps}
            onChange=${(v) => { setIssueNextSteps(v); setDirty(true); }}
            placeholder="What needs to happen next?"
            rows=${3}
          />

          <!-- Related Stakeholders -->
          <${TextInput}
            label="Related Stakeholders"
            value=${meta.relatedStakeholders || ''}
            onChange=${(v) => { updateMeta('relatedStakeholders', v); setDirty(true); }}
            placeholder="Who is involved? (comma-separated)"
          />
        </div>

        ${renderFileImport()}
        ${renderTagsRow()}
        ${renderPriorityEssentialRow()}
      </div>
    `;
  };

  // ─── Fallback: generic form for any category without a specific layout ────

  const renderGenericForm = () => html`
    <div class="space-y-6">
      <div>
        <${TextInput}
          label="Title"
          required=${true}
          value=${title}
          onChange=${(v) => { setTitle(v); setDirty(true); }}
          placeholder="Descriptive title for this entry..."
        />
        ${errors.title && html`<p class="text-red-500 text-xs mt-1">${errors.title}</p>`}
      </div>
      ${renderFileImport()}
      ${renderGenericContentEditor('Content', 'Write your knowledge here... Markdown is supported.', 10)}
      ${renderTagsRow()}
      ${renderPriorityEssentialRow()}
    </div>
  `;

  // ─── Category form dispatcher ────────────────────────────────────────────

  const renderCategoryForm = () => {
    switch (category) {
      case 'process':     return renderProcessForm();
      case 'stakeholder': return renderStakeholderForm();
      case 'calendar':    return renderCalendarForm();
      case 'decision':    return renderDecisionForm();
      case 'lesson':      return renderLessonForm();
      case 'issue':       return renderIssueForm();
      default:            return renderGenericForm();
    }
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

      <!-- Category-Specific Form -->
      <div class=${'bg-white rounded-lg border-2 shadow-sm ' + formBorder}>
        <div class=${'p-6 ' + formBgTint}>
          ${renderCategoryForm()}
        </div>
      </div>

      <!-- AI Assist -->
      <${AIAssistPanel}
        title=${title}
        content=${assembleContent()}
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

