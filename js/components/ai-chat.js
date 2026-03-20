// ─── AI Chat Sidebar ─────────────────────────────────────────────────────────
// Slide-in chat panel for Passdown AI Q&A over the knowledge base.

import { html } from '../core/config.js';
import AIService from '../core/ai-service.js';
import { useApp } from './app.js';
import { MarkdownPreview } from '../shared/markdown.js';
import { IconX } from '../shared/icons.js';

const { useState, useEffect, useRef, useCallback } = React;

// ─── Send Icon (inline) ─────────────────────────────────────────────────────

function SendIcon({ size = 18 }) {
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  `;
}

// ─── Sparkle Icon (for AI branding) ──────────────────────────────────────────

function SparkleIcon({ size = 18 }) {
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
    </svg>
  `;
}

// ─── Trash Icon (for clear chat) ─────────────────────────────────────────────

function TrashIcon({ size = 16 }) {
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  `;
}

// ─── Loading Dots ────────────────────────────────────────────────────────────

function LoadingDots() {
  return html`
    <div class="flex items-center gap-1 px-4 py-3">
      <div class="flex gap-1.5">
        <span class="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style=${{ animationDelay: '0ms' }} />
        <span class="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style=${{ animationDelay: '150ms' }} />
        <span class="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style=${{ animationDelay: '300ms' }} />
      </div>
    </div>
  `;
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return html`
      <div class="flex justify-center my-2">
        <div class="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 max-w-[90%]">
          <p class="text-xs text-red-600">${message.content}</p>
        </div>
      </div>
    `;
  }

  if (isUser) {
    return html`
      <div class="flex justify-end mb-3">
        <div class="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-navy-700 text-white">
          <p class="text-sm whitespace-pre-wrap leading-relaxed">${message.content}</p>
        </div>
      </div>
    `;
  }

  // Assistant message
  return html`
    <div class="flex justify-start mb-3">
      <div class="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-slate-100 border border-slate-200">
        <${MarkdownPreview} content=${message.content} className="text-sm" />
      </div>
    </div>
  `;
}

// ─── Setup Instructions (when AI not configured) ─────────────────────────────

function SetupInstructions() {
  return html`
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="text-center max-w-sm space-y-4">
        <div class="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
          <${SparkleIcon} size=${28} />
        </div>
        <h3 class="text-base font-semibold text-slate-700">AI Assistant Not Configured</h3>
        <p class="text-sm text-slate-500 leading-relaxed">
          Set up Firebase in Settings to enable AI-powered Q&A over your knowledge base.
          All other features work without AI.
        </p>
        <a href="#settings"
          class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-navy-700 bg-navy-50 hover:bg-navy-100 rounded-lg transition-colors">
          Go to Settings
        </a>
      </div>
    </div>
  `;
}

function SignInPrompt({ onSignIn }) {
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await onSignIn();
    } catch (err) {
      console.error('Sign-in failed:', err);
    } finally {
      setSigningIn(false);
    }
  };

  return html`
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="text-center max-w-sm space-y-4">
        <div class="w-14 h-14 rounded-full bg-navy-50 flex items-center justify-center mx-auto">
          <${SparkleIcon} size=${28} />
        </div>
        <h3 class="text-base font-semibold text-slate-700">Sign in to use AI</h3>
        <p class="text-sm text-slate-500 leading-relaxed">
          Sign in with Google to access Passdown AI. Your knowledge base stays local — only your questions are sent to the AI.
        </p>
        <button
          onClick=${handleSignIn}
          disabled=${signingIn}
          class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-navy-700 hover:bg-navy-800 rounded-lg transition-colors disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          ${signingIn ? 'Signing in...' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  `;
}

// ─── Welcome Message ─────────────────────────────────────────────────────────

function WelcomePrompt({ onSuggestion, currentPage }) {
  const pageSuggestions = {
    'dashboard': [
      'What should I work on next?',
      'How complete is my knowledge base?',
      'What gaps do I have?',
      'Help me prepare for turnover',
    ],
    'capture': [
      'Help me write this entry',
      'What processes should I document?',
      'Draft a decision log entry for me',
      'What am I missing in this category?',
    ],
    'capture/stakeholders': [
      'Who else should I add as a stakeholder?',
      'Help me describe this relationship',
      'What contacts am I missing?',
      'Draft a stakeholder entry for the monitor',
    ],
    'capture/calendar': [
      'What annual deadlines should I capture?',
      'Help me add a recurring event',
      'What budget cycle events am I missing?',
      'Draft a calendar entry for quarterly reports',
    ],
    'narrative': [
      'Help me think about this question',
      'My answer feels too vague — help me be specific',
      'What else should I mention here?',
      'Ask me follow-up questions to go deeper',
    ],
    'verify': [
      'Which entries should I verify first?',
      'Are any entries likely outdated?',
      'Help me prioritize verification',
      'What entries are most critical for my successor?',
    ],
    'start-here': [
      'What should be in the Start Here list?',
      'Help me prioritize the reading order',
      'What would a new person need first?',
      'Am I missing anything critical?',
    ],
    'search': [
      'What are my key recurring events?',
      'Summarize active issues',
      'What lessons learned should I know?',
      'Who are the key stakeholders?',
    ],
  };
  const suggestions = pageSuggestions[currentPage] || pageSuggestions['search'];

  return html`
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="text-center max-w-sm space-y-4">
        <div class="w-14 h-14 rounded-full bg-navy-50 flex items-center justify-center mx-auto">
          <${SparkleIcon} size=${28} />
        </div>
        <h3 class="text-base font-semibold text-slate-700">Passdown AI</h3>
        <p class="text-sm text-slate-500">
          Ask questions about the knowledge base. I'll answer from what's been captured.
        </p>
        <div class="space-y-2 pt-2">
          ${suggestions.map(s => html`
            <button
              key=${s}
              onClick=${() => onSuggestion(s)}
              class="w-full text-left px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              ${s}
            </button>
          `)}
        </div>
      </div>
    </div>
  `;
}

// ─── Auto-growing Textarea ───────────────────────────────────────────────────

function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    // Reset height after clearing
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    });
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return html`
    <div class="border-t border-slate-200 bg-white p-3">
      <div class="flex items-end gap-2">
        <textarea
          ref=${textareaRef}
          value=${value}
          onInput=${(e) => setValue(e.target.value)}
          onKeyDown=${handleKeyDown}
          placeholder="Ask about the knowledge base..."
          disabled=${disabled}
          rows="1"
          class="flex-1 resize-none px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg
                 text-slate-700 placeholder-slate-400
                 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500
                 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          style=${{ maxHeight: '120px', minHeight: '38px' }}
        />
        <button
          onClick=${handleSend}
          disabled=${disabled || !value.trim()}
          class=${[
            'flex-shrink-0 p-2 rounded-lg transition-colors',
            disabled || !value.trim()
              ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
              : 'bg-navy-700 text-white hover:bg-navy-800 shadow-sm',
          ].join(' ')}
          aria-label="Send message"
          title="Send (Enter)"
        >
          <${SendIcon} size=${18} />
        </button>
      </div>
      <p class="text-[10px] text-slate-400 mt-1.5 text-center">
        Shift+Enter for new line. Answers are from the knowledge base only.
      </p>
    </div>
  `;
}

// ─── Entry Proposal Parser ──────────────────────────────────────────────────
// Detects when the AI proposes creating an entry (JSON block with category/title/content)

function parseEntryProposal(text) {
  // Look for a JSON code block that has at minimum category, title, and content
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (!fenceMatch) return null;

  try {
    const obj = JSON.parse(fenceMatch[1].trim());
    if (obj.category && obj.title && obj.content) {
      return {
        category: obj.category,
        title: obj.title,
        content: obj.content,
        tags: obj.tags || [],
        priority: obj.priority || 'medium',
        meta: obj.meta || {},
      };
    }
  } catch (_) { /* not valid JSON proposal */ }
  return null;
}

// ─── Pending Entry Approval Card ────────────────────────────────────────────

function PendingEntryCard({ entry, onApprove, onDismiss }) {
  return html`
    <div class="mx-3 mb-3 p-3 bg-green-50 border border-green-200 rounded-xl space-y-2">
      <div class="flex items-center gap-2 text-green-800">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
        </svg>
        <span class="text-xs font-semibold uppercase tracking-wide">AI-Generated Entry</span>
      </div>
      <p class="text-sm font-medium text-slate-800">${entry.title}</p>
      <p class="text-xs text-slate-500 capitalize">${entry.category} • ${entry.priority} priority</p>
      <div class="flex gap-2">
        <button
          onClick=${onApprove}
          class="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
        >
          Add to Knowledge Base
        </button>
        <button
          onClick=${onDismiss}
          class="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  `;
}

// ─── Main AIChatSidebar Component ────────────────────────────────────────────

export default function AIChatSidebar({ isOpen, onClose }) {
  const { entries, billet, narratives, addEntry } = useApp();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingEntry, setPendingEntry] = useState(null);
  const messagesEndRef = useRef(null);
  const panelRef = useRef(null);

  // Get current page from hash
  const getCurrentPage = useCallback(() => {
    const raw = window.location.hash.replace(/^#\/?/, '');
    return raw.split('?')[0].toLowerCase() || 'dashboard';
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Handle sending a message
  const handleSend = useCallback(async (text) => {
    const userMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const pageContext = getCurrentPage();
      const responseText = await AIService.chat(updatedMessages, entries, billet, narratives, pageContext);

      // Check if the AI is proposing an entry to create (looks for a JSON block with category+title+content)
      const entryProposal = parseEntryProposal(responseText);
      if (entryProposal) {
        setPendingEntry(entryProposal);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch (err) {
      console.error('[AIChatSidebar] Error:', err);
      setMessages(prev => [...prev, {
        role: 'system',
        content: 'An unexpected error occurred. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  }, [messages, entries, billet, narratives]);

  // Clear chat
  const handleClear = useCallback(() => {
    setMessages([]);
  }, []);

  // Handle suggestion click (from welcome screen)
  const handleSuggestion = useCallback((text) => {
    handleSend(text);
  }, [handleSend]);

  // Handle approving an AI-proposed entry
  const handleApproveEntry = useCallback(() => {
    if (!pendingEntry) return;
    const now = new Date().toISOString();
    const intervalDays = 90;
    const verifyBy = new Date(Date.now() + intervalDays * 86400000).toISOString();
    const newEntry = {
      ...pendingEntry,
      id: 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      status: 'active',
      startHere: false,
      verifiedAt: now,
      verifyBy,
      verifiedBy: 'ai-assisted',
      verificationNote: 'AI-generated entry — review for accuracy',
      createdAt: now,
      updatedAt: now,
    };
    addEntry(newEntry);
    setMessages(prev => [...prev, {
      role: 'system',
      content: '✓ Entry "' + pendingEntry.title + '" added to ' + pendingEntry.category + '.',
    }]);
    setPendingEntry(null);
  }, [pendingEntry, addEntry]);

  const handleDismissEntry = useCallback(() => {
    setPendingEntry(null);
  }, []);

  // Listen for open-ai-chat events from other components
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.query) {
        handleSend(e.detail.query);
      }
    };
    window.addEventListener('open-ai-chat', handler);
    return () => window.removeEventListener('open-ai-chat', handler);
  }, [handleSend]);

  const aiAvailable = AIService.isAvailable();
  const currentPage = getCurrentPage();

  if (!isOpen) return null;

  return html`
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-40 bg-black/30 transition-opacity"
      onClick=${onClose}
    />

    <!-- Panel -->
    <div
      ref=${panelRef}
      class="fixed top-0 right-0 z-50 h-full w-full sm:w-[400px] flex flex-col bg-white shadow-2xl slide-in"
      onClick=${(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 bg-navy-900 text-white flex-shrink-0">
        <div class="flex items-center gap-2">
          <${SparkleIcon} size=${20} />
          <h2 class="text-base font-semibold">Passdown AI</h2>
        </div>
        <div class="flex items-center gap-1">
          ${messages.length > 0 && html`
            <button
              onClick=${handleClear}
              class="p-1.5 rounded-md text-navy-300 hover:text-white hover:bg-navy-800 transition-colors"
              aria-label="Clear chat"
              title="Clear chat"
            >
              <${TrashIcon} size=${16} />
            </button>
          `}
          <button
            onClick=${onClose}
            class="p-1.5 rounded-md text-navy-300 hover:text-white hover:bg-navy-800 transition-colors"
            aria-label="Close"
            title="Close (Esc)"
          >
            <${IconX} size=${20} />
          </button>
        </div>
      </div>

      <!-- Body -->
      ${!aiAvailable && html`
        <${SetupInstructions} />
      `}

      ${aiAvailable && !AIService.isSignedIn() && html`
        <${SignInPrompt} onSignIn=${() => AIService.signIn()} />
      `}

      ${aiAvailable && AIService.isSignedIn() && messages.length === 0 && !loading && html`
        <${WelcomePrompt} onSuggestion=${handleSuggestion} currentPage=${currentPage} />
      `}

      ${aiAvailable && AIService.isSignedIn() && (messages.length > 0 || loading) && html`
        <div class="flex-1 overflow-y-auto p-4">
          ${messages.map((msg, i) => html`
            <${MessageBubble} key=${i} message=${msg} />
          `)}
          ${loading && html`
            <div class="flex justify-start mb-3">
              <div class="rounded-2xl rounded-bl-md bg-slate-100 border border-slate-200">
                <${LoadingDots} />
              </div>
            </div>
          `}
          <div ref=${messagesEndRef} />
        </div>
      `}

      <!-- Pending Entry Approval -->
      ${pendingEntry && html`
        <${PendingEntryCard}
          entry=${pendingEntry}
          onApprove=${handleApproveEntry}
          onDismiss=${handleDismissEntry}
        />
      `}

      <!-- Input (only when AI is available and signed in) -->
      ${aiAvailable && AIService.isSignedIn() && html`
        <${ChatInput} onSend=${handleSend} disabled=${loading} />
      `}
    </div>
  `;
}
