// ─── OLF Export ──────────────────────────────────────────────────────────────
// Transforms Passdown data into an Operational Language Framework (OLF)
// compliant artifact for enterprise registry integration and cross-command
// knowledge discovery.

import Store from './store.js';
import CONFIG, { CATEGORIES } from './config.js';

// ─── OLF Dimension Mapping ──────────────────────────────────────────────────

const OLF_DIMENSION_MAP = Object.freeze({
  process:     { olf_dimension: 'output_template',        label: 'Processes & SOPs' },
  decision:    { olf_dimension: 'mission_context',        label: 'Decision Log' },
  stakeholder: { olf_dimension: 'audience',               label: 'Stakeholder Map' },
  calendar:    { olf_dimension: 'operational_rhythm',     label: 'Recurring Calendar' },
  lesson:      { olf_dimension: 'institutional_knowledge', label: 'Lessons & Gotchas' },
  issue:       { olf_dimension: 'operational_continuity', label: 'Active Issues' },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitizeFilename(str) {
  return (str || 'untitled').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

function getCategoryLabel(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.label : categoryId;
}

function buildKnowledgeDomains(entries) {
  const grouped = {};

  for (const cat of CATEGORIES) {
    grouped[cat.id] = [];
  }

  for (const entry of entries) {
    const catId = entry.category || 'process';
    if (!grouped[catId]) grouped[catId] = [];
    grouped[catId].push({
      title: entry.title || '',
      content: entry.content || '',
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      priority: entry.priority || 'medium',
      verified: !!entry.verifiedAt,
      verified_at: entry.verifiedAt || null,
    });
  }

  const domains = [];
  for (const cat of CATEGORIES) {
    const dim = OLF_DIMENSION_MAP[cat.id];
    if (!dim) continue;
    domains.push({
      olf_dimension: dim.olf_dimension,
      category: cat.id,
      label: dim.label,
      entries: grouped[cat.id] || [],
    });
  }

  return domains;
}

function buildNarrativeKnowledge(narratives) {
  return narratives.map(n => ({
    prompt: n.prompt || n.question || '',
    response: n.response || n.answer || '',
    category: n.category || 'tacit',
  }));
}

function buildReadinessMetrics(entries, narratives, startHere) {
  const totalEntries = entries.length;
  const verifiedEntries = entries.filter(e => !!e.verifiedAt).length;

  const categoryCoverage = {};
  for (const cat of CATEGORIES) {
    categoryCoverage[cat.id] = 0;
  }
  for (const entry of entries) {
    const catId = entry.category || 'process';
    if (categoryCoverage[catId] !== undefined) {
      categoryCoverage[catId]++;
    }
  }

  return {
    total_entries: totalEntries,
    verified_entries: verifiedEntries,
    narrative_completion: `${narratives.length}/12`,
    category_coverage: categoryCoverage,
    has_start_here_list: Array.isArray(startHere) && startHere.length > 0,
  };
}

// ─── OLFExport ───────────────────────────────────────────────────────────────

const OLFExport = {

  /**
   * Generate an OLF-compliant artifact from all Passdown data.
   * @returns {Object} OLF-formatted export object
   */
  generate() {
    const billet     = Store.getBillet();
    const entries    = Store.getEntries();
    const narratives = Store.getNarratives();
    const startHere  = Store.getStartHere();

    return {
      olf_version: '1.0.0',
      generated_at: new Date().toISOString(),
      generator: `${CONFIG.APP_NAME} v${CONFIG.VERSION}`,
      classification: 'UNCLASSIFIED',

      persona: {
        billet: billet.title || '',
        organization: billet.unit || '',
        mission: billet.billetDescription || '',
        turnover_date: billet.turnoverDate || null,
      },

      knowledge_domains: buildKnowledgeDomains(entries),

      narrative_knowledge: buildNarrativeKnowledge(narratives),

      readiness_metrics: buildReadinessMetrics(entries, narratives, startHere),

      compliance_statement: {
        framework: 'OLF v1.0',
        policy_alignment: ['NAVMC 3000.1', 'NAVMC 5239.1'],
        opsec_reviewed: false,
        opsec_reviewer: null,
        distribution: 'Pending OPSEC review',
      },
    };
  },

  /**
   * Generate and download the OLF export as a JSON file.
   * Filename: olf-passdown-[billet-title]-[date].json
   */
  download() {
    const data = this.generate();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const billetSlug = sanitizeFilename(data.persona.billet || 'billet');
    const dateStr = new Date().toISOString().slice(0, 10);

    const a = document.createElement('a');
    a.href = url;
    a.download = `olf-passdown-${billetSlug}-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return data;
  },
};

export default OLFExport;
