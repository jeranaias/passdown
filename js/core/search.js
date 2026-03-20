// ─── Stopwords ──────────────────────────────────────────────────────────────
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'not', 'no', 'nor',
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'doing',
  'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
  'she', 'her', 'it', 'its', 'they', 'them', 'their',
  'this', 'that', 'these', 'those',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'up', 'about', 'into', 'over', 'after',
  'if', 'then', 'so', 'as', 'what', 'which', 'who', 'when', 'where', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'than', 'too', 'very', 'just', 'also',
]);

// ─── Tokenization ───────────────────────────────────────────────────────────

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

// ─── Build Index ────────────────────────────────────────────────────────────

/**
 * Build an inverted index from entries.
 * Returns Map<token, Map<entryId, weight>>
 * Title tokens get 2x weight, tag tokens get 3x, content gets 1x.
 */
export function buildIndex(entries) {
  const index = new Map(); // token -> Map<entryId, totalWeight>

  function addTokens(tokens, entryId, weight) {
    for (const token of tokens) {
      if (!index.has(token)) {
        index.set(token, new Map());
      }
      const entryWeights = index.get(token);
      entryWeights.set(entryId, (entryWeights.get(entryId) || 0) + weight);
    }
  }

  for (const entry of entries) {
    const id = entry.id;

    // Title: 2x weight
    addTokens(tokenize(entry.title), id, 2);

    // Content/body: 1x weight
    addTokens(tokenize(entry.content), id, 1);

    // Tags: 3x weight
    if (Array.isArray(entry.tags)) {
      for (const tag of entry.tags) {
        addTokens(tokenize(tag), id, 3);
      }
    }

    // Category label: 1x weight
    addTokens(tokenize(entry.category), id, 1);

    // Priority: 1x weight
    addTokens(tokenize(entry.priority), id, 1);

    // Meta fields (stakeholder names, frequency, etc.): 1x weight
    if (entry.meta && typeof entry.meta === 'object') {
      for (const value of Object.values(entry.meta)) {
        if (typeof value === 'string') {
          addTokens(tokenize(value), id, 1);
        } else if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === 'string') {
              addTokens(tokenize(item), id, 1);
            }
          }
        }
      }
    }
  }

  return index;
}

// ─── Search ─────────────────────────────────────────────────────────────────

/**
 * Search entries using the inverted index.
 * @param {string} query - Search query
 * @param {Map} index - Inverted index from buildIndex()
 * @param {Array} entries - Full entries array
 * @param {Object} filters - Optional filters: { category, priority, verificationStatus }
 * @returns {Array<{entry, score, highlights}>} Sorted by score descending
 */
export function search(query, index, entries, filters = {}) {
  if (!query || !query.trim()) {
    // No query — return all entries, filtered only
    let results = entries.map(entry => ({ entry, score: 0, highlights: [] }));
    results = applyFilters(results, filters);
    return results;
  }

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    let results = entries.map(entry => ({ entry, score: 0, highlights: [] }));
    results = applyFilters(results, filters);
    return results;
  }

  // Score each entry
  const scores = new Map(); // entryId -> score

  for (const token of queryTokens) {
    // Exact token match
    if (index.has(token)) {
      const entryWeights = index.get(token);
      for (const [entryId, weight] of entryWeights) {
        scores.set(entryId, (scores.get(entryId) || 0) + weight);
      }
    }

    // Prefix matching for partial queries (minimum 3 chars)
    if (token.length >= 3) {
      for (const [indexToken, entryWeights] of index) {
        if (indexToken !== token && indexToken.startsWith(token)) {
          for (const [entryId, weight] of entryWeights) {
            // Prefix matches get half weight
            scores.set(entryId, (scores.get(entryId) || 0) + weight * 0.5);
          }
        }
      }
    }
  }

  // Build results
  const entryMap = new Map(entries.map(e => [e.id, e]));
  let results = [];

  for (const [entryId, score] of scores) {
    const entry = entryMap.get(entryId);
    if (!entry) continue;

    const highlights = findHighlights(entry, queryTokens);
    results.push({ entry, score, highlights });
  }

  // Apply filters
  results = applyFilters(results, filters);

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

