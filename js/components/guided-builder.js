// ─── Guided Knowledge Base Builder ─────────────────────────────────────────
// AI-guided wizard that walks users through building their entire KB via
// structured interview. Works with or without the local AI model loaded.

import { html } from '../core/config.js';
import { useApp } from './app.js';
import AIService from '../core/ai-service.js';
import WebLLMService from '../core/webllm-service.js';
import { Button, TextArea, TextInput, Badge, Card, ProgressBar, showToast } from '../shared/ui.js';
import { MarkdownPreview } from '../shared/markdown.js';

const { useState, useCallback, useRef, useEffect, useMemo } = React;

// ─── JSON Parse Helper ─────────────────────────────────────────────────────

function parseJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { /* fall through */ }

  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (_) { /* fall through */ }
  }

  const bracketIdx = text.search(/[\[{]/);
  if (bracketIdx >= 0) {
    const slice = text.slice(bracketIdx);
    try { return JSON.parse(slice); } catch (_) { /* fall through */ }
    // Try to find the last matching bracket
    const opener = slice[0];
    const closer = opener === '[' ? ']' : '}';
    const lastIdx = slice.lastIndexOf(closer);
    if (lastIdx > 0) {
      try { return JSON.parse(slice.slice(0, lastIdx + 1)); } catch (_) { /* fall through */ }
    }
  }

  return null;
}

// ─── Step Definitions ──────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'billet',
    label: 'Billet Setup',
    category: null,
    icon: '\u{1F3DB}',
    prompt: "Let's start by capturing your billet information. This is the foundation everything else builds on.",
    questions: [
      { key: 'title', label: "What's your billet title?", placeholder: 'e.g., Operations Officer, S-3, Training NCO' },
      { key: 'unit', label: 'What unit are you in?', placeholder: 'e.g., 1st Battalion, 5th Marines' },
      { key: 'mission', label: 'Describe your mission in one or two sentences.', placeholder: 'What is the core purpose of your billet?', multiline: true },
    ],
  },
  {
    id: 'processes',
    label: 'Key Processes',
    category: 'process',
    icon: '\u{1F4CB}',
    prompt: "Now let's capture your core processes. Think about the 3-5 most important procedures you perform regularly. What are the things that, if your successor didn't know how to do them, would cause the most disruption?",
    aiPrompt: (text) => `Based on the user's description below, create knowledge base entries for the "process" category. For each distinct process mentioned, create a separate entry with step-by-step instructions, key contacts (by billet title only, no personal names), common pitfalls, and any relevant timelines.

Return ONLY a JSON array where each object has:
- "title": short descriptive title
- "content": detailed markdown content with headings, numbered steps, and notes
- "tags": array of 2-4 lowercase tags
- "priority": "high", "medium", or "low"

User's description:
${text}

Return ONLY the JSON array, no other text.`,
    placeholder: "Describe your key processes. For example:\n- Weekly operations brief: I compile inputs from all sections by Wednesday, brief the CO on Thursday...\n- Travel request workflow: All travel goes through me first, I validate funding...\n- Equipment accountability: Monthly inventories on the 1st, GCSS-MC reconciliation...",
  },
  {
    id: 'stakeholders',
    label: 'Stakeholders',
    category: 'stakeholder',
    icon: '\u{1F465}',
    prompt: "Who are the key people and offices you interact with? Think about your chain of command, adjacent offices, external liaisons, and anyone your successor needs to know about. Use billet titles, not personal names.",
    aiPrompt: (text) => `Based on the user's description below, create knowledge base entries for the "stakeholder" category. For each person/office mentioned, create a separate entry.

Return ONLY a JSON array where each object has:
- "title": the billet title or office name
- "content": markdown description of the relationship, coordination frequency, and context
- "tags": array of 2-4 lowercase tags
- "priority": "high", "medium", or "low"
- "meta": { "billetTitle": string, "organization": string, "contactFrequency": "daily"|"weekly"|"monthly"|"quarterly"|"annually"|"asNeeded", "relationshipContext": string }

User's description:
${text}

Return ONLY the JSON array, no other text.`,
    placeholder: "List the people/offices you interact with most. For example:\n- Battalion S-1: coordinate weekly on personnel actions, attend their Thursday sync\n- Regimental Operations Officer: my direct boss, daily check-ins, approves all training plans\n- Range Control: monthly coordination for range bookings, need 30-day lead time\n- Division G-3 Training: quarterly reporting on training metrics",
  },
  {
    id: 'calendar',
    label: 'Calendar Events',
    category: 'calendar',
    icon: '\u{1F4C5}',
    prompt: "What are the major recurring deadlines and events in your annual cycle? Think about reporting deadlines, inspections, training events, budget cycles, and anything your successor needs to have on their calendar from day one.",
    aiPrompt: (text) => `Based on the user's description below, create knowledge base entries for the "calendar" category. For each recurring event or deadline mentioned, create a separate entry with timing, preparation requirements, and key details.

Return ONLY a JSON array where each object has:
- "title": event or deadline name
- "content": markdown description including what it is, who's involved, how to prepare, and what "right" looks like
- "tags": array of 2-4 lowercase tags
- "priority": "high", "medium", or "low"
- "meta": { "recurrence": "annual"|"quarterly"|"monthly"|"weekly"|"oneTime", "month": string (1-12 if applicable), "prepLeadDays": string (number of days to start prep) }

User's description:
${text}

Return ONLY the JSON array, no other text.`,
    placeholder: "List your recurring events and deadlines. For example:\n- Annual training plan due to Regiment in October, start building in August\n- Quarterly readiness brief to the CO, first week of Jan/Apr/Jul/Oct\n- Monthly GCSS-MC reconciliation, due NLT the 5th\n- CBRN inspection every spring, prep starts 60 days out\n- FY budget submission in June, requires coordination with S-4 starting in April",
  },
  {
    id: 'decisions',
    label: 'Key Decisions',
    category: 'decision',
    icon: '\u{2696}',
    prompt: "What are the 2-3 most important decisions you've made that your successor needs to understand? Include not just what you decided, but WHY, what alternatives you considered, and what the outcome was.",
    aiPrompt: (text) => `Based on the user's description below, create knowledge base entries for the "decision" category. For each decision mentioned, create a detailed entry explaining the context, alternatives considered, rationale, and outcome.

Return ONLY a JSON array where each object has:
- "title": short decision title
- "content": markdown content with sections for Context, Alternatives Considered, Decision & Rationale, Outcome, and Lessons Learned
- "tags": array of 2-4 lowercase tags
- "priority": "high", "medium", or "low"
- "meta": { "decisionDate": string (if mentioned), "alternativesConsidered": string, "outcomeRationale": string, "reversible": boolean }

User's description:
${text}

Return ONLY the JSON array, no other text.`,
    placeholder: "Describe important decisions you've made. For example:\n- Switched from manual tracking to GCSS-MC for all supply requests. The old system was causing 2-week delays. Considered keeping paper backup but decided full digital was worth the training cost. Reduced processing time by 60%.\n- Reorganized the watch schedule from 8-hour to 12-hour shifts. Marines were burning out on 8s because of transit time. Considered 6-hour but manning wouldn't support it.",
  },
  {
    id: 'lessons',
    label: 'Lessons & Gotchas',
    category: 'lesson',
    icon: '\u{1F4A1}',
    prompt: "What are the things you wish someone had told you on day one? The unwritten rules, the gotchas, the tribal knowledge that isn't in any SOP. These are often the most valuable entries in a turnover.",
    aiPrompt: (text) => `Based on the user's description below, create knowledge base entries for the "lesson" category. Each lesson should be specific, actionable, and capture institutional knowledge that isn't written down anywhere.

Return ONLY a JSON array where each object has:
- "title": short, memorable lesson title
- "content": markdown content explaining the lesson, why it matters, what happens if you don't know this, and any specific tips
- "tags": array of 2-4 lowercase tags
- "priority": "high", "medium", or "low"

User's description:
${text}

Return ONLY the JSON array, no other text.`,
    placeholder: "What do you wish you'd known on day one? For example:\n- The CO hates surprises. Always give a heads-up before any bad news goes up the chain, even informally.\n- The printer in Bldg 1234 is the only one that prints FOUO cover sheets correctly.\n- Never schedule anything during the S-3's Thursday planning meeting. It's sacred.\n- The real deadline for reports to Regiment is always 2 days before the \"official\" deadline.\n- The access request for System X takes 45 days, not 30 like the SOP says. Start immediately.",
  },
  {
    id: 'issues',
    label: 'Active Issues',
    category: 'issue',
    icon: '\u{1F6A8}',
    prompt: "What's currently on fire or in progress that needs continuity? Open problems, ongoing projects, things that are broken but being worked. Your successor needs to pick these up without dropping anything.",
    aiPrompt: (text) => `Based on the user's description below, create knowledge base entries for the "issue" category. Each issue should capture the current status, what's been tried, who's involved, and what needs to happen next.

Return ONLY a JSON array where each object has:
- "title": issue title
- "content": markdown content with sections for Current Status, Background, Actions Taken, Next Steps, and Key POCs (by billet title)
- "tags": array of 2-4 lowercase tags
- "priority": "high", "medium", or "low"
- "meta": { "status": "open"|"in-progress"|"blocked", "urgency": "high"|"medium"|"low", "relatedStakeholders": string }

User's description:
${text}

Return ONLY the JSON array, no other text.`,
    placeholder: "What's currently in progress or needs attention? For example:\n- Vehicle 2B is deadlined waiting on a part from depot. ETA 3 weeks. S-4 is tracking but needs weekly check-ins.\n- The new armory access system is half-implemented. Working with PMO to finish. Target completion: end of month.\n- Three Marines are pending transfer actions that are stuck at IPAC. The Personnel Officer is our POC, follow up every Monday.\n- Building leak in the operations center still unfixed. Put in work order #4567 two months ago. Escalate to Facilities if not resolved by next week.",
  },
  {
    id: 'summary',
    label: 'Summary',
    category: null,
    icon: '\u{2705}',
    prompt: null,
    questions: null,
  },
];

