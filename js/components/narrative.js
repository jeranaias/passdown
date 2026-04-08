// ─── Narrative Interview ─────────────────────────────────────────────────────
// Guided interview for tacit knowledge capture with Capture and Review modes.

import { html } from '../core/config.js';
import AIService from '../core/ai-service.js';
import { useApp } from './app.js';
import Store from '../core/store.js';
import { Button, ProgressBar, showToast } from '../shared/ui.js';
import { IconChat, IconCheck, IconEdit, IconEye } from '../shared/icons.js';
import { MarkdownPreview } from '../shared/markdown.js';

const { useState, useEffect, useCallback, useMemo, useRef } = React;

// ─── Default Prompts (inline fallback) ───────────────────────────────────────

const DEFAULT_PROMPTS = [
  { id: 'p01', question: 'What is the primary mission of your billet, and how does it contribute to your unit\'s overall mission?', guidance: 'Think about the core purpose of your position. What would fail or degrade if this billet were vacant for 30 days? Aim for 100-200 words.' },
  { id: 'p02', question: 'Describe a typical week in this billet. What are the recurring meetings, deadlines, and touchpoints?', guidance: 'Walk through Monday to Friday. What happens every week without fail? Aim for 200-300 words.' },
  { id: 'p03', question: 'Who are the three to five people or offices you interact with most frequently?', guidance: 'Include both internal and external contacts. Note what you work with them on. Aim for 200-300 words.' },
  { id: 'p04', question: 'What are the most important processes or SOPs you manage or execute?', guidance: 'Consider both formal written SOPs and informal processes. Note file locations and system names. Aim for 100-200 words.' },
  { id: 'p05', question: 'What are the biggest gotchas or lessons learned that a new person needs to know immediately?', guidance: 'Think about mistakes you made early on, things that surprised you, or unwritten institutional knowledge. Aim for 100-200 words.' },
  { id: 'p06', question: 'What decisions have you made that your successor should understand the reasoning behind?', guidance: 'Focus on choices where the "why" matters as much as the "what." Include constraints and tradeoffs. Aim for 100-200 words.' },
  { id: 'p07', question: 'What are the active issues or ongoing projects that need immediate attention?', guidance: 'Include anything with a deadline in the next 90 days, unresolved problems, or initiatives in progress. Aim for 100-200 words.' },
  { id: 'p08', question: 'What annual or periodic events does this billet manage or participate in?', guidance: 'Think through the fiscal year and training cycle. Include inspections, exercises, reports, ceremonies. Aim for 100-200 words.' },
  { id: 'p09', question: 'What systems, tools, or accounts does this billet require access to?', guidance: 'List all IT systems, databases, shared drives, distribution lists, and physical access requirements. Aim for 100-200 words.' },
  { id: 'p10', question: 'What would you do differently if you were starting this billet over again?', guidance: 'This is your chance to share wisdom. What do you wish someone had told you on Day 1? Aim for 100-200 words.' },
  { id: 'p11', question: 'Are there any political dynamics, sensitivities, or relationship nuances to be aware of?', guidance: 'Think about inter-unit relationships, personality dynamics, or topics requiring careful handling. Aim for 100-200 words.' },
  { id: 'p12', question: 'What resources, references, or reading materials would you recommend?', guidance: 'Include orders, directives, regulations, websites, manuals, or informal reference documents. Aim for 100-200 words.' },
];

// ─── Tab Bar ─────────────────────────────────────────────────────────────────

