// ─── AI Service ──────────────────────────────────────────────────────────────
// WebLLM-powered AI for Passdown. Runs entirely in the browser via WebGPU.
// Zero cloud dependencies. No data leaves the machine. No API keys needed.

import { CATEGORIES } from './config.js';
import WebLLMService from './webllm-service.js';

// ─── JSON Parsing Helper ─────────────────────────────────────────────────────

function parseJSONResponse(text) {
  try { return JSON.parse(text); } catch (_) { /* fall through */ }

  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (_) { /* fall through */ }
  }

  const bracketIdx = text.search(/[\[{]/);
  if (bracketIdx >= 0) {
    try { return JSON.parse(text.slice(bracketIdx)); } catch (_) { /* fall through */ }
  }

  return null;
}

// ─── AI Service Object ──────────────────────────────────────────────────────

const AIService = {

  // ── Availability ──────────────────────────────────────────────────────────

  isAvailable() {
    return WebLLMService.isAvailable();
  },

  isSupported() {
    return WebLLMService.isSupported();
  },

  get webllm() {
    return WebLLMService;
  },

  // ── Page Context Helper ──────────────────────────────────────────────────

  _getPageContext(page, entries, billet, narratives) {
    const entryCount = (entries || []).length;
    const narrativeCount = (narratives || []).filter(n => n.response).length;
    const hasBillet = !!(billet?.title);

    const contexts = {
      'dashboard': `The user is on the DASHBOARD. They can see their turnover overview.
${!hasBillet ? 'They have NOT set up their billet info yet — suggest they do that first in Settings.' : ''}
${entryCount === 0 ? 'The knowledge base is EMPTY. Suggest loading a template from Export/Import or starting to capture entries.' : `There are ${entryCount} entries.`}
${narrativeCount === 0 ? 'No narrative interviews completed yet — suggest starting the Narrative section.' : `${narrativeCount} narrative responses recorded.`}
Help them understand their overall progress and what to do next.`,

      'capture': `The user is on the CAPTURE page, creating or editing a knowledge entry.
Help them write clear, complete entries. Suggest:
- Clear step-by-step formatting for processes
- Including the "why" not just the "what" for decisions
- Using billet titles instead of names for stakeholders
- Specific dates and lead times for calendar events
- Concrete examples for lessons learned
If they ask for help with content, draft it for them based on what you know from the knowledge base. Always remind them to review for OPSEC before saving.`,

      'capture/stakeholders': `The user is managing STAKEHOLDERS.
Help them think about who they interact with. Suggest contacts they might be missing:
- Direct chain of command
- Key peers in adjacent offices
- External liaisons and coordination points
- Administrative and support contacts
Remind them to use BILLET TITLES, not personal names. Relationship context is the most valuable field — help them articulate WHY they contact each person.`,

      'capture/calendar': `The user is managing RECURRING CALENDAR events.
Help them think about deadlines and recurring tasks they might miss:
- Annual reporting cycles
- Budget submission deadlines
- Conference and symposium schedules
- Quarterly reviews
- Inspection preparation timelines
Suggest including prep lead times so the successor knows when to START preparing, not just the due date.`,

      'browse': `The user is BROWSING their knowledge entries.
Help them find specific entries, understand what's there, or identify gaps in coverage.`,

      'search': `The user is SEARCHING the knowledge base.
Help them find information. If they describe what they're looking for, suggest search terms or browse the knowledge base on their behalf.`,

      'narrative': `The user is doing the NARRATIVE INTERVIEW — guided prompts to capture tacit knowledge.
This is the most important part of Passdown. Help them think deeply about each question.
- Ask follow-up questions to draw out more detail
- Suggest specific examples they might include
- Remind them that this captures the knowledge that no document can — judgment, relationships, instincts
- If their answer is vague, gently push for specifics`,

      'verify': `The user is on the VERIFICATION page, reviewing entry currency.
Help them prioritize which stale entries to verify first. Suggest looking at high-priority entries and entries that will matter most to an incoming person. If entries look outdated based on their content, point that out.`,

      'start-here': `The user is curating the START HERE reading list — the first things an incoming person should read.
Help them prioritize. The best Start Here list covers:
1. Mission and scope of the billet
2. The 3-5 most critical processes
3. Key stakeholders and how to reach them
4. The most important "gotcha" or lesson learned
5. Any active issues that need immediate attention`,

      'export': `The user is on EXPORT/IMPORT.
Help them with exporting, importing, or loading templates. Remind them to export regularly as a backup. If they're about to share an export, remind them to review for OPSEC first.`,

      'settings': `The user is in SETTINGS.
Help them configure their billet info and PCS dates. If they need help with AI setup, explain that they just need to download a model — one-time, then it works offline forever.`,
    };

    return contexts[page] || `Help the user with whatever they need. You have access to their full knowledge base.`;
  },

  // ── Model Size Detection ──────────────────────────────────────────────────

  _getModelSize() {
    const modelId = WebLLMService.getModelId() || '';
    if (/SmolLM2|1\.7B|1\.5B|360M|135M/i.test(modelId)) return 'small';
    if (/3B|3\.8B|Phi-3|Llama-3\.2-3B/i.test(modelId)) return 'medium';
    return 'large';
  },

  // ── System Prompt Builder ─────────────────────────────────────────────────

  buildSystemPrompt(entries, billet, narratives, pageContext) {
    const modelSize = this._getModelSize();
    const billetTitle = billet?.title || 'this billet';
    const billetUnit = billet?.unit || 'this unit';

    // ── Small models: drastically simplified prompt ───────────────────────
    if (modelSize === 'small') {
      const MAX_CHARS = 2000;
      let prompt = `You are Passdown AI for the ${billetTitle} billet at ${billetUnit}. Answer questions about the knowledge base below.
Rules: No PII (use billet titles, not names). Cite entry titles in [brackets]. Be concise.

Entries:\n`;

      let charCount = prompt.length;
      const sorted = [...(entries || [])].sort((a, b) => {
        const po = { high: 0, medium: 1, low: 2 };
        return (po[a.priority] ?? 1) - (po[b.priority] ?? 1);
      });

      for (const entry of sorted) {
        const line = `- ${entry.title} (${entry.category || 'process'})\n`;
        if (charCount + line.length > MAX_CHARS) break;
        prompt += line;
        charCount += line.length;
      }

      return prompt;
    }

    // ── Medium and large models: full prompt ─────────────────────────────
    const MAX_CHARS = modelSize === 'medium' ? 6000 : 20000;
    const pageHelp = this._getPageContext(pageContext, entries, billet, narratives);

    let prompt = `You are Passdown AI, a secure knowledge transfer assistant for the ${billetTitle} billet at ${billetUnit}. You run entirely on this device — no data leaves this machine.

MISSION: Help the user capture, organize, verify, and retrieve institutional knowledge for billet turnover.

CURRENT PAGE: ${pageContext || 'unknown'}
${pageHelp}

RULES:
1. You have access to the full knowledge base below. Use it to answer questions, suggest content, and help the user fill out forms.
2. When citing information, reference the entry title in brackets: [Entry Title]
3. Use billet titles, never personal names. If the user tries to enter PII, gently remind them to use billet titles instead.
4. NEVER speculate about classified information, manning numbers, readiness data, or operational details. If the user enters potentially sensitive data, warn them: "OPSEC: This information may be sensitive. Consider whether it belongs in an unclassified system."
5. Be concise and direct. Military-professional tone.
6. If asked about something outside the knowledge base, suggest which category it should be captured in and offer to help draft the entry.
7. All responses are advisory. The human is responsible for decisions.
8. Help with ANY page: writing entries, improving content, suggesting stakeholders, reviewing verification, preparing narrative answers, organizing Start Here, or suggesting next steps.
9. ENTRY CREATION: When asked to write or draft an entry, produce it as a JSON code block:
\`\`\`json
{"category": "process|decision|stakeholder|calendar|lesson|issue", "title": "Entry Title", "content": "Markdown content", "tags": ["tag1"], "priority": "high|medium|low", "meta": {}}
\`\`\`
Add explanatory text OUTSIDE the code block.

KNOWLEDGE BASE:
`;

    // Group entries by category
    const categoryMap = {};
    for (const cat of CATEGORIES) {
      categoryMap[cat.id] = { label: cat.label, entries: [] };
    }

    const sortedEntries = [...(entries || [])].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const pa = priorityOrder[a.priority] ?? 1;
      const pb = priorityOrder[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
    });

    let charCount = prompt.length;
    let truncated = false;

    for (const entry of sortedEntries) {
      const catId = entry.category || 'process';
      if (!categoryMap[catId]) categoryMap[catId] = { label: catId, entries: [] };

      const entryText = `### ${entry.title}\nCategory: ${categoryMap[catId]?.label || catId}\nPriority: ${entry.priority || 'medium'}\nTags: ${(entry.tags || []).join(', ') || 'none'}\n${entry.content || '(no content)'}\n`;

      if (charCount + entryText.length > MAX_CHARS) { truncated = true; break; }
      categoryMap[catId].entries.push(entryText);
      charCount += entryText.length;
    }

    for (const catId of Object.keys(categoryMap)) {
      const cat = categoryMap[catId];
      if (cat.entries.length === 0) continue;
      prompt += `\n## ${cat.label}\n` + cat.entries.join('\n');
    }

    if (truncated) {
      prompt += `\n[NOTE: KB truncated. ${sortedEntries.length} total entries exist.]\n`;
    }

    if (narratives && narratives.length > 0) {
      prompt += '\nNARRATIVE RESPONSES:\n';
      for (const n of narratives) {
        const nText = `Q: ${n.prompt || n.question || ''}\nA: ${n.response || ''}\n\n`;
        if (charCount + nText.length > MAX_CHARS) break;
        prompt += nText;
        charCount += nText.length;
      }
    }

    return prompt;
  },

  // ── Chat ──────────────────────────────────────────────────────────────────

  async chat(messages, entries, billet, narratives, pageContext) {
    if (!this.isAvailable()) {
      return 'AI model not loaded. Go to Settings → Offline AI to download a model.';
    }
    try {
      const systemPrompt = this.buildSystemPrompt(entries, billet, narratives, pageContext);
      return await WebLLMService.chat(messages, systemPrompt);
    } catch (err) {
      console.error('[AIService] Chat error:', err);
      return 'AI error: ' + (err.message || 'Unknown error');
    }
  },

  // ── Helper: run a single prompt ──────────────────────────────────────────

  async _generate(prompt) {
    if (!this.isAvailable()) return null;
    try {
      return await WebLLMService.generate(prompt);
    } catch (err) {
      console.error('[AIService] Generate error:', err);
      return null;
    }
  },

  // ── Suggest Tags ──────────────────────────────────────────────────────────

  async suggestTags(title, content) {
    const prompt = `Suggest 3-5 short tags for this knowledge entry. Return ONLY a JSON array of lowercase strings.\n\nTitle: ${title || ''}\nContent: ${(content || '').slice(0, 500)}\n\nExample: ["logistics", "supply-chain", "weekly-report"]`;
    const text = await this._generate(prompt);
    if (!text) return [];
    const parsed = parseJSONResponse(text);
    return Array.isArray(parsed) ? parsed.filter(t => typeof t === 'string').map(t => t.toLowerCase().trim()).slice(0, 5) : [];
  },

  // ── Improve Content ───────────────────────────────────────────────────────

  async improveContent(entry) {
    const prompt = `Review this knowledge entry and suggest improvements. Use bullet points.\n\nTitle: ${entry.title || ''}\nCategory: ${entry.category || ''}\nContent:\n${entry.content || '(empty)'}\n\nFocus on: missing info, vague language, structure, OPSEC concerns.`;
    return (await this._generate(prompt)) || 'Unable to generate suggestions.';
  },

  // ── Generate Follow-Up Questions ──────────────────────────────────────────

  async generateFollowUps(promptText, response) {
    const prompt = `Based on this interview exchange, suggest 2-3 follow-up questions. Return ONLY a JSON array of strings.\n\nPrompt: ${promptText}\nResponse: ${response}\n\nExample: ["What happens if the deadline is missed?", "Who is the backup?"]`;
    const text = await this._generate(prompt);
    if (!text) return [];
    const parsed = parseJSONResponse(text);
    return Array.isArray(parsed) ? parsed.filter(q => typeof q === 'string').slice(0, 3) : [];
  },

  // ── Analyze Gaps ──────────────────────────────────────────────────────────

  async analyzeGaps(entries, billetTitle) {
    const entryList = (entries || []).map(e => `- [${e.category}] ${e.title}`).join('\n');
    const prompt = `Analyze this knowledge base for a "${billetTitle || 'billet'}" turnover. Identify 3-7 missing topics. Return ONLY a JSON array.\n\nCategories: ${CATEGORIES.map(c => c.id).join(', ')}\n\nCurrent entries:\n${entryList || '(none)'}\n\nEach object: {"title": "...", "category": "...", "reason": "..."}`;
    const text = await this._generate(prompt);
    if (!text) return [];
    const parsed = parseJSONResponse(text);
    return Array.isArray(parsed) ? parsed.filter(g => g?.title && g?.category && g?.reason).slice(0, 7) : [];
  },

  // ── Generate from Description ────────────────────────────────────────────

  async generateFromDescription(description, category) {
    const prompt = `Generate well-structured Markdown content for a "${category || 'process'}" knowledge entry. Include headings and [PLACEHOLDER] markers. Return ONLY the Markdown.\n\nDescription: ${description}`;
    return (await this._generate(prompt)) || '';
  },

  // ── Review Verification ───────────────────────────────────────────────────

  async reviewVerification(entries) {
    const entryList = (entries || []).map(e =>
      `- ID: ${e.id} | ${e.title} | Updated: ${e.updatedAt || 'unknown'} | Preview: ${(e.content || '').slice(0, 100)}`
    ).join('\n');
    const prompt = `Review these entries and identify which may be outdated or vague. Return ONLY a JSON array.\n\nEntries:\n${entryList}\n\nEach object: {"entryId": "...", "issue": "..."}. Return up to 10.`;
    const text = await this._generate(prompt);
    if (!text) return [];
    const parsed = parseJSONResponse(text);
    return Array.isArray(parsed) ? parsed.filter(r => r?.entryId && r?.issue).slice(0, 10) : [];
  },

  // ── Assess Completeness ───────────────────────────────────────────────────

  async assessCompleteness(entries, narratives, billetTitle) {
    const fallback = { grade: 'N/A', score: 0, strengths: [], gaps: [], recommendations: [] };
    const categoryCounts = {};
    for (const cat of CATEGORIES) categoryCounts[cat.id] = 0;
    for (const e of (entries || [])) categoryCounts[e.category || 'process'] = (categoryCounts[e.category || 'process'] || 0) + 1;

    const prompt = `Evaluate this knowledge base for a "${billetTitle || 'billet'}" turnover. Return ONLY a JSON object.

Stats: ${(entries||[]).length} entries, ${(narratives||[]).length} narratives
Per category: ${JSON.stringify(categoryCounts)}

Return: {"grade": "A-F", "score": 0-100, "strengths": ["..."], "gaps": ["..."], "recommendations": ["..."]}

Rubric: A(90+): comprehensive. B(75-89): good with minor gaps. C(60-74): moderate. D(40-59): minimal. F(<40): barely started.`;

    const text = await this._generate(prompt);
    if (!text) return fallback;
    const parsed = parseJSONResponse(text);
    if (parsed?.grade && typeof parsed.score === 'number') {
      return {
        grade: parsed.grade,
        score: Math.min(100, Math.max(0, parsed.score)),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      };
    }
    return fallback;
  },
};

export default AIService;
