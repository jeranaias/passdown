import { html } from '../core/config.js';
import CONFIG, { CATEGORIES, VERIFICATION_INTERVAL_DAYS } from '../core/config.js';
import AIService from '../core/ai-service.js';
import WebLLMService from '../core/webllm-service.js';
import { AppContext, navigate } from './app.js';
import { Button, Badge, Card, ProgressBar, showToast } from '../shared/ui.js';
import { ICON_MAP, IconWarning, IconCheck, IconClock, IconStar } from '../shared/icons.js';

const { useContext, useMemo, useState, useCallback, useEffect } = React;

// --- Helpers ------------------------------------------------------------------

const DAY_MS = 1000 * 60 * 60 * 24;

function daysBetween(dateA, dateB) {
  return Math.round((new Date(dateB).getTime() - new Date(dateA).getTime()) / DAY_MS);
}

function formatDate(iso) {
  if (!iso) return '--';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function getVerificationStatus(entry, intervalDays) {
  if (!entry.verifiedAt) return 'unverified';
  const daysSince = (Date.now() - new Date(entry.verifiedAt).getTime()) / DAY_MS;
  if (daysSince <= intervalDays * 0.67) return 'current';   // within ~60 of 90
  if (daysSince <= intervalDays) return 'expiring';
  return 'stale';
}

// --- Category color map -------------------------------------------------------

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   bar: 'bg-blue-500',   border: 'border-blue-200'   },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', bar: 'bg-purple-500', border: 'border-purple-200' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600',  bar: 'bg-green-500',  border: 'border-green-200'  },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', bar: 'bg-orange-500', border: 'border-orange-200' },
  yellow: { bg: 'bg-amber-50',  text: 'text-amber-600',  bar: 'bg-amber-500',  border: 'border-amber-200'  },
  red:    { bg: 'bg-red-50',    text: 'text-red-600',    bar: 'bg-red-500',    border: 'border-red-200'    },
};

function getColor(colorName) {
  return COLOR_MAP[colorName] || COLOR_MAP.blue;
}

// --- BilletInfoCard -----------------------------------------------------------

