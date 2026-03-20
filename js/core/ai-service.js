// ─── AI Service ──────────────────────────────────────────────────────────────
// Firebase AI Logic abstraction layer for Passdown Phase 2.
// Uses Gemini 2.5 Flash via Firebase AI (free tier, no API key management).

import { CATEGORIES } from './config.js';

// Firebase SDK imports (CDN ES modules)
let firebaseApp = null;
let firebaseAI = null;
let firebaseAuth = null;
let currentUser = null;

// ─── Rate Limiter ────────────────────────────────────────────────────────────

const MIN_REQUEST_INTERVAL_MS = 2000;
let lastRequestTimestamp = 0;

async function enforceRateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTimestamp;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTimestamp = Date.now();
}

// ─── JSON Parsing Helper ─────────────────────────────────────────────────────

function parseJSONResponse(text) {
  // Try direct parse
  try {
    return JSON.parse(text);
  } catch (_) { /* fall through */ }

  // Try extracting from markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (_) { /* fall through */ }
  }

  // Try finding first [ or { and parsing from there
  const bracketIdx = text.search(/[\[{]/);
  if (bracketIdx >= 0) {
    const candidate = text.slice(bracketIdx);
    try {
      return JSON.parse(candidate);
    } catch (_) { /* fall through */ }
  }

  return null;
}

// ─── AI Service Object ──────────────────────────────────────────────────────

const AIService = {
  initialized: false,
  _model: null,

  // ── Initialize Firebase + Gemini ──────────────────────────────────────────

  async init(firebaseConfig) {
    if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.projectId) {
      this.initialized = false;
      this._model = null;
      return;
    }

    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js');
      const { getAI, getGenerativeModel, GoogleAIBackend } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-ai.js');
      const { getAuth, signInWithPopup, onAuthStateChanged, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js');

      // Avoid re-initializing with same config
      if (!firebaseApp) {
        firebaseApp = initializeApp(firebaseConfig);
      }

      // Initialize auth
      firebaseAuth = getAuth(firebaseApp);
      this._authProvider = new GoogleAuthProvider();
      this._signInWithPopup = signInWithPopup;

      // Listen for auth state changes
      onAuthStateChanged(firebaseAuth, (user) => {
        currentUser = user;
        this.user = user;
      });

      const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
      this._model = getGenerativeModel(ai, {
        model: 'gemini-2.5-flash',
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
      });

      this.initialized = true;
      console.log('[AIService] Initialized with Firebase project:', firebaseConfig.projectId);
    } catch (err) {
      console.error('[AIService] Initialization failed:', err);
      this.initialized = false;
      this._model = null;
    }
  },

  // ── Availability Check ────────────────────────────────────────────────────

  isAvailable() {
    return this.initialized && this._model !== null;
  },

  isSignedIn() {
    return !!currentUser;
  },

  getUser() {
    return currentUser;
  },

  async signIn() {
    if (!firebaseAuth || !this._authProvider) {
      throw new Error('Firebase not initialized');
    }
    try {
      const result = await this._signInWithPopup(firebaseAuth, this._authProvider);
      currentUser = result.user;
      this.user = result.user;
      return result.user;
    } catch (err) {
      console.error('[AIService] Sign-in failed:', err);
      throw err;
    }
  },

  async signOut() {
    if (!firebaseAuth) return;
    try {
      const { signOut: fbSignOut } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js');
      await fbSignOut(firebaseAuth);
      currentUser = null;
      this.user = null;
    } catch (err) {
      console.error('[AIService] Sign-out failed:', err);
    }
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
Help them configure their billet info, PCS dates, and Firebase AI settings. If they need help setting up Firebase, walk them through it step by step.`,
    };

    return contexts[page] || `Help the user with whatever they need. You have access to their full knowledge base.`;
  },

  // ── System Prompt Builder ─────────────────────────────────────────────────

  buildSystemPrompt(entries, billet, narratives, pageContext) {
    const billetTitle = billet?.title || 'this billet';
    const billetUnit = billet?.unit || 'this unit';

    // Page-aware context block
    const pageHelp = this._getPageContext(pageContext, entries, billet, narratives);

    let prompt = `You are Passdown AI, a secure knowledge transfer assistant for the ${billetTitle} billet at ${billetUnit}.

MISSION: Help the user capture, organize, verify, and retrieve institutional knowledge for billet turnover. You assist with ALL aspects of the application — not just Q&A.

CURRENT PAGE: ${pageContext || 'unknown'}
${pageHelp}

RULES:
1. You have access to the full knowledge base below. Use it to answer questions, suggest content, and help the user fill out forms.
2. When citing information, reference the entry title in brackets: [Entry Title]
3. Use billet titles, never personal names. If the user tries to enter PII (names, SSNs, phone numbers tied to individuals), gently remind them to use billet titles instead.
4. NEVER speculate about classified information, manning numbers, readiness data, or operational details. If the user tries to enter potentially classified or sensitive data, warn them immediately.
5. Be concise and direct. Military-professional tone.
6. If asked about something outside the knowledge base, suggest which category it should be captured in and offer to help draft the entry.
7. All responses are advisory. The human is responsible for decisions.
8. You can help the user with ANY page in the app: writing entries, improving content, suggesting stakeholders, reviewing verification status, preparing narrative answers, organizing the Start Here list, or understanding what to do next.
9. Proactively suggest next steps based on what page the user is on and what gaps exist in the knowledge base.
10. OPSEC GUARDIAN: If you detect the user is about to enter information that could be sensitive in aggregate (specific unit capabilities, deployment schedules, intelligence methods), flag it with a clear warning: "⚠ OPSEC: This information may be sensitive. Consider whether it belongs in an unclassified system."
11. ENTRY CREATION: When the user asks you to write, draft, or create an entry, produce the entry as a JSON code block with this format. The user will see an "Add to Knowledge Base" button to approve it:
\`\`\`json
{"category": "process|decision|stakeholder|calendar|lesson|issue", "title": "Entry Title", "content": "Markdown content here", "tags": ["tag1", "tag2"], "priority": "high|medium|low", "meta": {}}
\`\`\`
For stakeholder entries, include meta: {"billetTitle": "...", "org": "...", "frequency": "daily|weekly|monthly|quarterly|asNeeded", "relationship": "..."}
For calendar entries, include meta: {"recurrence": "annual|quarterly|monthly|weekly|oneTime", "month": 1-12, "prepLeadDays": 30}
For decision entries, include meta: {"decisionDate": "YYYY-MM-DD", "alternatives": "...", "outcome": "...", "reversible": true|false}
Always include the JSON block so the entry can be directly added. Add explanatory text OUTSIDE the code block.

KNOWLEDGE BASE:
`;

    // Group entries by category
    const categoryMap = {};
    for (const cat of CATEGORIES) {
      categoryMap[cat.id] = { label: cat.label, entries: [] };
    }

    const sortedEntries = [...(entries || [])].sort((a, b) => {
      // High priority first, then by updated date descending
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const pa = priorityOrder[a.priority] ?? 1;
      const pb = priorityOrder[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
    });

    let charCount = prompt.length;
    const MAX_CHARS = 100000;
    let truncated = false;

    for (const entry of sortedEntries) {
      const catId = entry.category || 'process';
      if (!categoryMap[catId]) {
        categoryMap[catId] = { label: catId, entries: [] };
      }

      const entryText = `### ${entry.title}
Category: ${categoryMap[catId]?.label || catId}
Priority: ${entry.priority || 'medium'}
Tags: ${(entry.tags || []).join(', ') || 'none'}
Verified: ${entry.verified ? 'Yes' : 'No'}${entry.verifiedAt ? ' (' + entry.verifiedAt + ')' : ''}
Content:
${entry.content || '(no content)'}
`;
      if (charCount + entryText.length > MAX_CHARS) {
        truncated = true;
        break;
      }

      categoryMap[catId].entries.push(entryText);
      charCount += entryText.length;
    }

    // Serialize grouped entries
    for (const catId of Object.keys(categoryMap)) {
      const cat = categoryMap[catId];
      if (cat.entries.length === 0) continue;
      prompt += `\n## ${cat.label}\n`;
      prompt += cat.entries.join('\n');
    }

    if (truncated) {
      prompt += `\n[NOTE: Knowledge base was truncated due to size. Some lower-priority and older entries are omitted. ${sortedEntries.length} total entries exist.]\n`;
    }

    // Narratives
    if (narratives && narratives.length > 0) {
      prompt += '\nNARRATIVE RESPONSES:\n';
      for (const n of narratives) {
        const nText = `Q: ${n.prompt || n.question || '(no question)'}\nA: ${n.response || '(no response)'}\n\n`;
        if (charCount + nText.length > MAX_CHARS) {
          prompt += '[Additional narratives omitted due to size.]\n';
          break;
        }
        prompt += nText;
        charCount += nText.length;
      }
    }

    return prompt;
  },

  // ── Chat ──────────────────────────────────────────────────────────────────

  async chat(messages, entries, billet, narratives, pageContext) {
    if (!this.isAvailable()) {
      return 'AI is not configured. Set up Firebase in Settings to enable AI features.';
    }

    try {
      await enforceRateLimit();

      const systemInstruction = this.buildSystemPrompt(entries, billet, narratives, pageContext);

      // Build history from all messages except the last user message
      const history = [];
      for (let i = 0; i < messages.length - 1; i++) {
        const msg = messages[i];
        history.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }

      const chatSession = this._model.startChat({
        history,
        systemInstruction: { parts: [{ text: systemInstruction }] },
      });

      // Send the latest user message
      const lastMessage = messages[messages.length - 1];
      const result = await chatSession.sendMessage(lastMessage.content);
      const response = result.response;
      return response.text();
    } catch (err) {
      console.error('[AIService] Chat error:', err);
      if (err.message?.includes('quota') || err.message?.includes('429')) {
        return 'Rate limit reached. Please wait a moment and try again.';
      }
      if (err.message?.includes('SAFETY')) {
        return 'The response was blocked by safety filters. Try rephrasing your question.';
      }
      return 'AI encountered an error: ' + (err.message || 'Unknown error') + '. Please try again.';
    }
  },

  // ── Suggest Tags ──────────────────────────────────────────────────────────

  async suggestTags(title, content) {
    if (!this.isAvailable()) return [];

    try {
      await enforceRateLimit();

      const truncatedContent = (content || '').slice(0, 500);
      const prompt = `Suggest 3 to 5 short, relevant tags for this knowledge base entry. Return ONLY a JSON array of lowercase strings, no other text.

Title: ${title || '(untitled)'}
Content: ${truncatedContent}

Example output: ["logistics", "supply-chain", "weekly-report"]`;

      const result = await this._model.generateContent(prompt);
      const text = result.response.text();
      const parsed = parseJSONResponse(text);

      if (Array.isArray(parsed) && parsed.every(t => typeof t === 'string')) {
        return parsed.map(t => t.toLowerCase().trim()).filter(Boolean).slice(0, 5);
      }

      return [];
    } catch (err) {
      console.error('[AIService] suggestTags error:', err);
      return [];
    }
  },

  // ── Improve Content ───────────────────────────────────────────────────────

  async improveContent(entry) {
    if (!this.isAvailable()) return 'AI is not available.';

    try {
      await enforceRateLimit();

      const prompt = `Review this knowledge base entry and provide specific, actionable suggestions to improve its clarity, completeness, and usefulness for someone new to this billet. Be concise. Use bullet points.

Title: ${entry.title || '(untitled)'}
Category: ${entry.category || 'unknown'}
Priority: ${entry.priority || 'medium'}
Tags: ${(entry.tags || []).join(', ') || 'none'}
Content:
${entry.content || '(no content)'}

Provide suggestions in plain text with bullet points. Focus on:
- Missing information that should be added
- Ambiguous language that could confuse a newcomer
- Structure improvements (steps, timelines, POCs)
- OPSEC concerns (PII, classified info)`;

      const result = await this._model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      console.error('[AIService] improveContent error:', err);
      return 'Unable to generate suggestions: ' + (err.message || 'Unknown error');
    }
  },

  // ── Generate Follow-Up Questions ──────────────────────────────────────────

  async generateFollowUps(promptText, response) {
    if (!this.isAvailable()) return [];

    try {
      await enforceRateLimit();

      const prompt = `Based on this interview exchange, suggest 2-3 follow-up probing questions that would extract more useful knowledge for a billet turnover. Return ONLY a JSON array of question strings.

Interview prompt: ${promptText}
Response: ${response}

Example output: ["What happens if the deadline is missed?", "Who is the backup POC for this process?"]`;

      const result = await this._model.generateContent(prompt);
      const text = result.response.text();
      const parsed = parseJSONResponse(text);

      if (Array.isArray(parsed) && parsed.every(q => typeof q === 'string')) {
        return parsed.slice(0, 3);
      }

      return [];
    } catch (err) {
      console.error('[AIService] generateFollowUps error:', err);
      return [];
    }
  },

  // ── Analyze Gaps ──────────────────────────────────────────────────────────

  async analyzeGaps(entries, billetTitle) {
    if (!this.isAvailable()) return [];

    try {
      await enforceRateLimit();

      const entryList = (entries || []).map(e =>
        `- [${e.category || 'unknown'}] ${e.title}`
      ).join('\n');

      const categoryList = CATEGORIES.map(c => `${c.id}: ${c.label}`).join(', ');

      const prompt = `Analyze this knowledge base for a "${billetTitle || 'military billet'}" turnover and identify what's missing. Return ONLY a JSON array of objects.

Available categories: ${categoryList}

Current entries:
${entryList || '(no entries yet)'}

Identify 3-7 gaps. Each object must have:
- "title": suggested entry title (string)
- "category": one of the category IDs listed above (string)
- "reason": brief explanation of why this is needed (string)

Example: [{"title": "Weekly Battle Rhythm", "category": "calendar", "reason": "No recurring schedule captured for key weekly events"}]`;

      const result = await this._model.generateContent(prompt);
      const text = result.response.text();
      const parsed = parseJSONResponse(text);

      if (Array.isArray(parsed)) {
        return parsed
          .filter(g => g && typeof g.title === 'string' && typeof g.category === 'string' && typeof g.reason === 'string')
          .slice(0, 7);
      }

      return [];
    } catch (err) {
      console.error('[AIService] analyzeGaps error:', err);
      return [];
    }
  },

  // ── Generate from Description ────────────────────────────────────────────

  async generateFromDescription(description, category) {
    if (!this.isAvailable()) return '';

    try {
      await enforceRateLimit();

      const prompt = `Given the following brief description for a "${category || 'process'}" knowledge base entry, generate well-structured Markdown content. Include relevant headings, bullet points, and [PLACEHOLDER] markers where the user should fill in specifics. Return ONLY the Markdown content, no wrapping.

Brief description:
${description}`;

      const result = await this._model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      console.error('[AIService] generateFromDescription error:', err);
      return '';
    }
  },

  // ── Review Verification ───────────────────────────────────────────────────

  async reviewVerification(entries) {
    if (!this.isAvailable()) return [];

    try {
      await enforceRateLimit();

      const entryList = (entries || []).map(e =>
        `- ID: ${e.id} | Title: ${e.title} | Updated: ${e.updatedAt || e.createdAt || 'unknown'} | Verified: ${e.verified ? 'Yes' : 'No'} | Content preview: ${(e.content || '').slice(0, 150)}`
      ).join('\n');

      const prompt = `Review these knowledge base entries and identify which ones might be outdated, vague, or need reverification. Return ONLY a JSON array of objects.

Entries:
${entryList || '(no entries)'}

Each object must have:
- "entryId": the entry ID (string)
- "issue": brief description of the concern (string)

Focus on: vague/generic content, entries that reference time-sensitive info, entries without verification, and entries that seem incomplete. Return up to 10 items.`;

      const result = await this._model.generateContent(prompt);
      const text = result.response.text();
      const parsed = parseJSONResponse(text);

      if (Array.isArray(parsed)) {
        return parsed
          .filter(r => r && typeof r.entryId === 'string' && typeof r.issue === 'string')
          .slice(0, 10);
      }

      return [];
    } catch (err) {
      console.error('[AIService] reviewVerification error:', err);
      return [];
    }
  },

  // ── Assess Completeness ───────────────────────────────────────────────────

  async assessCompleteness(entries, narratives, billetTitle) {
    if (!this.isAvailable()) {
      return { grade: 'N/A', score: 0, strengths: [], gaps: [], recommendations: [] };
    }

    try {
      await enforceRateLimit();

      const categoryList = CATEGORIES.map(c => `${c.id}: ${c.label}`).join(', ');

      const categoryCounts = {};
      for (const cat of CATEGORIES) {
        categoryCounts[cat.id] = 0;
      }
      for (const e of (entries || [])) {
        const catId = e.category || 'process';
        categoryCounts[catId] = (categoryCounts[catId] || 0) + 1;
      }

      const verifiedCount = (entries || []).filter(e => e.verified).length;
      const totalEntries = (entries || []).length;
      const totalNarratives = (narratives || []).length;

      const prompt = `Evaluate the completeness of this knowledge base for a "${billetTitle || 'military billet'}" turnover. Return ONLY a JSON object.

Available categories: ${categoryList}

Statistics:
- Total entries: ${totalEntries}
- Verified entries: ${verifiedCount}
- Narrative responses: ${totalNarratives}
- Entries per category: ${JSON.stringify(categoryCounts)}

Entry titles by category:
${Object.entries(categoryCounts).map(([catId, count]) => {
  const titles = (entries || []).filter(e => e.category === catId).map(e => e.title).join(', ');
  return `  ${catId} (${count}): ${titles || '(empty)'}`;
}).join('\n')}

Return a JSON object with:
- "grade": letter grade A through F (string)
- "score": numeric score 0-100 (number)
- "strengths": array of 2-4 strengths (string[])
- "gaps": array of 2-5 identified gaps (string[])
- "recommendations": array of 2-4 prioritized next steps (string[])

Grading rubric:
A (90-100): All categories populated, most entries verified, narratives captured, comprehensive coverage
B (75-89): Good coverage with minor gaps, some unverified entries
C (60-74): Moderate coverage, several categories thin or empty
D (40-59): Minimal coverage, many categories empty
F (0-39): Barely started`;

      const result = await this._model.generateContent(prompt);
      const text = result.response.text();
      const parsed = parseJSONResponse(text);

      if (parsed && typeof parsed.grade === 'string' && typeof parsed.score === 'number') {
        return {
          grade: parsed.grade,
          score: Math.min(100, Math.max(0, parsed.score)),
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
          gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        };
      }

      return { grade: 'N/A', score: 0, strengths: [], gaps: ['Unable to parse AI response'], recommendations: ['Try again'] };
    } catch (err) {
      console.error('[AIService] assessCompleteness error:', err);
      return { grade: 'N/A', score: 0, strengths: [], gaps: [err.message || 'Unknown error'], recommendations: [] };
    }
  },
};

export default AIService;