// ─── Step Indicator ────────────────────────────────────────────────────────

function StepIndicator({ currentStep, totalSteps, stepLabel }) {
  const pct = Math.round(((currentStep) / (totalSteps - 1)) * 100);

  return html`
    <div class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-semibold text-navy-700">
          Step ${currentStep + 1} of ${totalSteps}: ${stepLabel}
        </span>
        <span class="text-xs text-slate-500">${pct}% complete</span>
      </div>
      <${ProgressBar} value=${pct} color="bg-olive-500" height="h-2.5" />
      <div class="flex justify-between mt-2">
        ${STEPS.map((s, i) => html`
          <div key=${s.id}
            class=${'flex flex-col items-center ' + (i <= currentStep ? 'text-olive-600' : 'text-slate-300')}>
            <div class=${'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ' +
              (i === currentStep ? 'bg-olive-600 text-white ring-2 ring-olive-300' :
               i < currentStep ? 'bg-olive-500 text-white' :
               'bg-slate-200 text-slate-400')}>
              ${i < currentStep ? '\u2713' : i + 1}
            </div>
            <span class="text-[10px] mt-1 hidden sm:block">${s.label}</span>
          </div>
        `)}
      </div>
    </div>
  `;
}

// ─── AI Callout Box ────────────────────────────────────────────────────────

