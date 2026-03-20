// ─── File Drop Zone Component ───────────────────────────────────────────────
// Drag-and-drop / click-to-browse file upload that converts supported files
// (PDF, DOCX, XLSX, CSV, TXT, MD) to markdown via FileConverter.

import { html } from '../core/config.js';
import FileConverter from '../core/file-converter.js';

const { useState, useRef, useCallback } = React;

/**
 * FileDropZone - Reusable drag-and-drop file import component.
 *
 * @param {Object} props
 * @param {function({content: string, title: string, metadata: object}): void} props.onContent
 * @param {function(string): void} [props.onError]
 * @param {string} [props.className]
 */
export default function FileDropZone({ onContent, onError, className = '' }) {
  const [dragOver, setDragOver] = useState(false);
  const [converting, setConverting] = useState(false);
  const [lastFile, setLastFile] = useState(null); // { name, type }
  const fileInputRef = useRef(null);

  const supportedTypes = FileConverter.getSupportedTypes();

  // ─── Process files ──────────────────────────────────────────────────────

  const processFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;

    setConverting(true);
    setLastFile(null);

    try {
      for (const file of files) {
        // Size check
        if (file.size > FileConverter.MAX_FILE_SIZE) {
          const msg = `"${file.name}" exceeds the 10 MB size limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`;
          if (onError) onError(msg);
          continue;
        }

        // Support check
        if (!FileConverter.isSupported(file)) {
          const msg = `"${file.name}" is not a supported file type. Supported: PDF, DOCX, XLSX, CSV, TXT, MD.`;
          if (onError) onError(msg);
          continue;
        }

        try {
          const result = await FileConverter.convert(file);
          setLastFile({ name: file.name, type: result.metadata?.type || 'file' });
          if (onContent) onContent(result);
        } catch (err) {
          if (onError) onError(err.message || 'Failed to convert file.');
        }
      }
    } finally {
      setConverting(false);
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [onContent, onError]);

  // ─── Drag event handlers ────────────────────────────────────────────────

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only leave if we're leaving the drop zone itself (not a child)
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files) processFiles([...files]);
  }, [processFiles]);

  // ─── Click-to-browse handler ────────────────────────────────────────────

  const handleClick = useCallback(() => {
    if (!converting && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [converting]);

  const handleFileInput = useCallback((e) => {
    const files = e.target.files;
    if (files) processFiles([...files]);
  }, [processFiles]);

  // ─── Type badge label ──────────────────────────────────────────────────

  const typeLabels = {
    pdf:      'PDF',
    docx:     'DOCX',
    excel:    'Excel',
    csv:      'CSV',
    text:     'Text',
    markdown: 'Markdown',
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  const borderColor = dragOver
    ? 'border-navy-400 bg-navy-50/50'
    : 'border-slate-300 hover:border-slate-400';

  const spinner = html`
    <svg class="animate-spin h-5 w-5 text-navy-600" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  `;

  // Upload icon (document with arrow)
  const uploadIcon = html`
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      class=${dragOver ? 'text-navy-500' : 'text-slate-400'}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <polyline points="9 15 12 12 15 15" />
    </svg>
  `;

  return html`
    <div class=${className}>
      <div
        class=${'relative flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed rounded-lg cursor-pointer transition-colors select-none ' + borderColor}
        onDragEnter=${handleDragEnter}
        onDragOver=${handleDragOver}
        onDragLeave=${handleDragLeave}
        onDrop=${handleDrop}
        onClick=${handleClick}
        role="button"
        tabIndex="0"
        onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        aria-label="Drop files here or click to browse"
      >

        ${converting
          ? html`
            <div class="flex items-center gap-2.5 py-1">
              ${spinner}
              <span class="text-sm font-medium text-navy-700">Converting...</span>
            </div>
          `
          : html`
            ${uploadIcon}
            <div class="text-center">
              <p class="text-sm font-medium ${dragOver ? 'text-navy-700' : 'text-slate-600'}">
                Drop files here or click to browse
              </p>
              <p class="text-xs text-slate-400 mt-0.5">
                PDF, DOCX, Excel, CSV, TXT, Markdown (max 10 MB)
              </p>
            </div>
          `
        }

        ${lastFile && !converting && html`
          <div class="flex items-center gap-1.5 mt-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              class="text-green-500">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span class="text-xs text-slate-500">
              ${lastFile.name}
              ${typeLabels[lastFile.type] ? html` <span class="text-slate-400">(${typeLabels[lastFile.type]})</span>` : ''}
            </span>
          </div>
        `}

        <input
          ref=${fileInputRef}
          type="file"
          accept=${supportedTypes.accept}
          multiple
          onChange=${handleFileInput}
          class="hidden"
          tabIndex="-1"
        />
      </div>
    </div>
  `;
}
