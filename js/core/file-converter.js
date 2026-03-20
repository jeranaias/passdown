// ─── File Converter Module ──────────────────────────────────────────────────
// Converts PDF, DOCX, Excel, CSV, TXT, and Markdown files to markdown content.
// Libraries are dynamically imported only when needed to keep initial load fast.

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Extension → converter mapping ─────────────────────────────────────────

const EXTENSION_MAP = {
  '.pdf':  'pdf',
  '.docx': 'docx',
  '.xlsx': 'excel',
  '.xls':  'excel',
  '.csv':  'csv',
  '.txt':  'text',
  '.md':   'markdown',
};

const MIME_MAP = {
  'application/pdf':                                                      'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':     'excel',
  'application/vnd.ms-excel':                                              'excel',
  'text/csv':                                                              'csv',
  'text/plain':                                                            'text',
  'text/markdown':                                                         'markdown',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getExtension(filename) {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

function getBaseName(filename) {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(0, dot) : filename;
}

function detectType(file) {
  const ext = getExtension(file.name);
  if (EXTENSION_MAP[ext]) return EXTENSION_MAP[ext];
  if (file.type && MIME_MAP[file.type]) return MIME_MAP[file.type];
  return null;
}

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file: ' + file.name));
    reader.readAsArrayBuffer(file);
  });
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file: ' + file.name));
    reader.readAsText(file);
  });
}

/** Escape pipe characters for markdown table cells. */
function escapeCell(val) {
  if (val == null) return '';
  return String(val).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

/** Convert a 2D array (rows of cells) into a markdown table string. */
function arrayToMarkdownTable(rows) {
  if (!rows || rows.length === 0) return '';

  // Use the first row as headers
  const headers = rows[0].map(escapeCell);
  const separator = headers.map(() => '---');
  const body = rows.slice(1).map(row => row.map(escapeCell));

  const lines = [];
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('| ' + separator.join(' | ') + ' |');
  for (const row of body) {
    // Pad row to match header length
    while (row.length < headers.length) row.push('');
    lines.push('| ' + row.slice(0, headers.length).join(' | ') + ' |');
  }
  return lines.join('\n');
}

// ─── Library loaders (cached) ───────────────────────────────────────────────

let _pdfjsLib = null;
let _mammoth = null;
let _XLSX = null;

async function loadPdfJs() {
  if (_pdfjsLib) return _pdfjsLib;
  try {
    const mod = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs');
    _pdfjsLib = mod;
    // Set worker source
    _pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs';
    return _pdfjsLib;
  } catch (err) {
    throw new Error(
      'Could not load the PDF library. This may happen on restricted networks. '
      + 'Try opening the PDF separately and pasting its content into the editor.'
    );
  }
}

async function loadMammoth() {
  if (_mammoth) return _mammoth;
  try {
    const mod = await import('https://esm.sh/mammoth@1.8.0');
    _mammoth = mod.default || mod;
    return _mammoth;
  } catch (err) {
    throw new Error(
      'Could not load the DOCX library. This may happen on restricted networks. '
      + 'Try opening the document in Word, copying its content, and pasting it into the editor.'
    );
  }
}

async function loadSheetJS() {
  if (_XLSX) return _XLSX;
  // SheetJS may already be on the page as a global
  if (typeof window !== 'undefined' && window.XLSX) {
    _XLSX = window.XLSX;
    return _XLSX;
  }
  try {
    // Load as a classic script (SheetJS doesn't export ESM cleanly from CDN)
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    _XLSX = window.XLSX;
    if (!_XLSX) throw new Error('SheetJS loaded but XLSX global not found');
    return _XLSX;
  } catch (err) {
    throw new Error(
      'Could not load the Excel library. This may happen on restricted networks. '
      + 'Try opening the spreadsheet in Excel, copying its content, and pasting it into the editor.'
    );
  }
}

// ─── Converters ─────────────────────────────────────────────────────────────

async function convertPDF(file) {
  const pdfjsLib = await loadPdfJs();
  const buffer = await readAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const totalPages = pdf.numPages;
  const pages = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Group text items by approximate Y position for better line detection
    const lineMap = new Map();
    for (const item of textContent.items) {
      if (!item.str) continue;
      // Round Y to nearest integer to group items on the same line
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y).push({ x: item.transform[4], text: item.str });
    }

    // Sort lines by Y descending (PDF coordinates: origin at bottom-left)
    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
    const lines = [];
    for (const y of sortedYs) {
      const items = lineMap.get(y).sort((a, b) => a.x - b.x);
      const lineText = items.map(it => it.text).join(' ');
      if (lineText.trim()) lines.push(lineText.trim());
    }

    if (lines.length > 0) {
      pages.push(lines.join('\n'));
    }
  }

  const content = pages.join('\n\n---\n\n');
  return {
    content,
    title: getBaseName(file.name),
    metadata: { type: 'pdf', pages: totalPages, size: file.size },
  };
}