function AICallout({ children, aiAvailable }) {
  return html`
    <div class="relative rounded-lg border-2 border-olive-200 bg-gradient-to-br from-olive-50 to-emerald-50 p-5 mb-6">
      <div class="flex gap-3">
        <div class="flex-shrink-0 w-10 h-10 rounded-full bg-olive-600 flex items-center justify-center shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
            <circle cx="9" cy="15" r="1" />
            <circle cx="15" cy="15" r="1" />
            <path d="M9 18h6" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-sm font-semibold text-olive-800">Passdown AI</span>
            ${aiAvailable
              ? html`<${Badge} color="green">Model Loaded<//>`
              : html`<${Badge} color="gray">Manual Mode<//>`
            }
          </div>
          <div class="text-sm text-olive-900 leading-relaxed">
            ${children}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Approval Card ─────────────────────────────────────────────────────────

function ApprovalCard({ entry, index, onApprove, onEdit, onSkip, isEditing, editTitle, editContent, onEditTitleChange, onEditContentChange, onSaveEdit, onCancelEdit }) {
  const priorityColors = { high: 'red', medium: 'yellow', low: 'gray' };

  if (isEditing) {
    return html`
      <${Card} className="p-4 border-olive-300 bg-olive-50/50 mb-3">
        <div class="space-y-3">
          <${TextInput}
            value=${editTitle}
            onChange=${onEditTitleChange}
            label="Title"
            placeholder="Entry title"
          />
          <${TextArea}
            value=${editContent}
            onChange=${onEditContentChange}
            label="Content (Markdown)"
            rows=${8}
            placeholder="Entry content..."
          />
          <div class="flex gap-2 justify-end">
            <${Button} variant="ghost" size="sm" onClick=${onCancelEdit}>Cancel<//>
            <${Button} variant="primary" size="sm" onClick=${onSaveEdit}>Save Changes<//>
          </div>
        </div>
      <//>
    `;
  }

  return html`
    <${Card} className="p-4 mb-3 hover:border-olive-300 transition-colors">
      <div class="flex items-start justify-between gap-3 mb-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-sm font-semibold text-navy-900 truncate">${entry.title}</span>
          <${Badge} color=${priorityColors[entry.priority] || 'gray'}>${entry.priority || 'medium'}<//>
        </div>
        <span class="text-xs text-slate-400 flex-shrink-0">#${index + 1}</span>
      </div>
      <div class="mb-3 max-h-40 overflow-y-auto">
        <${MarkdownPreview} content=${(entry.content || '').slice(0, 500) + ((entry.content || '').length > 500 ? '\n\n*...truncated for preview*' : '')} />
      </div>
      ${entry.tags && entry.tags.length > 0 && html`
        <div class="flex flex-wrap gap-1 mb-3">
          ${entry.tags.map(t => html`<${Badge} key=${t} color="navy">${t}<//>`)}
        </div>
      `}
      <div class="flex gap-2 justify-end border-t border-slate-100 pt-3">
        <${Button} variant="ghost" size="sm" onClick=${onSkip}>
          Skip
        <//>
        <${Button} variant="secondary" size="sm" onClick=${onEdit}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          Edit
        <//>
        <${Button} variant="success" size="sm" onClick=${onApprove}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          Add to KB
        <//>
      </div>
    <//>
  `;
}