function applyFilters(results, filters) {
  if (!filters) return results;

  return results.filter(({ entry }) => {
    if (filters.category && entry.category !== filters.category) return false;
    if (filters.priority && entry.priority !== filters.priority) return false;
    if (filters.verificationStatus) {
      const status = getVerificationStatus(entry);
      if (status !== filters.verificationStatus) return false;
    }
    return true;
  });
}

function getVerificationStatus(entry) {
  if (!entry.verifiedAt) return 'unverified';
  const now = Date.now();
  const verified = new Date(entry.verifiedAt).getTime();
  const daysSince = (now - verified) / (1000 * 60 * 60 * 24);
  if (daysSince <= 60) return 'current';
  if (daysSince <= 90) return 'expiring';
  return 'stale';
}

function findHighlights(entry, queryTokens) {
  const highlights = [];
  const queryLower = queryTokens.join(' ');

  // Check title
  if (entry.title && hasTokenOverlap(entry.title, queryTokens)) {
    highlights.push({ field: 'title', text: entry.title });
  }

  // Check content — find matching line/paragraph
  if (entry.content) {
    const lines = entry.content.split('\n');
    for (const line of lines) {
      if (line.trim() && hasTokenOverlap(line, queryTokens)) {
        highlights.push({ field: 'content', text: line.trim().slice(0, 200) });
        break; // Only first matching line
      }
    }
  }

  // Check tags
  if (Array.isArray(entry.tags)) {
    for (const tag of entry.tags) {
      if (hasTokenOverlap(tag, queryTokens)) {
        highlights.push({ field: 'tag', text: tag });
      }
    }
  }

  return highlights;
}

function hasTokenOverlap(text, queryTokens) {
  const textTokens = new Set(tokenize(text));
  return queryTokens.some(qt =>
    textTokens.has(qt) ||
    [...textTokens].some(tt => tt.startsWith(qt) && qt.length >= 3)
  );
}

// ─── Update Index ───────────────────────────────────────────────────────────

/**
 * Incrementally update the index when an entry changes.
 * @param {Map} index - Existing inverted index
 * @param {Object|null} oldEntry - Previous version (null if new entry)
 * @param {Object|null} newEntry - New version (null if deleted)
 * @returns {Map} Updated index
 */
export function updateIndex(index, oldEntry, newEntry) {
  // Remove old entry tokens
  if (oldEntry) {
    const id = oldEntry.id;
    for (const [token, entryWeights] of index) {
      entryWeights.delete(id);
      if (entryWeights.size === 0) {
        index.delete(token);
      }
    }
  }

  // Add new entry tokens
  if (newEntry) {
    const tempEntries = [newEntry];
    const tempIndex = buildIndex(tempEntries);
    for (const [token, entryWeights] of tempIndex) {
      if (!index.has(token)) {
        index.set(token, new Map());
      }
      const existing = index.get(token);
      for (const [entryId, weight] of entryWeights) {
        existing.set(entryId, (existing.get(entryId) || 0) + weight);
      }
    }
  }

  return index;
}

// ─── Highlight Matches ──────────────────────────────────────────────────────

/**
 * Wrap matching query terms in <mark> tags within the given text.
 * Returns an HTML string.
 */
export function highlightMatches(text, query) {
  if (!text || !query) return text || '';

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return text;

  // Escape special regex characters in tokens
  const escaped = queryTokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  // Build regex that matches any query token (word boundary aware)
  const pattern = new RegExp(`\\b(${escaped.join('|')})`, 'gi');

  // Replace matches with <mark> wrapped versions
  // Be careful to preserve original casing
  return text.replace(pattern, '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>');
}

export { STOPWORDS, tokenize, getVerificationStatus };