async function convertDOCX(file) {
  const mammoth = await loadMammoth();
  const buffer = await readAsArrayBuffer(file);
  const result = await mammoth.convertToMarkdown({ arrayBuffer: buffer });

  const content = result.value || '';
  const warnings = result.messages
    .filter(m => m.type === 'warning')
    .map(m => m.message);

  return {
    content,
    title: getBaseName(file.name),
    metadata: {
      type: 'docx',
      size: file.size,
      ...(warnings.length > 0 ? { warnings } : {}),
    },
  };
}

async function convertExcel(file) {
  const XLSX = await loadSheetJS();
  const buffer = await readAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: 'array' });

  const sections = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Skip empty sheets
    if (rows.length === 0) continue;

    let section = '';
    // Add sheet name as heading if multiple sheets
    if (workbook.SheetNames.length > 1) {
      section += '## ' + sheetName + '\n\n';
    }
    section += arrayToMarkdownTable(rows);
    sections.push(section);
  }

  return {
    content: sections.join('\n\n'),
    title: getBaseName(file.name),
    metadata: {
      type: 'excel',
      sheets: workbook.SheetNames.length,
      size: file.size,
    },
  };
}

async function convertCSV(file) {
  const text = await readAsText(file);

  // Simple CSV parser that handles quoted fields
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        current.push(field);
        field = '';
        if (current.some(c => c.trim())) rows.push(current);
        current = [];
        if (ch === '\r') i++; // skip \n after \r
      } else if (ch === '\r') {
        current.push(field);
        field = '';
        if (current.some(c => c.trim())) rows.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }
  // Final field / row
  if (field || current.length > 0) {
    current.push(field);
    if (current.some(c => c.trim())) rows.push(current);
  }

  const content = arrayToMarkdownTable(rows);
  return {
    content,
    title: getBaseName(file.name),
    metadata: { type: 'csv', rows: rows.length, size: file.size },
  };
}

async function convertText(file) {
  const content = await readAsText(file);
  return {
    content,
    title: getBaseName(file.name),
    metadata: { type: 'text', size: file.size },
  };
}

async function convertMarkdown(file) {
  const content = await readAsText(file);
  return {
    content,
    title: getBaseName(file.name),
    metadata: { type: 'markdown', size: file.size },
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

const CONVERTERS = {
  pdf:      convertPDF,
  docx:     convertDOCX,
  excel:    convertExcel,
  csv:      convertCSV,
  text:     convertText,
  markdown: convertMarkdown,
};

const FileConverter = {
  /**
   * Convert a File object to markdown content.
   * @param {File} file
   * @returns {Promise<{content: string, title: string, metadata: object}>}
   */
  async convert(file) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `File "${file.name}" exceeds the 10 MB size limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`
      );
    }

    const type = detectType(file);
    if (!type) {
      throw new Error(
        `Unsupported file type: "${getExtension(file.name) || file.type || 'unknown'}". `
        + 'Supported formats: PDF, DOCX, XLSX, CSV, TXT, MD.'
      );
    }

    const converter = CONVERTERS[type];
    try {
      return await converter(file);
    } catch (err) {
      // If it's already our error message, re-throw as-is
      if (err.message && (
        err.message.includes('Could not load') ||
        err.message.includes('exceeds the')
      )) {
        throw err;
      }
      // Wrap unexpected errors
      throw new Error(
        `Failed to convert "${file.name}": ${err.message || 'Unknown error'}. `
        + 'You can try pasting the content manually instead.'
      );
    }
  },

  /** Convert a PDF file to markdown. */
  convertPDF,

  /** Convert a DOCX file to markdown. */
  convertDOCX,

  /** Convert an Excel file to markdown. */
  convertExcel,

  /** Convert a CSV file to markdown. */
  convertCSV,

  /** Convert a plain text file (returned as-is). */
  convertText,

  /** Convert a markdown file (returned as-is). */
  convertMarkdown,

  /**
   * Returns accepted file extensions and MIME types for use in file inputs.
   * @returns {{ extensions: string[], mimeTypes: string[], accept: string }}
   */
  getSupportedTypes() {
    const extensions = Object.keys(EXTENSION_MAP);
    const mimeTypes = Object.keys(MIME_MAP);
    return {
      extensions,
      mimeTypes,
      accept: [...extensions, ...mimeTypes].join(','),
    };
  },

  /**
   * Check whether a file's type is supported.
   * @param {File} file
   * @returns {boolean}
   */
  isSupported(file) {
    return detectType(file) !== null;
  },

  /** Maximum file size in bytes. */
  MAX_FILE_SIZE,
};

export default FileConverter;