// ─── Manual Entry Card (when AI is not loaded) ─────────────────────────────

function ManualEntryCard({ category, onAdd }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleAdd = useCallback(() => {
    if (!title.trim()) {
      showToast('Please enter a title', 'warning');
      return;
    }
    onAdd({
      title: title.trim(),
      content: content.trim(),
      category,
      tags: [],
      priority: 'medium',
      meta: {},
    });
    setTitle('');
    setContent('');
  }, [title, content, category, onAdd]);

  return html`
    <${Card} className="p-4 mb-3 border-dashed border-2 border-slate-300">
      <div class="space-y-3">
        <${TextInput}
          value=${title}
          onChange=${setTitle}
          label="Entry Title"
          placeholder=${'e.g., ' + (category === 'process' ? 'Weekly Operations Brief' : category === 'stakeholder' ? 'Battalion S-1' : category === 'calendar' ? 'Quarterly Readiness Brief' : category === 'decision' ? 'Shift Schedule Change' : category === 'lesson' ? 'Deadline Buffer Rule' : 'Vehicle 2B Deadlined')}
          required
        />
        <${TextArea}
          value=${content}
          onChange=${setContent}
          label="Content (Markdown)"
          rows=${5}
          placeholder="Describe this entry in detail. Use markdown for formatting."
        />
        <div class="flex justify-end">
          <${Button} variant="primary" size="sm" onClick=${handleAdd} disabled=${!title.trim()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
            Add Entry
          <//>
        </div>
      </div>
    <//>
  `;
}

// ─── Billet Setup Step ─────────────────────────────────────────────────────

function BilletStep({ onComplete, existingBillet }) {
  const [title, setTitle] = useState(existingBillet?.title || '');
  const [unit, setUnit] = useState(existingBillet?.unit || '');
  const [mission, setMission] = useState(existingBillet?.billetDescription || '');
  const aiAvailable = AIService.isAvailable();

  const step = STEPS[0];
  const canProceed = title.trim() && unit.trim();

  return html`
    <div>
      <${AICallout} aiAvailable=${aiAvailable}>
        ${step.prompt}
      <//>

      <div class="space-y-4">
        ${step.questions.map(q => {
          const val = q.key === 'title' ? title : q.key === 'unit' ? unit : mission;
          const setter = q.key === 'title' ? setTitle : q.key === 'unit' ? setUnit : setMission;
          return q.multiline
            ? html`<${TextArea} key=${q.key} value=${val} onChange=${setter} label=${q.label} placeholder=${q.placeholder} rows=${3} />`
            : html`<${TextInput} key=${q.key} value=${val} onChange=${setter} label=${q.label} placeholder=${q.placeholder} />`;
        })}
      </div>

      <div class="flex justify-end mt-6">
        <${Button}
          variant="primary"
          onClick=${() => onComplete({ title: title.trim(), unit: unit.trim(), billetDescription: mission.trim() })}
          disabled=${!canProceed}
        >
          Save & Continue
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        <//>
      </div>
    </div>
  `;
}

// ─── Generic Entry Step (AI + Manual) ──────────────────────────────────────

