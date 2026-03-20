import CONFIG, { STORAGE_KEYS } from './config.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    console.warn(`[Store] Failed to parse ${key}, returning fallback`);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`[Store] Failed to write ${key}:`, e);
    return false;
  }
}

// ─── Store ──────────────────────────────────────────────────────────────────

const Store = {

  // ── ID Generation ───────────────────────────────────────────────────────
  generateId(prefix = 'x') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  },

  // ── Full State ──────────────────────────────────────────────────────────
  load() {
    return {
      billet:     this.getBillet(),
      entries:    this.getEntries(),
      narratives: this.getNarratives(),
      startHere:  this.getStartHere(),
      settings:   this.getSettings(),
      version:    localStorage.getItem(STORAGE_KEYS.VERSION) || CONFIG.VERSION,
    };
  },

  // ── Billet ──────────────────────────────────────────────────────────────
  saveBillet(billet) {
    writeJSON(STORAGE_KEYS.BILLET, billet);
    return billet;
  },

  getBillet() {
    return readJSON(STORAGE_KEYS.BILLET, { ...CONFIG.DEFAULT_BILLET });
  },

  // ── Entries ─────────────────────────────────────────────────────────────
  saveEntries(entries) {
    writeJSON(STORAGE_KEYS.ENTRIES, entries);
    return entries;
  },

  getEntries() {
    return readJSON(STORAGE_KEYS.ENTRIES, []);
  },

  addEntry(entry) {
    const entries = this.getEntries();
    const newEntry = {
      ...entry,
      id: entry.id || this.generateId('e'),
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      verifiedAt: entry.verifiedAt || new Date().toISOString(),
    };
    entries.push(newEntry);
    this.saveEntries(entries);
    return entries;
  },

  updateEntry(id, updates) {
    const entries = this.getEntries();
    const idx = entries.findIndex(e => e.id === id);
    if (idx === -1) {
      console.warn(`[Store] Entry not found: ${id}`);
      return entries;
    }
    entries[idx] = {
      ...entries[idx],
      ...updates,
      id, // preserve original id
      updatedAt: new Date().toISOString(),
    };
    this.saveEntries(entries);
    return entries;
  },

  deleteEntry(id) {
    const entries = this.getEntries().filter(e => e.id !== id);
    this.saveEntries(entries);
    // Also remove from startHere if present
    const startHere = this.getStartHere().filter(sid => sid !== id);
    this.saveStartHere(startHere);
    return entries;
  },

  // ── Narratives ──────────────────────────────────────────────────────────
  saveNarratives(narratives) {
    writeJSON(STORAGE_KEYS.NARRATIVES, narratives);
    return narratives;
  },

  getNarratives() {
    return readJSON(STORAGE_KEYS.NARRATIVES, []);
  },

  addNarrative(narrative) {
    const narratives = this.getNarratives();
    const newNarrative = {
      ...narrative,
      id: narrative.id || this.generateId('n'),
      createdAt: narrative.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    narratives.push(newNarrative);
    this.saveNarratives(narratives);
    return narratives;
  },

  updateNarrative(id, updates) {
    const narratives = this.getNarratives();
    const idx = narratives.findIndex(n => n.id === id);
    if (idx === -1) {
      console.warn(`[Store] Narrative not found: ${id}`);
      return narratives;
    }
    narratives[idx] = {
      ...narratives[idx],
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };
    this.saveNarratives(narratives);
    return narratives;
  },

  // ── Start Here ──────────────────────────────────────────────────────────
  saveStartHere(ids) {
    writeJSON(STORAGE_KEYS.START_HERE, ids);
    return ids;
  },

  getStartHere() {
    return readJSON(STORAGE_KEYS.START_HERE, []);
  },

  // ── Settings ────────────────────────────────────────────────────────────
  saveSettings(settings) {
    writeJSON(STORAGE_KEYS.SETTINGS, settings);
    return settings;
  },

  getSettings() {
    return readJSON(STORAGE_KEYS.SETTINGS, { ...CONFIG.DEFAULT_SETTINGS });
  },

  // ── Export / Import ─────────────────────────────────────────────────────
  exportAll() {
    return {
      version: CONFIG.VERSION,
      exportedAt: new Date().toISOString(),
      billet: this.getBillet(),
      entries: this.getEntries(),
      narratives: this.getNarratives(),
      startHere: this.getStartHere(),
      settings: this.getSettings(),
    };
  },

  importAll(data, mode = 'replace') {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid import data');
    }

    if (mode === 'replace') {
      // Full replacement
      if (data.billet) this.saveBillet(data.billet);
      if (data.entries) this.saveEntries(data.entries);
      if (data.narratives) this.saveNarratives(data.narratives);
      if (data.startHere) this.saveStartHere(data.startHere);
      if (data.settings) this.saveSettings(data.settings);
      if (data.version) localStorage.setItem(STORAGE_KEYS.VERSION, data.version);
    } else if (mode === 'merge') {
      // Merge entries by id — newer updatedAt wins
      if (data.billet) {
        const existing = this.getBillet();
        this.saveBillet({ ...existing, ...data.billet });
      }

      if (data.entries) {
        const existing = this.getEntries();
        const existingMap = new Map(existing.map(e => [e.id, e]));

        for (const entry of data.entries) {
          const current = existingMap.get(entry.id);
          if (!current) {
            existingMap.set(entry.id, entry);
          } else {
            // Newer updatedAt wins
            const currentTime = new Date(current.updatedAt || 0).getTime();
            const incomingTime = new Date(entry.updatedAt || 0).getTime();
            if (incomingTime > currentTime) {
              existingMap.set(entry.id, entry);
            }
          }
        }
        this.saveEntries([...existingMap.values()]);
      }

      if (data.narratives) {
        const existing = this.getNarratives();
        const existingMap = new Map(existing.map(n => [n.id, n]));

        for (const narrative of data.narratives) {
          const current = existingMap.get(narrative.id);
          if (!current) {
            existingMap.set(narrative.id, narrative);
          } else {
            const currentTime = new Date(current.updatedAt || 0).getTime();
            const incomingTime = new Date(narrative.updatedAt || 0).getTime();
            if (incomingTime > currentTime) {
              existingMap.set(narrative.id, narrative);
            }
          }
        }
        this.saveNarratives([...existingMap.values()]);
      }

      if (data.startHere) {
        const existing = this.getStartHere();
        const merged = [...new Set([...existing, ...data.startHere])];
        this.saveStartHere(merged);
      }

      if (data.settings) {
        const existing = this.getSettings();
        this.saveSettings({ ...existing, ...data.settings });
      }
    } else {
      throw new Error(`Unknown import mode: ${mode}`);
    }

    return this.load();
  },

  // ── Clear ───────────────────────────────────────────────────────────────
  clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  },

  // ── Storage Size ────────────────────────────────────────────────────────
  getStorageSize() {
    let bytes = 0;
    for (const key of Object.values(STORAGE_KEYS)) {
      const value = localStorage.getItem(key);
      if (value) {
        // Each char in JS is 2 bytes, but localStorage typically uses UTF-16
        bytes += key.length * 2 + value.length * 2;
      }
    }
    return bytes;
  },
};

export default Store;
