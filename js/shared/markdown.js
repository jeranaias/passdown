import { html } from '../core/config.js';

const { useRef, useEffect, useMemo } = React;

// ─── XSS Sanitization ──────────────────────────────────────────────────────

function sanitizeHTML(html) {
  // Remove <script> tags and their contents
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove on* event handler attributes
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Remove javascript: protocol in href/src
  clean = clean.replace(/(href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1=""');

  // Remove <iframe>, <object>, <embed>, <form>, <input> tags
  clean = clean.replace(/<\/?(iframe|object|embed|form|input|textarea|button)\b[^>]*>/gi, '');

  // Remove data: protocol in src attributes (except data:image for inline images)
  clean = clean.replace(/src\s*=\s*"data:(?!image\/)[^"]*"/gi, 'src=""');

  // Remove style attributes that could contain expressions
  clean = clean.replace(/style\s*=\s*"[^"]*expression\s*\([^"]*"/gi, '');

  return clean;
}

// ─── Configure marked ───────────────────────────────────────────────────────

function getMarked() {
  if (typeof window.marked === 'undefined') {
    console.warn('[Markdown] marked.js not loaded');
    return null;
  }
  return window.marked;
}

// ─── Render Markdown ────────────────────────────────────────────────────────

/**
 * Render markdown text to sanitized HTML string.
 * @param {string} text - Raw markdown
 * @returns {string} Sanitized HTML
 */
export function renderMarkdown(text) {
  if (!text || typeof text !== 'string') return '';

  const markedLib = getMarked();
  if (!markedLib) {
    // Fallback: escape HTML and convert newlines to <br>
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  // Configure marked
  markedLib.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false,
    mangle: false,
  });

  try {
    const rawHTML = markedLib.parse(text);
    return sanitizeHTML(rawHTML);
  } catch (e) {
    console.error('[Markdown] Parse error:', e);
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }
}

// ─── MarkdownPreview Component ──────────────────────────────────────────────

/**
 * React component that renders markdown content with proper styling.
 * Uses dangerouslySetInnerHTML with sanitization.
 */
export function MarkdownPreview({ content, className = '' }) {
  const renderedHTML = useMemo(() => renderMarkdown(content), [content]);

  if (!content) {
    return html`<div class="text-slate-400 italic text-sm">No content</div>`;
  }

  return html`
    <div
      class=${'markdown-body text-slate-700 text-sm leading-relaxed ' + className}
      dangerouslySetInnerHTML=${{ __html: renderedHTML }}
    />
  `;
}