function BilletInfoCard({ billet }) {
  const hasInfo = billet.title || billet.unit || billet.billetDescription;

  if (!hasInfo) {
    return html`
      <${Card} className="p-6">
        <div class="flex items-start gap-4">
          <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-navy-50 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="1.5" class="text-navy-400">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-slate-700 mb-1">Billet Not Configured</h3>
            <p class="text-sm text-slate-500 mb-3">
              Set up your billet info in Settings to get started with your turnover dashboard.
            </p>
            <${Button} size="sm" onClick=${() => navigate('settings')}>
              Go to Settings
            <//>
          </div>
        </div>
      <//>
    `;
  }

  return html`
    <${Card} className="p-6">
      <div class="flex items-start gap-4">
        <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-navy-50 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="1.5" class="text-navy-600">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-lg font-bold text-slate-800">${billet.title || 'Untitled Billet'}</h2>
            ${billet.rank && html`<${Badge} color="navy">${billet.rank}<//>`}
          </div>
          ${billet.unit && html`<p class="text-sm text-slate-500 mt-0.5">${billet.unit}</p>`}
          ${billet.billetDescription && html`
            <p class="text-sm text-slate-600 mt-2 line-clamp-2">${billet.billetDescription}</p>
          `}
          ${(billet.outgoingName || billet.incomingName) && html`
            <div class="flex gap-4 mt-3 text-xs text-slate-500">
              ${billet.outgoingName && html`
                <span>Outgoing: <span class="font-medium text-slate-700">${billet.outgoingName}</span></span>
              `}
              ${billet.incomingName && html`
                <span>Incoming: <span class="font-medium text-slate-700">${billet.incomingName}</span></span>
              `}
            </div>
          `}
        </div>
      </div>
    <//>
  `;
}

// --- PCSTimeline --------------------------------------------------------------

function PCSTimeline({ billet, entries }) {
  const turnoverDate = billet.turnoverDate;
  if (!turnoverDate) return null;

  const now = new Date();
  const pcsDate = new Date(turnoverDate);
  const daysRemaining = Math.ceil((pcsDate.getTime() - now.getTime()) / DAY_MS);

  // Assume turnover preparation started 180 days before PCS
  const PREP_DAYS = 180;
  const startDate = new Date(pcsDate.getTime() - PREP_DAYS * DAY_MS);
  const totalDays = PREP_DAYS;
  const elapsed = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / DAY_MS));
  const progress = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));

  // Color based on days remaining
  let barColor = 'bg-green-500';
  let textColor = 'text-green-700';
  let bgColor = 'bg-green-50';
  if (daysRemaining <= 30) {
    barColor = 'bg-red-500';
    textColor = 'text-red-700';
    bgColor = 'bg-red-50';
  } else if (daysRemaining <= 90) {
    barColor = 'bg-amber-500';
    textColor = 'text-amber-700';
    bgColor = 'bg-amber-50';
  }

  // Milestone markers at 90, 60, 30 days before PCS
  const milestones = [90, 60, 30];

  // Count entries that will be stale by PCS date
  const intervalDays = VERIFICATION_INTERVAL_DAYS;
  const staleByPCS = entries.filter(e => {
    if (!e.verifiedAt) return true;
    const verifiedDate = new Date(e.verifiedAt);
    const daysSinceVerified = (pcsDate.getTime() - verifiedDate.getTime()) / DAY_MS;
    return daysSinceVerified > intervalDays;
  }).length;

  return html`
    <${Card} className="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-slate-700">PCS Timeline</h3>
        <div class=${`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${bgColor} ${textColor}`}>
          ${IconClock({ size: 14 })}
          ${daysRemaining > 0
            ? daysRemaining + ' days remaining'
            : daysRemaining === 0
              ? 'Turnover day'
              : Math.abs(daysRemaining) + ' days past'
          }
        </div>
      </div>

      <!-- Progress bar with milestones -->
      <div class="relative mb-2">
        <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            class=${barColor + ' h-3 rounded-full transition-all duration-700 ease-out'}
            style=${{ width: Math.min(100, progress) + '%' }}
          />
        </div>

        <!-- Milestone markers -->
        ${milestones.map(m => {
          const mPos = Math.max(0, Math.min(100, ((PREP_DAYS - m) / PREP_DAYS) * 100));
          return html`
            <div
              key=${m}
              class="absolute top-0 h-3 w-px bg-slate-400"
              style=${{ left: mPos + '%' }}
              title=${m + ' days before PCS'}
            />
          `;
        })}
      </div>

      <!-- Milestone labels -->
      <div class="relative h-5 text-[10px] text-slate-400 mb-3">
        ${milestones.map(m => {
          const mPos = Math.max(0, Math.min(100, ((PREP_DAYS - m) / PREP_DAYS) * 100));
          return html`
            <span
              key=${m}
              class="absolute -translate-x-1/2"
              style=${{ left: mPos + '%' }}
            >
              ${m}d
            </span>
          `;
        })}
        <span class="absolute right-0">PCS</span>
      </div>

      <div class="flex items-center justify-between text-xs text-slate-500">
        <span>Turnover: ${formatDate(turnoverDate)}</span>
        ${staleByPCS > 0 && html`
          <span class="flex items-center gap-1 text-amber-600 font-medium">
            ${IconWarning({ size: 12 })}
            ${staleByPCS} ${staleByPCS === 1 ? 'entry' : 'entries'} will be stale by PCS
          </span>
        `}
      </div>
    <//>
  `;
}

// --- CategoryCompletion -------------------------------------------------------

function CategoryCompletion({ entries }) {
  // Count entries per category
  const counts = useMemo(() => {
    const map = {};
    for (const cat of CATEGORIES) {
      map[cat.id] = 0;
    }
    for (const entry of entries) {
      if (map[entry.category] !== undefined) {
        map[entry.category]++;
      }
    }
    return map;
  }, [entries]);

  const totalEntries = entries.length;
  const maxCount = Math.max(1, ...Object.values(counts));

  return html`
    <div>
      <h3 class="text-sm font-semibold text-slate-700 mb-3">Category Coverage</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${CATEGORIES.map(cat => {
          const count = counts[cat.id] || 0;
          const pct = totalEntries > 0 ? Math.round((count / maxCount) * 100) : 0;
          const colors = getColor(cat.color);
          const IconComponent = ICON_MAP[cat.icon] || ICON_MAP.folder;

          return html`
            <${Card}
              key=${cat.id}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick=${() => navigate('capture')}
            >
              <div class="flex items-center gap-3 mb-2.5">
                <div class=${colors.bg + ' ' + colors.text + ' w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0'}>
                  ${IconComponent({ size: 18 })}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-slate-500 truncate">${cat.label}</p>
                  <p class="text-lg font-bold text-slate-800">${count}</p>
                </div>
              </div>
              <${ProgressBar} value=${pct} color=${colors.bar} height="h-1.5" />
            <//>
          `;
        })}
      </div>
    </div>
  `;
}

// --- VerificationSummary ------------------------------------------------------

function VerificationSummary({ entries, settings }) {
  const intervalDays = settings.verifyIntervalDays || VERIFICATION_INTERVAL_DAYS;

  const stats = useMemo(() => {
    let current = 0, expiring = 0, stale = 0, unverified = 0;
    for (const entry of entries) {
      const status = getVerificationStatus(entry, intervalDays);
      if (status === 'current') current++;
      else if (status === 'expiring') expiring++;
      else if (status === 'stale') stale++;
      else unverified++;
    }
    return { current, expiring, stale, unverified };
  }, [entries, intervalDays]);

  const total = entries.length;
  if (total === 0) {
    return html`
      <${Card} className="p-6">
        <h3 class="text-sm font-semibold text-slate-700 mb-2">Verification Status</h3>
        <p class="text-sm text-slate-400">No entries to verify yet.</p>
      <//>
    `;
  }

  const segments = [
    { label: 'Current',    count: stats.current,    color: 'bg-green-500',  textColor: 'text-green-700'  },
    { label: 'Expiring',   count: stats.expiring,   color: 'bg-amber-400',  textColor: 'text-amber-700'  },
    { label: 'Stale',      count: stats.stale,      color: 'bg-red-500',    textColor: 'text-red-700'    },
    { label: 'Unverified', count: stats.unverified,  color: 'bg-slate-300',  textColor: 'text-slate-600'  },
  ];

  return html`
    <${Card} className="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-slate-700">Verification Status</h3>
        <button
          onClick=${() => navigate('verify')}
          class="text-xs text-navy-600 hover:text-navy-800 font-medium transition-colors"
        >
          View all
        </button>
      </div>

      <!-- Segmented bar -->
      <div class="flex rounded-full overflow-hidden h-4 mb-4 bg-slate-100">
        ${segments.map(seg => {
          if (seg.count === 0) return null;
          const pct = (seg.count / total) * 100;
          return html`
            <div
              key=${seg.label}
              class=${seg.color + ' h-4 transition-all duration-500'}
              style=${{ width: pct + '%' }}
              title=${seg.label + ': ' + seg.count}
            />
          `;
        })}
      </div>

      <!-- Legend -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        ${segments.map(seg => html`
          <div key=${seg.label} class="flex items-center gap-2">
            <div class=${seg.color + ' w-2.5 h-2.5 rounded-full flex-shrink-0'} />
            <div>
              <span class=${'text-sm font-bold ' + seg.textColor}>${seg.count}</span>
              <span class="text-xs text-slate-500 ml-1">${seg.label}</span>
            </div>
          </div>
        `)}
      </div>
    <//>
  `;
}

// --- QuickStats ---------------------------------------------------------------

function QuickStats({ entries, narratives, startHereIds, settings }) {
  const totalEntries = entries.length;

  // Narratives: there are 10 standard narrative topics
  const TOTAL_NARRATIVE_SLOTS = 10;
  const narrativeCount = narratives.length;

  const startHereCount = startHereIds.length;

  // Last export date from settings
  const lastExport = settings.lastExportDate || null;

  const stats = [
    {
      label: 'Total Entries',
      value: totalEntries,
      icon: ICON_MAP.folder,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Narratives',
      value: narrativeCount + ' of ' + TOTAL_NARRATIVE_SLOTS,
      icon: ICON_MAP.chat,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Start Here Items',
      value: startHereCount,
      icon: ICON_MAP.star,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Last Export',
      value: lastExport ? formatDate(lastExport) : 'Never',
      icon: ICON_MAP.download,
      color: 'text-slate-600 bg-slate-100',
    },
  ];

  return html`
    <div>
      <h3 class="text-sm font-semibold text-slate-700 mb-3">Quick Stats</h3>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${stats.map((stat, i) => {
          const IconComp = stat.icon;
          return html`
            <${Card} key=${i} className="p-4">
              <div class="flex items-center gap-3">
                <div class=${stat.color + ' w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0'}>
                  ${IconComp({ size: 18 })}
                </div>
                <div class="min-w-0">
                  <p class="text-xs text-slate-500">${stat.label}</p>
                  <p class="text-lg font-bold text-slate-800 truncate">${stat.value}</p>
                </div>
              </div>
            <//>
          `;
        })}
      </div>
    </div>
  `;
}

// --- KnowledgeCompleteness (AI-powered) ---------------------------------------

function KnowledgeCompleteness({ entries, narratives, billetTitle }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAssess = useCallback(async () => {
    setLoading(true);
    try {
      const data = await AIService.assessCompleteness(entries, narratives, billetTitle);
      setResult(data);
    } catch (err) {
      showToast('Completeness assessment failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [entries, narratives, billetTitle]);

  if (!AIService.isAvailable()) return null;

  const gradeColors = {
    A: 'bg-green-100 text-green-800 border-green-300',
    B: 'bg-blue-100 text-blue-800 border-blue-300',
    C: 'bg-amber-100 text-amber-800 border-amber-300',
    D: 'bg-orange-100 text-orange-800 border-orange-300',
    F: 'bg-red-100 text-red-800 border-red-300',
  };

  const gradeColor = result ? (gradeColors[result.grade] || gradeColors.C) : '';

  return html`
    <${Card} className="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          Knowledge Completeness
        </h3>
        ${!result && html`
          <${Button}
            variant="secondary"
            size="sm"
            onClick=${handleAssess}
            disabled=${loading}
          >
            ${loading ? html`
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ` : ''}
            Assess Completeness
          <//>
        `}
        ${result && html`
          <button
            onClick=${() => setResult(null)}
            class="text-xs text-slate-500 hover:text-slate-700 font-medium"
          >
            Refresh
          </button>
        `}
      </div>

      ${!result && !loading && html`
        <p class="text-sm text-slate-400">Click "Assess Completeness" for an AI-powered evaluation of your knowledge base readiness.</p>
      `}

      ${loading && html`
        <div class="flex items-center justify-center py-6 text-slate-400">
          <svg class="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span class="text-sm">Analyzing knowledge base...</span>
        </div>
      `}

      ${result && html`
        <div class="space-y-4">
          <!-- Grade + Score -->
          <div class="flex items-center gap-4">
            <div class=${'w-16 h-16 rounded-full border-2 flex items-center justify-center text-2xl font-bold ' + gradeColor}>
              ${result.grade}
            </div>
            <div>
              <p class="text-2xl font-bold text-slate-800">${result.score}<span class="text-sm font-normal text-slate-500"> / 100</span></p>
              <p class="text-xs text-slate-500">Overall readiness score</p>
            </div>
          </div>

          <!-- Strengths -->
          ${result.strengths && result.strengths.length > 0 && html`
            <div>
              <h4 class="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5">Strengths</h4>
              <ul class="space-y-1">
                ${result.strengths.map((s, i) => html`
                  <li key=${i} class="flex items-start gap-2 text-sm text-slate-700">
                    <span class="text-green-500 flex-shrink-0 mt-0.5">${IconCheck({ size: 14 })}</span>
                    ${s}
                  </li>
                `)}
              </ul>
            </div>
          `}

          <!-- Gaps -->
          ${result.gaps && result.gaps.length > 0 && html`
            <div>
              <h4 class="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1.5">Gaps</h4>
              <ul class="space-y-1">
                ${result.gaps.map((g, i) => html`
                  <li key=${i} class="flex items-start gap-2 text-sm text-slate-700">
                    <span class="text-red-500 flex-shrink-0 mt-0.5">${IconWarning({ size: 14 })}</span>
                    ${g}
                  </li>
                `)}
              </ul>
            </div>
          `}

          <!-- Recommendations -->
          ${result.recommendations && result.recommendations.length > 0 && html`
            <div>
              <h4 class="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">Recommendations</h4>
              <ul class="space-y-1">
                ${result.recommendations.map((r, i) => html`
                  <li key=${i} class="flex items-start gap-2 text-sm text-slate-700">
                    <span class="text-blue-500 flex-shrink-0 mt-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                    ${r}
                  </li>
                `)}
              </ul>
            </div>
          `}

          <p class="text-xs text-slate-400 italic pt-2 border-t border-slate-100">AI assessment -- advisory only</p>
        </div>
      `}
    <//>
  `;
}

// --- QuickActions -------------------------------------------------------------

function QuickActions() {
  return html`
    <div>
      <h3 class="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h3>
      <div class="flex flex-wrap gap-3">
        <${Button} onClick=${() => navigate('capture')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Entry
        <//>
        <${Button} variant="secondary" onClick=${() => navigate('verify')}>
          ${IconCheck({ size: 16 })}
          Run Verification
        <//>
        <${Button} variant="secondary" onClick=${() => navigate('export')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export Knowledge Base
        <//>
      </div>
    </div>
  `;
}

// --- TemplateCards (shown when KB is empty) ------------------------------------

function TemplateCards() {
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    fetch('./data/templates/index.json')
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(data => {
        const index = data && Array.isArray(data.templates) ? data.templates : (Array.isArray(data) ? data : []);
        setTemplates(index);
      })
      .catch(() => {});
  }, []);

  if (templates.length === 0) return null;

  return html`
    <div>
      <h3 class="text-sm font-semibold text-slate-700 mb-3">Start from a template:</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        ${templates.map(tpl => html`
          <div key=${tpl.id} class="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <p class="text-sm font-medium text-navy-900">${tpl.name}</p>
              <p class="text-xs text-slate-500 mt-1">${tpl.entryCount || tpl.entries?.length || '?'} entries</p>
            </div>
            <button
              onClick=${() => navigate('export')}
              class="mt-3 text-xs font-medium text-navy-600 hover:text-navy-800 transition-colors text-left"
            >Load</button>
          </div>
        `)}
      </div>
    </div>
  `;
}

// --- Dashboard (default export) -----------------------------------------------

export default function Dashboard() {
  const { billet, entries, narratives, startHereIds, settings } = useContext(AppContext);

  return html`
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      <!-- Page header -->
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p class="text-sm text-slate-500 mt-0.5">Turnover readiness at a glance</p>
      </div>

      <!-- Billet Info -->
      <${BilletInfoCard} billet=${billet} />

      <!-- PCS Timeline -->
      <${PCSTimeline} billet=${billet} entries=${entries} />

      <!-- Get Started (when KB is mostly empty) -->
      ${entries.length < 3 && html`
        <div class="bg-gradient-to-r from-navy-50 to-blue-50 border border-navy-200 rounded-xl p-6 space-y-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-navy-600">
                <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-base font-semibold text-navy-900">Get Started</h3>
              <p class="text-sm text-navy-600">Your knowledge base is ${entries.length === 0 ? 'empty' : 'just getting started'}. Build your turnover package:</p>
            </div>
          </div>
          <div class="flex flex-wrap gap-3">
            <button
              onClick=${() => navigate('guided')}
              class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-navy-700 hover:bg-navy-800 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" />
                <path d="M17.8 11.8 20 14" /><path d="M15 7a3 3 0 0 0-3 3" />
                <path d="M6.2 6.2 8 8" />
                <path d="M2 22l4-11 5 5Z" /><path d="M7 16.5l-1.5 1.5" />
              </svg>
              Guided Setup
            </button>
            <button
              onClick=${() => navigate('export')}
              class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-navy-700 bg-white hover:bg-navy-50 border border-navy-200 rounded-lg transition-colors"
            >
              Load Template
            </button>
            <button
              onClick=${() => navigate('capture')}
              class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-navy-700 bg-white hover:bg-navy-50 border border-navy-200 rounded-lg transition-colors"
            >
              Add Entry
            </button>
            ${WebLLMService.isAvailable() && html`
              <button
                onClick=${() => {
                  window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { query: 'Help me get started. Draft 5 starter entries for a ' + (billet?.title || 'military') + ' billet covering the most important processes, stakeholders, and calendar events.' } }));
                }}
                class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>
                </svg>
                Generate with AI
              </button>
            `}
          </div>
        </div>
      `}

      <!-- Template Cards (empty KB) -->
      ${entries.length === 0 && html`<${TemplateCards} />`}

      <!-- Quick Stats -->
      <${QuickStats}
        entries=${entries}
        narratives=${narratives}
        startHereIds=${startHereIds}
        settings=${settings}
      />

      <!-- Knowledge Completeness (AI) -->
      <${KnowledgeCompleteness}
        entries=${entries}
        narratives=${narratives}
        billetTitle=${billet.title}
      />

      <!-- Category Completion -->
      <${CategoryCompletion} entries=${entries} />

      <!-- Verification Summary -->
      <${VerificationSummary} entries=${entries} settings=${settings} />

      <!-- Quick Actions -->
      <${QuickActions} />
    </div>
  `;
}