function TabBar({ mode, onChangeMode }) {
  const tabs = [
    { id: 'capture', label: 'Capture', icon: IconChat },
    { id: 'review',  label: 'Review',  icon: IconEye },
  ];

  return html`
    <div class="flex border-b border-slate-200" role="tablist">
      ${tabs.map(tab => html`
        <button key=${tab.id}
          role="tab"
          aria-selected=${mode === tab.id}
          onClick=${() => onChangeMode(tab.id)}
          class=${'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 '
            + (mode === tab.id
              ? 'border-navy-700 text-navy-800'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300')}>
          ${tab.icon({ size: 16 })}
          ${tab.label}
        </button>
      `)}
    </div>
  `;
}

// ─── Capture Mode ────────────────────────────────────────────────────────────

function CaptureMode({ prompts, responses, onSaveResponse, onSkip }) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    const firstUnanswered = prompts.findIndex(p => {
      const resp = responses.find(r => r.promptId === p.id);
      return !resp || (!resp.response && !resp.skipped);
    });
    return firstUnanswered >= 0 ? firstUnanswered : 0;
  });
  const [response, setResponse] = useState('');
  const [followUps, setFollowUps] = useState([]);
  const [followUpAnswers, setFollowUpAnswers] = useState({});
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef(null);

  const currentPrompt = prompts[currentIndex];
  const existingResponse = responses.find(r => r.promptId === currentPrompt.id);

  useEffect(() => {
    if (existingResponse && existingResponse.response) {
      setResponse(existingResponse.response);
    } else {
      setResponse('');
    }
    setFollowUps([]);
    setFollowUpAnswers({});
  }, [currentIndex]);

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.focus();
  }, [currentIndex]);

  const handleSave = useCallback(() => {
    if (response.trim()) {
      onSaveResponse(currentPrompt.id, response.trim());
      showToast('Response saved', 'success');
    }
  }, [currentPrompt, response, onSaveResponse]);

  const handleNext = useCallback(() => {
    if (response.trim()) onSaveResponse(currentPrompt.id, response.trim());
    if (currentIndex < prompts.length - 1) setCurrentIndex(currentIndex + 1);
  }, [currentIndex, prompts.length, response, currentPrompt, onSaveResponse]);

  const handlePrev = useCallback(() => {
    if (response.trim()) onSaveResponse(currentPrompt.id, response.trim());
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }, [currentIndex, response, currentPrompt, onSaveResponse]);

  const handleSkip = useCallback(() => {
    onSkip(currentPrompt.id);
    if (currentIndex < prompts.length - 1) setCurrentIndex(currentIndex + 1);
  }, [currentIndex, prompts.length, currentPrompt, onSkip]);

  const answeredCount = responses.filter(r => r.response && r.response.trim() && !r.skipped).length;
  const progressPct = Math.round((answeredCount / prompts.length) * 100);

  return html`
    <div class="space-y-6">
      <!-- Progress -->
      <div class="space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-600 font-medium">Question ${currentIndex + 1} of ${prompts.length}</span>
          <span class="text-slate-500">${answeredCount} answered (${progressPct}%)</span>
        </div>
        <${ProgressBar} value=${progressPct} />
      </div>

      <!-- Prompt Card -->
      <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 class="text-xl font-semibold text-navy-900 leading-relaxed">
          ${currentPrompt.question}
        </h2>
        ${currentPrompt.guidance && html`
          <p class="text-sm text-slate-500 italic leading-relaxed">${currentPrompt.guidance}</p>
        `}

        <!-- Write / Preview Toggle -->
        <div class="flex items-center justify-end mb-1">
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
              ref=${textareaRef}
              value=${response}
              onChange=${e => setResponse(e.target.value)}
              rows="8"
              class="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm leading-relaxed
                     focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500
                     placeholder-slate-400 resize-y"
              placeholder="Type your response here... Markdown is supported."
            />
          `
          : html`
            <div class="min-h-[200px] p-4 border border-slate-300 rounded-lg bg-slate-50 overflow-auto">
              ${response.trim()
                ? html`<${MarkdownPreview} content=${response} />`
                : html`<p class="text-slate-400 italic text-sm">Nothing to preview.</p>`
              }
            </div>
          `
        }

        ${existingResponse && existingResponse.skipped && html`
          <div class="text-xs text-amber-600 font-medium">Previously skipped. You can add a response now.</div>
        `}

        <!-- AI Follow-up Section -->
        ${AIService.isAvailable() && existingResponse && existingResponse.response && existingResponse.response.trim() && !existingResponse.skipped && html`
          <div class="border-t border-slate-100 pt-4 mt-4">
            <${Button}
              variant="secondary"
              size="sm"
              onClick=${async () => {
                setLoadingFollowUps(true);
                setFollowUps([]);
                try {
                  const questions = await AIService.generateFollowUps(currentPrompt.question, existingResponse.response);
                  if (Array.isArray(questions) && questions.length > 0) {
                    setFollowUps(questions);
                  } else {
                    showToast('No follow-up questions generated.', 'info');
                  }
                } catch (err) {
                  showToast('Failed to get follow-ups: ' + (err.message || 'Unknown error'), 'error');
                } finally {
                  setLoadingFollowUps(false);
                }
              }}
              disabled=${loadingFollowUps}
            >
              ${loadingFollowUps ? html`
                <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ` : html`
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              `}
              Get follow-up questions
            <//>

            ${followUps.length > 0 && html`
              <div class="mt-3 space-y-3">
                ${followUps.map((q, idx) => html`
                  <div key=${idx} class="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p class="text-sm font-medium text-purple-800 mb-2">${q}</p>
                    <textarea
                      value=${followUpAnswers[idx] || ''}
                      onChange=${(e) => setFollowUpAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                      rows="3"
                      placeholder="Your answer..."
                      class="w-full px-3 py-2 text-sm border border-purple-200 rounded-md bg-white
                             focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500
                             placeholder-slate-400 resize-y"
                    />
                    ${followUpAnswers[idx] && followUpAnswers[idx].trim() && html`
                      <${Button}
                        variant="secondary"
                        size="sm"
                        className="mt-1"
                        onClick=${() => {
                          const combined = existingResponse.response + '\n\n---\nFollow-up: ' + q + '\n' + followUpAnswers[idx].trim();
                          onSaveResponse(currentPrompt.id, combined);
                          showToast('Follow-up answer appended', 'success');
                          setFollowUpAnswers(prev => { const n = { ...prev }; delete n[idx]; return n; });
                        }}
                      >
                        ${IconCheck({ size: 14 })} Append to Response
                      <//>
                    `}
                  </div>
                `)}
              </div>
            `}
          </div>
        `}
      </div>

      <!-- Navigation -->
      <div class="flex items-center justify-between">
        <${Button} variant="secondary" onClick=${handlePrev} disabled=${currentIndex === 0}>Previous<//>
        <div class="flex items-center gap-2">
          <${Button} variant="ghost" onClick=${handleSkip} size="sm">Skip<//>
          <${Button} variant="secondary" onClick=${handleSave} disabled=${!response.trim()}>Save<//>
          <${Button} onClick=${handleNext} disabled=${currentIndex === prompts.length - 1}>
            ${currentIndex === prompts.length - 1 ? 'Finish' : 'Next'}
          <//>
        </div>
      </div>

      <!-- Prompt Navigation Dots -->
      <div class="flex flex-wrap justify-center gap-1.5 pt-2">
        ${prompts.map((p, i) => {
          const resp = responses.find(r => r.promptId === p.id);
          const isAnswered = resp && resp.response && resp.response.trim() && !resp.skipped;
          const isSkipped = resp && resp.skipped;
          const isCurrent = i === currentIndex;

          let dotClass = 'w-3 h-3 rounded-full cursor-pointer transition-all ';
          if (isCurrent) dotClass += 'ring-2 ring-navy-500 ring-offset-2 ';
          if (isAnswered) dotClass += 'bg-green-500';
          else if (isSkipped) dotClass += 'bg-amber-400';
          else dotClass += 'bg-slate-300';

          return html`
            <button key=${p.id}
              onClick=${() => {
                if (response.trim()) onSaveResponse(currentPrompt.id, response.trim());
                setCurrentIndex(i);
              }}
              class=${dotClass}
              title=${'Q' + (i + 1) + ': ' + (isAnswered ? 'Answered' : isSkipped ? 'Skipped' : 'Not answered')}
            />
          `;
        })}
      </div>
    </div>
  `;
}

// ─── Review Mode ─────────────────────────────────────────────────────────────

function ReviewMode({ prompts, responses, onSwitchToCapture }) {
  const answeredCount = responses.filter(r => r.response && r.response.trim() && !r.skipped).length;
  const skippedCount = responses.filter(r => r.skipped).length;
  const unansweredCount = prompts.length - answeredCount - skippedCount;

  return html`
    <div class="space-y-6">
      <!-- Summary -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-green-800">${answeredCount}</div>
          <div class="text-xs text-green-600 font-medium">Answered</div>
        </div>
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-amber-800">${skippedCount}</div>
          <div class="text-xs text-amber-600 font-medium">Skipped</div>
        </div>
        <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-slate-700">${unansweredCount}</div>
          <div class="text-xs text-slate-500 font-medium">Not Answered</div>
        </div>
      </div>

      <!-- All Responses -->
      <div class="space-y-4">
        ${prompts.map((prompt, i) => {
          const resp = responses.find(r => r.promptId === prompt.id);
          const isAnswered = resp && resp.response && resp.response.trim() && !resp.skipped;
          const isSkipped = resp && resp.skipped;

          return html`
            <div key=${prompt.id}
              class=${'bg-white rounded-lg border p-5 '
                + (isAnswered ? 'border-green-200' : isSkipped ? 'border-amber-200' : 'border-red-200 bg-red-50/30')}>
              <div class="flex items-start justify-between gap-3 mb-3">
                <div class="flex items-start gap-3 flex-1">
                  <span class=${'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold '
                    + (isAnswered ? 'bg-green-100 text-green-800' : isSkipped ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700')}>
                    ${i + 1}
                  </span>
                  <h3 class="text-sm font-semibold text-navy-900 leading-relaxed pt-1">
                    ${prompt.question}
                  </h3>
                </div>
                <${Button} variant="ghost" size="sm" onClick=${onSwitchToCapture}>
                  ${IconEdit({ size: 14 })} Edit
                <//>
              </div>

              ${isAnswered && html`
                <div class="pl-10 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">${resp.response}</div>
              `}
              ${isSkipped && html`
                <div class="pl-10 text-sm text-amber-600 italic">Skipped</div>
              `}
              ${!isAnswered && !isSkipped && html`
                <div class="pl-10 text-sm text-red-500 italic">Not yet answered</div>
              `}
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Narrative() {
  const [prompts, setPrompts] = useState(DEFAULT_PROMPTS);
  const [responses, setResponses] = useState(() => Store.getNarratives());
  const [mode, setMode] = useState('capture');
  const [promptsLoaded, setPromptsLoaded] = useState(false);

  // Try to load prompts from data files (standard + occfield-specific)
  useEffect(() => {
    const standardFetch = fetch('./data/prompts/standard.json')
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(data => (data && Array.isArray(data.prompts)) ? data.prompts : [])
      .catch(() => []);

    const occfieldFetch = fetch('./data/prompts/occfield-specific.json')
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(data => (data && Array.isArray(data.prompts)) ? data.prompts : [])
      .catch(() => []);

    Promise.all([standardFetch, occfieldFetch])
      .then(([standard, occfield]) => {
        const combined = [...standard, ...occfield];
        if (combined.length > 0) {
          setPrompts(combined);
        }
        // else keep DEFAULT_PROMPTS
      })
      .catch(() => { /* Use inline defaults */ })
      .finally(() => setPromptsLoaded(true));
  }, []);

  const saveResponse = useCallback((promptId, text) => {
    setResponses(prev => {
      const existing = prev.find(r => r.promptId === promptId);
      let updated;
      if (existing) {
        updated = prev.map(r =>
          r.promptId === promptId
            ? { ...r, response: text, skipped: false, updatedAt: new Date().toISOString() }
            : r
        );
      } else {
        updated = [...prev, {
          id: Store.generateId('n'),
          promptId,
          response: text,
          skipped: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }];
      }
      Store.saveNarratives(updated);
      return updated;
    });
  }, []);

  const skipPrompt = useCallback((promptId) => {
    setResponses(prev => {
      const existing = prev.find(r => r.promptId === promptId);
      let updated;
      if (existing) {
        updated = prev.map(r =>
          r.promptId === promptId
            ? { ...r, skipped: true, updatedAt: new Date().toISOString() }
            : r
        );
      } else {
        updated = [...prev, {
          id: Store.generateId('n'),
          promptId,
          response: '',
          skipped: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }];
      }
      Store.saveNarratives(updated);
      return updated;
    });
    showToast('Prompt skipped', 'info');
  }, []);

  if (!promptsLoaded) {
    return html`<div class="flex items-center justify-center py-12 text-slate-400">Loading interview prompts...</div>`;
  }

  return html`
    <div class="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
        ${IconChat({ size: 24 })}
        Narrative Interview
      </h1>

      <${TabBar} mode=${mode} onChangeMode=${setMode} />

      ${mode === 'capture' && html`
        <${CaptureMode}
          prompts=${prompts}
          responses=${responses}
          onSaveResponse=${saveResponse}
          onSkip=${skipPrompt}
        />
      `}

      ${mode === 'review' && html`
        <${ReviewMode}
          prompts=${prompts}
          responses=${responses}
          onSwitchToCapture=${() => setMode('capture')}
        />
      `}
    </div>
  `;
}