function EntryStep({ step, onEntryAdded }) {
  const [userInput, setUserInput] = useState('');
  const [generatedEntries, setGeneratedEntries] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [editingIdx, setEditingIdx] = useState(-1);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [approvedCount, setApprovedCount] = useState(0);

  const aiAvailable = AIService.isAvailable();

  // Generate entries from user description via AI
  const handleGenerate = useCallback(async () => {
    if (!userInput.trim()) {
      showToast('Please describe your entries first', 'warning');
      return;
    }

    setGenerating(true);
    setStreamText('');
    setGeneratedEntries([]);

    try {
      const prompt = step.aiPrompt(userInput.trim());
      let resultText = '';

      // Try streaming first
      if (WebLLMService.isAvailable()) {
        try {
          resultText = await WebLLMService.chatStream(
            [{ role: 'user', content: prompt }],
            'You are a helpful assistant that creates knowledge base entries. Return ONLY valid JSON. No explanatory text outside the JSON.',
            (partial) => { setStreamText(partial); }
          );
        } catch (streamErr) {
          console.warn('[GuidedBuilder] Stream failed, falling back to generate:', streamErr.message);
          resultText = await AIService._generate(prompt);
        }
      } else {
        resultText = await AIService._generate(prompt);
      }

      if (!resultText) {
        showToast('AI did not return a response. Try adding more detail, or add entries manually below.', 'warning');
        setGenerating(false);
        return;
      }

      // Parse the JSON response
      let parsed = parseJSON(resultText);

      // Normalize to array
      if (parsed && !Array.isArray(parsed)) {
        parsed = [parsed];
      }

      if (parsed && parsed.length > 0) {
        // Validate each entry has minimum fields
        const valid = parsed
          .filter(e => e && typeof e === 'object' && e.title)
          .map(e => ({
            title: String(e.title || '').trim(),
            content: String(e.content || '').trim(),
            category: step.category,
            tags: Array.isArray(e.tags) ? e.tags.filter(t => typeof t === 'string').map(t => t.toLowerCase().trim()) : [],
            priority: ['high', 'medium', 'low'].includes(e.priority) ? e.priority : 'medium',
            meta: e.meta && typeof e.meta === 'object' ? e.meta : {},
          }));

        if (valid.length > 0) {
          setGeneratedEntries(valid);
          showToast(`Generated ${valid.length} ${valid.length === 1 ? 'entry' : 'entries'}. Review and approve each one.`, 'success');
        } else {
          // Fallback: create a single entry from the raw text
          setGeneratedEntries([{
            title: `${step.label} Notes`,
            content: resultText.trim(),
            category: step.category,
            tags: [],
            priority: 'medium',
            meta: {},
          }]);
          showToast('AI response was not structured JSON. Created a single entry from the response. Edit as needed.', 'warning');
        }
      } else {
        // Fallback: create a single entry from raw text
        setGeneratedEntries([{
          title: `${step.label} Notes`,
          content: resultText.trim(),
          category: step.category,
          tags: [],
          priority: 'medium',
          meta: {},
        }]);
        showToast('Could not parse structured entries. Created a single entry. Edit as needed.', 'warning');
      }
    } catch (err) {
      console.error('[GuidedBuilder] Generation error:', err);
      showToast('AI generation failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setGenerating(false);
      setStreamText('');
    }
  }, [userInput, step]);

  const handleApprove = useCallback((entry) => {
    onEntryAdded(entry);
    setGeneratedEntries(prev => prev.filter(e => e !== entry));
    setApprovedCount(c => c + 1);
  }, [onEntryAdded]);

  const handleSkip = useCallback((entry) => {
    setGeneratedEntries(prev => prev.filter(e => e !== entry));
  }, []);

  const handleStartEdit = useCallback((idx) => {
    const entry = generatedEntries[idx];
    setEditingIdx(idx);
    setEditTitle(entry.title);
    setEditContent(entry.content);
  }, [generatedEntries]);

  const handleSaveEdit = useCallback(() => {
    if (editingIdx < 0) return;
    setGeneratedEntries(prev => {
      const updated = [...prev];
      updated[editingIdx] = {
        ...updated[editingIdx],
        title: editTitle.trim(),
        content: editContent.trim(),
      };
      return updated;
    });
    setEditingIdx(-1);
  }, [editingIdx, editTitle, editContent]);

  const handleCancelEdit = useCallback(() => {
    setEditingIdx(-1);
  }, []);

  const handleManualAdd = useCallback((entry) => {
    onEntryAdded(entry);
    setApprovedCount(c => c + 1);
  }, [onEntryAdded]);

  return html`
    <div>
      <${AICallout} aiAvailable=${aiAvailable}>
        ${step.prompt}
      <//>

      ${approvedCount > 0 && html`
        <div class="mb-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          <span>${approvedCount} ${approvedCount === 1 ? 'entry' : 'entries'} added to your knowledge base</span>
        </div>
      `}

      <!-- User Input Area -->
      <div class="mb-4">
        <${TextArea}
          value=${userInput}
          onChange=${setUserInput}
          placeholder=${step.placeholder || 'Describe your entries here...'}
          rows=${6}
          label="Your Description"
        />
      </div>

      <!-- Generate Button (AI) or hint -->
      ${aiAvailable ? html`
        <div class="flex items-center gap-3 mb-6">
          <${Button}
            variant="primary"
            onClick=${handleGenerate}
            disabled=${generating || !userInput.trim()}
          >
            ${generating ? html`
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Generating...
            ` : html`
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg>
              Generate Entries
            `}
          <//>
          <span class="text-xs text-slate-500">AI will draft entries from your description. You review and approve each one.</span>
        </div>
      ` : html`
        <div class="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>Manual mode:</strong> AI model not loaded. Use the form below to add entries one at a time, or go to Settings to download a model for AI-assisted generation.
        </div>
      `}

      <!-- Streaming preview -->
      ${generating && streamText && html`
        <${Card} className="p-4 mb-4 border-olive-200 bg-olive-50/30">
          <div class="flex items-center gap-2 mb-2 text-xs text-olive-600">
            <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            AI is generating...
          </div>
          <div class="text-xs text-slate-600 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">${streamText.slice(-500)}</div>
        <//>
      `}

      <!-- Generated Entry Approval Cards -->
      ${generatedEntries.length > 0 && html`
        <div class="mb-4">
          <h3 class="text-sm font-semibold text-navy-700 mb-3">
            Review Generated Entries (${generatedEntries.length} remaining)
          </h3>
          ${generatedEntries.map((entry, idx) => html`
            <${ApprovalCard}
              key=${entry.title + idx}
              entry=${entry}
              index=${idx}
              onApprove=${() => handleApprove(entry)}
              onEdit=${() => handleStartEdit(idx)}
              onSkip=${() => handleSkip(entry)}
              isEditing=${editingIdx === idx}
              editTitle=${editTitle}
              editContent=${editContent}
              onEditTitleChange=${setEditTitle}
              onEditContentChange=${setEditContent}
              onSaveEdit=${handleSaveEdit}
              onCancelEdit=${handleCancelEdit}
            />
          `)}
          <div class="flex gap-2 mb-4">
            <${Button} variant="success" size="sm" onClick=${() => {
              generatedEntries.forEach(e => onEntryAdded(e));
              setApprovedCount(c => c + generatedEntries.length);
              setGeneratedEntries([]);
              showToast(`Added all ${generatedEntries.length} entries`, 'success');
            }}>
              Approve All Remaining
            <//>
            <${Button} variant="ghost" size="sm" onClick=${() => {
              setGeneratedEntries([]);
              showToast('Skipped remaining entries', 'info');
            }}>
              Skip All
            <//>
          </div>
        </div>
      `}

      <!-- Manual Entry Form (always available) -->
      <div class="border-t border-slate-200 pt-4 mt-4">
        <h3 class="text-sm font-semibold text-slate-600 mb-3">
          ${aiAvailable ? 'Or add entries manually:' : 'Add entries:'}
        </h3>
        <${ManualEntryCard}
          category=${step.category}
          onAdd=${handleManualAdd}
        />
      </div>
    </div>
  `;
}

// ─── Summary Step ──────────────────────────────────────────────────────────

function SummaryStep({ entriesByStep, billet }) {
  const { entries, navigate } = useApp();

  const totalAdded = Object.values(entriesByStep).reduce((sum, arr) => sum + arr.length, 0);

  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const [stepId, stepEntries] of Object.entries(entriesByStep)) {
      const step = STEPS.find(s => s.id === stepId);
      if (step && step.category) {
        counts[step.category] = (counts[step.category] || 0) + stepEntries.length;
      }
    }
    return counts;
  }, [entriesByStep]);

  const categoryLabels = {
    process: 'Processes',
    stakeholder: 'Stakeholders',
    calendar: 'Calendar Events',
    decision: 'Decisions',
    lesson: 'Lessons',
    issue: 'Active Issues',
  };

  const categoryColors = {
    process: 'blue',
    stakeholder: 'green',
    calendar: 'orange',
    decision: 'purple',
    lesson: 'yellow',
    issue: 'red',
  };

  // Simple readiness calculation
  const readiness = useMemo(() => {
    let score = 0;
    if (billet?.title) score += 10;
    if (billet?.unit) score += 5;
    if (billet?.billetDescription) score += 5;
    if (categoryCounts.process) score += Math.min(25, categoryCounts.process * 8);
    if (categoryCounts.stakeholder) score += Math.min(15, categoryCounts.stakeholder * 3);
    if (categoryCounts.calendar) score += Math.min(15, categoryCounts.calendar * 5);
    if (categoryCounts.decision) score += Math.min(10, categoryCounts.decision * 5);
    if (categoryCounts.lesson) score += Math.min(10, categoryCounts.lesson * 5);
    if (categoryCounts.issue) score += Math.min(10, categoryCounts.issue * 5);
    return Math.min(100, score);
  }, [billet, categoryCounts]);

  const gradeFromScore = (s) => {
    if (s >= 90) return { grade: 'A', color: 'text-green-600', bg: 'bg-green-100' };
    if (s >= 75) return { grade: 'B', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (s >= 60) return { grade: 'C', color: 'text-amber-600', bg: 'bg-amber-100' };
    if (s >= 40) return { grade: 'D', color: 'text-orange-600', bg: 'bg-orange-100' };
    return { grade: 'F', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const g = gradeFromScore(readiness);

  return html`
    <div>
      <${AICallout} aiAvailable=${AIService.isAvailable()}>
        ${totalAdded > 0
          ? "Great work! Here's a summary of what you've built. Your knowledge base is taking shape."
          : "It looks like you haven't added any entries yet. You can always come back to the guided builder later, or add entries directly from the Capture page."
        }
      <//>

      <!-- Score Card -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <${Card} className="p-6 text-center">
          <div class="text-4xl font-bold text-navy-700 mb-1">${totalAdded}</div>
          <div class="text-sm text-slate-500">Entries Created</div>
        <//>
        <${Card} className="p-6 text-center">
          <div class="text-4xl font-bold text-navy-700 mb-1">${entries.length}</div>
          <div class="text-sm text-slate-500">Total KB Entries</div>
        <//>
        <${Card} className="p-6 text-center">
          <div class=${'text-4xl font-bold mb-1 ' + g.color}>${g.grade}</div>
          <div class="text-sm text-slate-500">Readiness Grade</div>
          <${ProgressBar} value=${readiness} color=${readiness >= 75 ? 'bg-green-500' : readiness >= 50 ? 'bg-amber-500' : 'bg-red-500'} className="mt-2" />
          <div class="text-xs text-slate-400 mt-1">${readiness}%</div>
        <//>
      </div>

      <!-- Category Breakdown -->
      ${totalAdded > 0 && html`
        <${Card} className="p-5 mb-6">
          <h3 class="text-sm font-semibold text-navy-700 mb-4">Entries by Category</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            ${Object.entries(categoryCounts).filter(([_, c]) => c > 0).map(([cat, count]) => html`
              <div key=${cat} class="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                <${Badge} color=${categoryColors[cat] || 'gray'}>${count}<///>
                <span class="text-sm text-slate-700">${categoryLabels[cat] || cat}</span>
              </div>
            `)}
          </div>
        <//>
      `}

      <!-- Billet Summary -->
      ${billet?.title && html`
        <${Card} className="p-5 mb-6">
          <h3 class="text-sm font-semibold text-navy-700 mb-3">Billet Information</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <span class="text-slate-500">Title:</span>
              <span class="ml-2 text-navy-800 font-medium">${billet.title}</span>
            </div>
            <div>
              <span class="text-slate-500">Unit:</span>
              <span class="ml-2 text-navy-800 font-medium">${billet.unit}</span>
            </div>
            ${billet.billetDescription && html`
              <div class="md:col-span-2">
                <span class="text-slate-500">Mission:</span>
                <span class="ml-2 text-navy-800">${billet.billetDescription}</span>
              </div>
            `}
          </div>
        <//>
      `}

      <!-- Next Steps -->
      <${Card} className="p-5 mb-6 border-olive-200 bg-olive-50/30">
        <h3 class="text-sm font-semibold text-olive-800 mb-3">What's Next?</h3>
        <ul class="text-sm text-olive-900 space-y-2">
          <li class="flex items-start gap-2">
            <span class="mt-0.5 text-olive-500">1.</span>
            <span><strong>Browse & review</strong> your entries in the Knowledge Base to refine content.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="mt-0.5 text-olive-500">2.</span>
            <span><strong>Complete the Narrative</strong> interview for deeper tacit knowledge capture.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="mt-0.5 text-olive-500">3.</span>
            <span><strong>Curate Start Here</strong> to set up the first things your successor should read.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="mt-0.5 text-olive-500">4.</span>
            <span><strong>Run a Readiness Report</strong> to identify remaining gaps.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="mt-0.5 text-olive-500">5.</span>
            <span><strong>Export a backup</strong> to protect your work.</span>
          </li>
        </ul>
      <//>

      <!-- Action Buttons -->
      <div class="flex flex-wrap gap-3">
        <${Button} variant="primary" onClick=${() => navigate('browse')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
          Browse Knowledge Base
        <//>
        <${Button} variant="secondary" onClick=${() => navigate('narrative')}>
          Narrative Interview
        <//>
        <${Button} variant="secondary" onClick=${() => navigate('analytics')}>
          Readiness Report
        <//>
        <${Button} variant="secondary" onClick=${() => navigate('export')}>
          Export Backup
        <//>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main GuidedBuilder Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function GuidedBuilder() {
  const { billet, setBillet, addEntry, entries } = useApp();

  const [currentStep, setCurrentStep] = useState(0);
  const [entriesByStep, setEntriesByStep] = useState({});
  const [billetData, setBilletData] = useState(null);

  // Content area ref for scroll-to-top on step change
  const contentRef = useRef(null);

  // Scroll to top when step changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentStep]);

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;
  const isSummary = step.id === 'summary';

  // Count entries added in this step
  const stepEntries = entriesByStep[step.id] || [];

  const handleBilletComplete = useCallback((data) => {
    setBilletData(data);
    setBillet({
      ...billet,
      title: data.title,
      unit: data.unit,
      billetDescription: data.billetDescription,
    });
    showToast('Billet information saved', 'success');
    setCurrentStep(1);
  }, [billet, setBillet]);

  const handleEntryAdded = useCallback((entry) => {
    addEntry(entry);
    setEntriesByStep(prev => ({
      ...prev,
      [step.id]: [...(prev[step.id] || []), entry],
    }));
  }, [addEntry, step.id]);

  const goNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // If billet already has data, pre-fill billetData
  useEffect(() => {
    if (billet?.title && !billetData) {
      setBilletData({
        title: billet.title,
        unit: billet.unit,
        billetDescription: billet.billetDescription,
      });
    }
  }, [billet]);

  return html`
    <div ref=${contentRef} class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-olive-600 to-emerald-700 flex items-center justify-center shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" />
              <path d="M17.8 11.8 20 14" /><path d="M15 7a3 3 0 0 0-3 3" />
              <path d="M6.2 6.2 8 8" />
              <path d="M2 22l4-11 5 5Z" /><path d="M7 16.5l-1.5 1.5" />
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-bold text-navy-900">Guided Knowledge Base Builder</h1>
            <p class="text-sm text-slate-500">Step-by-step interview to build your turnover book</p>
          </div>
        </div>
      </div>

      <!-- Step Indicator -->
      <${StepIndicator}
        currentStep=${currentStep}
        totalSteps=${STEPS.length}
        stepLabel=${step.label}
      />

      <!-- Step Content Card -->
      <${Card} className="p-6 mb-6">
        ${step.id === 'billet' && html`
          <${BilletStep}
            onComplete=${handleBilletComplete}
            existingBillet=${billet}
          />
        `}

        ${step.category && html`
          <${EntryStep}
            key=${step.id}
            step=${step}
            onEntryAdded=${handleEntryAdded}
          />
        `}

        ${isSummary && html`
          <${SummaryStep}
            entriesByStep=${entriesByStep}
            billet=${billetData || billet}
          />
        `}
      <//>

      <!-- Navigation Buttons -->
      ${!isSummary && step.id !== 'billet' && html`
        <div class="flex items-center justify-between">
          <${Button}
            variant="secondary"
            onClick=${goBack}
            disabled=${isFirst}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          <//>

          <div class="flex items-center gap-3">
            ${stepEntries.length > 0 && html`
              <span class="text-xs text-green-600 font-medium">${stepEntries.length} added this step</span>
            `}
            <${Button}
              variant=${stepEntries.length > 0 ? 'primary' : 'secondary'}
              onClick=${goNext}
            >
              ${stepEntries.length > 0 ? 'Next Step' : 'Skip Step'}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            <//>
          </div>
        </div>
      `}

      ${isSummary && html`
        <div class="flex justify-start">
          <${Button} variant="secondary" onClick=${goBack}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          <//>
        </div>
      `}

    </div>
  `;
}
