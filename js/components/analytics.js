// ─── Analytics / Readiness Report ────────────────────────────────────────────
// Local-only turnover readiness scoring, visual dashboard, and gap analysis.

import { html } from '../core/config.js';
import CONFIG, { CATEGORIES, VERIFICATION_INTERVAL_DAYS } from '../core/config.js';
import { useApp } from './app.js';
import { Button, Badge, Card, ProgressBar, showToast } from '../shared/ui.js';
import { IconCheck, IconWarning, IconFlag, IconDownload } from '../shared/icons.js';

const { useState, useCallback, useMemo } = React;

// ─── Scoring Constants ───────────────────────────────────────────────────────

const NARRATIVE_COUNT = 12;
const MAX_SCORE = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCategoryLabel(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.label : categoryId;
}

function getCategoryColor(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.color : 'gray';
}

function daysBetween(dateA, dateB) {
  return Math.floor(Math.abs(new Date(dateA) - new Date(dateB)) / (1000 * 60 * 60 * 24));
}

function daysFromNow(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.floor((target - now) / (1000 * 60 * 60 * 24));
}

function letterGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function gradeColor(grade) {
  switch (grade) {
    case 'A': return { text: 'text-green-700', bg: 'bg-green-100', ring: 'ring-green-500', bar: 'bg-green-500' };
    case 'B': return { text: 'text-blue-700', bg: 'bg-blue-100', ring: 'ring-blue-500', bar: 'bg-blue-500' };
    case 'C': return { text: 'text-amber-700', bg: 'bg-amber-100', ring: 'ring-amber-500', bar: 'bg-amber-500' };
    case 'D': return { text: 'text-orange-700', bg: 'bg-orange-100', ring: 'ring-orange-500', bar: 'bg-orange-500' };
    default:  return { text: 'text-red-700', bg: 'bg-red-100', ring: 'ring-red-500', bar: 'bg-red-500' };
  }
}

// ─── Score Computation ───────────────────────────────────────────────────────

function computeHealthScore(entries, narratives, startHereIds, billet) {
  const breakdown = {};

  // 1. Category coverage: each of 6 categories populated = +10 pts (max 60)
  const populatedCategories = new Set(entries.map(e => e.category));
  const catCount = CATEGORIES.filter(c => populatedCategories.has(c.id)).length;
  breakdown.categoryCoverage = {
    score: catCount * 10,
    max: CATEGORIES.length * 10,
    detail: `${catCount} of ${CATEGORIES.length} categories populated`,
  };

  // 2. Verification: % of entries current = scaled to 15 pts
  const now = new Date();
  let currentCount = 0;
  let expiringCount = 0;
  let staleCount = 0;
  let unverifiedCount = 0;

  for (const entry of entries) {
    if (!entry.verifiedAt) {
      unverifiedCount++;
      continue;
    }
    const days = daysBetween(entry.verifiedAt, now);
    if (days <= VERIFICATION_INTERVAL_DAYS) {
      currentCount++;
    } else if (days <= VERIFICATION_INTERVAL_DAYS * 1.5) {
      expiringCount++;
    } else {
      staleCount++;
    }
  }

  const verifyPct = entries.length > 0 ? currentCount / entries.length : 0;
  breakdown.verification = {
    score: Math.round(verifyPct * 15),
    max: 15,
    detail: `${currentCount} of ${entries.length} entries current`,
    counts: { current: currentCount, expiring: expiringCount, stale: staleCount, unverified: unverifiedCount },
  };

  // 3. Narratives: X of 12 completed = scaled to 15 pts
  const narrativeCount = narratives.filter(n => n.response && n.response.trim().length > 0).length;
  const narrativePct = Math.min(narrativeCount / NARRATIVE_COUNT, 1);
  breakdown.narratives = {
    score: Math.round(narrativePct * 15),
    max: 15,
    detail: `${narrativeCount} of ${NARRATIVE_COUNT} narratives completed`,
  };

  // 4. Start Here: has items = 5 pts
  const hasStartHere = startHereIds.length > 0;
  breakdown.startHere = {
    score: hasStartHere ? 5 : 0,
    max: 5,
    detail: hasStartHere ? `${startHereIds.length} start-here items` : 'No start-here items',
  };

  // 5. Billet configured = 5 pts
  const billetConfigured = !!(billet.title && billet.title.trim());
  breakdown.billetConfig = {
    score: billetConfigured ? 5 : 0,
    max: 5,
    detail: billetConfigured ? 'Billet configured' : 'Billet not configured',
  };

  const totalScore = Object.values(breakdown).reduce((sum, b) => sum + b.score, 0);
  const grade = letterGrade(totalScore);

  return { totalScore, grade, breakdown };
}

// ─── Gap Detection ───────────────────────────────────────────────────────────

function detectGaps(entries, narratives, startHereIds, billet, breakdown) {
  const gaps = [];

  // Empty categories
  const populatedCategories = new Set(entries.map(e => e.category));
  for (const cat of CATEGORIES) {
    if (!populatedCategories.has(cat.id)) {
      gaps.push({
        severity: 'high',
        area: getCategoryLabel(cat.id),
        message: `No entries in "${getCategoryLabel(cat.id)}" category`,
        action: `Add at least 3 ${getCategoryLabel(cat.id).toLowerCase()} entries`,
      });
    }
  }

  // Low entry count categories
  const catCounts = {};
  for (const e of entries) {
    catCounts[e.category] = (catCounts[e.category] || 0) + 1;
  }
  for (const cat of CATEGORIES) {
    const count = catCounts[cat.id] || 0;
    if (count > 0 && count < 3) {
      gaps.push({
        severity: 'medium',
        area: getCategoryLabel(cat.id),
        message: `Only ${count} entry${count === 1 ? '' : 'ies'} in "${getCategoryLabel(cat.id)}"`,
        action: `Expand to at least 3 entries for adequate coverage`,
      });
    }
  }

  // Narratives
  const completedNarratives = narratives.filter(n => n.response && n.response.trim().length > 0).length;
  if (completedNarratives === 0) {
    gaps.push({
      severity: 'high',
      area: 'Narratives',
      message: 'No narrative interviews completed',
      action: 'Complete the narrative interview to capture tacit knowledge',
    });
  } else if (completedNarratives < NARRATIVE_COUNT) {
    gaps.push({
      severity: 'medium',
      area: 'Narratives',
      message: `${completedNarratives} of ${NARRATIVE_COUNT} narrative prompts answered`,
      action: `Complete remaining ${NARRATIVE_COUNT - completedNarratives} narrative prompts`,
    });
  }

  // Start Here
  if (startHereIds.length === 0) {
    gaps.push({
      severity: 'high',
      area: 'Start Here',
      message: 'No start-here items designated',
      action: 'Mark your most critical entries as "Start Here" for Day 1 orientation',
    });
  }

  // Billet
  if (!billet.title || !billet.title.trim()) {
    gaps.push({
      severity: 'medium',
      area: 'Billet',
      message: 'Billet information not configured',
      action: 'Complete billet setup in Settings (title, unit, turnover date)',
    });
  }

  // Stakeholders
  const stakeholderCount = entries.filter(e => e.category === 'stakeholder').length;
  if (stakeholderCount === 0) {
    gaps.push({
      severity: 'high',
      area: 'Stakeholders',
      message: 'No stakeholder entries recorded',
      action: 'Add key contacts to the Stakeholder Map',
    });
  }

  // Stale entries
  const { counts } = breakdown.verification;
  if (counts.stale > 0) {
    gaps.push({
      severity: 'medium',
      area: 'Verification',
      message: `${counts.stale} stale entries need re-verification`,
      action: 'Review and verify outdated entries',
    });
  }

  if (counts.unverified > 0) {
    gaps.push({
      severity: 'low',
      area: 'Verification',
      message: `${counts.unverified} entries have never been verified`,
      action: 'Run a verification pass on unverified entries',
    });
  }

  // No turnover date
  if (!billet.turnoverDate) {
    gaps.push({
      severity: 'low',
      area: 'Timeline',
      message: 'No PCS/turnover date set',
      action: 'Set your turnover date in Settings to track readiness timeline',
    });
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return gaps;
}

// ─── Health Score Display ────────────────────────────────────────────────────

function HealthScoreCard({ score, grade }) {
  const colors = gradeColor(grade);

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6">
      <div class="flex items-center gap-6">
        <!-- Large score circle -->
        <div class=${'relative flex-shrink-0 w-28 h-28 rounded-full flex items-center justify-center ring-4 ' + colors.bg + ' ' + colors.ring}>
          <div class="text-center">
            <div class=${'text-3xl font-bold ' + colors.text}>${score}</div>
            <div class=${'text-sm font-semibold ' + colors.text}>${grade}</div>
          </div>
        </div>

        <div class="flex-1">
          <h2 class="text-lg font-semibold text-navy-900">Turnover Readiness</h2>
          <p class="text-sm text-slate-500 mt-1">
            ${score >= 90
              ? 'Excellent! Your passdown is comprehensive and ready for turnover.'
              : score >= 80
                ? 'Good shape. A few areas could use attention before turnover.'
                : score >= 70
                  ? 'Adequate coverage, but notable gaps remain.'
                  : score >= 60
                    ? 'Significant gaps exist. Prioritize filling critical areas.'
                    : 'Major work needed. Focus on the highest-priority gaps below.'}
          </p>
          <div class="mt-3">
            <${ProgressBar} value=${score} color=${colors.bar} height="h-2.5" />
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Score Breakdown ─────────────────────────────────────────────────────────

function ScoreBreakdown({ breakdown }) {
  const items = [
    { key: 'categoryCoverage', label: 'Category Coverage', icon: IconFlag },
    { key: 'verification', label: 'Verification', icon: IconCheck },
    { key: 'narratives', label: 'Narratives', icon: null },
    { key: 'startHere', label: 'Start Here', icon: null },
    { key: 'billetConfig', label: 'Billet Config', icon: null },
  ];

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
      <h3 class="text-sm font-semibold text-navy-900">Score Breakdown</h3>
      <div class="space-y-2.5">
        ${items.map(item => {
          const b = breakdown[item.key];
          if (!b) return null;
          const pct = b.max > 0 ? (b.score / b.max) * 100 : 0;
          return html`
            <div key=${item.key}>
              <div class="flex items-center justify-between text-xs text-slate-600 mb-1">
                <span class="font-medium">${item.label}</span>
                <span>${b.score} / ${b.max}</span>
              </div>
              <${ProgressBar} value=${pct} color=${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'} height="h-1.5" />
              <p class="text-[11px] text-slate-400 mt-0.5">${b.detail}</p>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

// ─── Category Distribution Chart ─────────────────────────────────────────────

function CategoryChart({ entries }) {
  const catCounts = useMemo(() => {
    const counts = {};
    for (const cat of CATEGORIES) counts[cat.id] = 0;
    for (const e of entries) {
      if (counts[e.category] !== undefined) counts[e.category]++;
    }
    return counts;
  }, [entries]);

  const maxCount = Math.max(1, ...Object.values(catCounts));

  const barColors = {
    blue: 'bg-blue-500', purple: 'bg-purple-500', green: 'bg-green-500',
    orange: 'bg-orange-500', yellow: 'bg-amber-500', red: 'bg-red-500',
  };

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
      <h3 class="text-sm font-semibold text-navy-900">Category Distribution</h3>
      <div class="space-y-2.5">
        ${CATEGORIES.map(cat => {
          const count = catCounts[cat.id];
          const pct = (count / maxCount) * 100;
          const barColor = barColors[cat.color] || 'bg-slate-400';
          return html`
            <div key=${cat.id}>
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="text-slate-600 font-medium truncate">${cat.label}</span>
                <span class=${'font-semibold ' + (count === 0 ? 'text-red-500' : 'text-slate-700')}>${count}</span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  class=${barColor + ' h-2 rounded-full transition-all duration-500'}
                  style=${{ width: count > 0 ? Math.max(pct, 4) + '%' : '0%' }}
                />
              </div>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

// ─── Verification Donut ──────────────────────────────────────────────────────

function VerificationDonut({ counts, total }) {
  // Simple segmented bar instead of SVG donut for htm compatibility
  const segments = [
    { label: 'Current', count: counts.current, color: 'bg-green-500', textColor: 'text-green-700' },
    { label: 'Expiring', count: counts.expiring, color: 'bg-amber-400', textColor: 'text-amber-700' },
    { label: 'Stale', count: counts.stale, color: 'bg-red-400', textColor: 'text-red-700' },
    { label: 'Unverified', count: counts.unverified, color: 'bg-slate-300', textColor: 'text-slate-600' },
  ];

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
      <h3 class="text-sm font-semibold text-navy-900">Verification Status</h3>

      ${total === 0 && html`
        <p class="text-sm text-slate-400 py-4 text-center">No entries to verify.</p>
      `}

      ${total > 0 && html`
        <!-- Segmented bar -->
        <div class="flex rounded-full overflow-hidden h-4">
          ${segments.filter(s => s.count > 0).map(seg => html`
            <div
              key=${seg.label}
              class=${seg.color + ' transition-all duration-500'}
              style=${{ width: (seg.count / total * 100) + '%' }}
              title=${seg.label + ': ' + seg.count}
            />
          `)}
        </div>

        <!-- Legend -->
        <div class="grid grid-cols-2 gap-2 pt-1">
          ${segments.map(seg => html`
            <div key=${seg.label} class="flex items-center gap-2">
              <div class=${seg.color + ' w-3 h-3 rounded-full flex-shrink-0'} />
              <span class="text-xs text-slate-600">
                <span class=${'font-semibold ' + seg.textColor}>${seg.count}</span> ${seg.label}
              </span>
            </div>
          `)}
        </div>
      `}
    </div>
  `;
}

// ─── Narrative Progress ──────────────────────────────────────────────────────

function NarrativeProgress({ narratives }) {
  const completed = narratives.filter(n => n.response && n.response.trim().length > 0).length;
  const pct = (completed / NARRATIVE_COUNT) * 100;

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
      <h3 class="text-sm font-semibold text-navy-900">Narrative Completion</h3>
      <div class="flex items-center gap-4">
        <div class="flex-1">
          <${ProgressBar}
            value=${pct}
            color=${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'}
            height="h-3"
          />
        </div>
        <span class="text-sm font-semibold text-slate-700 flex-shrink-0">
          ${completed} / ${NARRATIVE_COUNT}
        </span>
      </div>
      <p class="text-xs text-slate-400">
        ${completed === NARRATIVE_COUNT
          ? 'All narrative prompts completed. Tacit knowledge captured.'
          : completed === 0
            ? 'No narratives started. Begin the interview to capture tacit knowledge.'
            : `${NARRATIVE_COUNT - completed} remaining prompts. Continue the narrative interview.`}
      </p>
    </div>
  `;
}

// ─── Timeline Card ───────────────────────────────────────────────────────────

function TimelineCard({ billet }) {
  const turnoverDays = daysFromNow(billet.turnoverDate);
  const hasDate = billet.turnoverDate && turnoverDays !== null;

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
      <h3 class="text-sm font-semibold text-navy-900">Turnover Timeline</h3>
      ${!hasDate && html`
        <p class="text-sm text-slate-400">No turnover date set. Configure in Settings.</p>
      `}
      ${hasDate && html`
        <div class="flex items-center gap-4">
          <div class=${'text-center p-3 rounded-lg '
            + (turnoverDays <= 14
              ? 'bg-red-50 text-red-700'
              : turnoverDays <= 30
                ? 'bg-amber-50 text-amber-700'
                : turnoverDays <= 60
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-green-50 text-green-700')}>
            <div class="text-2xl font-bold">${Math.max(0, turnoverDays)}</div>
            <div class="text-xs font-medium">days</div>
          </div>
          <div class="flex-1">
            <p class="text-sm text-slate-700">
              ${turnoverDays > 0
                ? 'until PCS / turnover date'
                : turnoverDays === 0
                  ? 'Turnover is today!'
                  : 'past turnover date'}
            </p>
            <p class="text-xs text-slate-400 mt-0.5">
              ${new Date(billet.turnoverDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            ${billet.incomingName && html`
              <p class="text-xs text-slate-500 mt-1">Incoming: ${billet.incomingName}</p>
            `}
          </div>
        </div>
      `}
    </div>
  `;
}

// ─── Gaps & Recommendations ──────────────────────────────────────────────────

function GapsList({ gaps }) {
  const severityStyles = {
    high:   { badge: 'red',    bg: 'bg-red-50 border-red-200',    icon: IconWarning, iconColor: 'text-red-500' },
    medium: { badge: 'yellow', bg: 'bg-amber-50 border-amber-200', icon: IconFlag,    iconColor: 'text-amber-500' },
    low:    { badge: 'gray',   bg: 'bg-slate-50 border-slate-200', icon: IconCheck,   iconColor: 'text-slate-400' },
  };

  if (gaps.length === 0) {
    return html`
      <div class="bg-white rounded-lg border border-slate-200 p-6">
        <h3 class="text-sm font-semibold text-navy-900 mb-3">Gaps & Recommendations</h3>
        <div class="flex items-center gap-3 py-4 text-green-600">
          ${IconCheck({ size: 20 })}
          <span class="text-sm font-medium">No gaps detected. Your passdown is in great shape!</span>
        </div>
      </div>
    `;
  }

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-navy-900">Gaps & Recommendations</h3>
        <span class="text-xs text-slate-400">${gaps.length} item${gaps.length === 1 ? '' : 's'}</span>
      </div>
      <div class="space-y-2">
        ${gaps.map((gap, i) => {
          const style = severityStyles[gap.severity] || severityStyles.low;
          return html`
            <div key=${i} class=${'border rounded-lg p-3 ' + style.bg}>
              <div class="flex items-start gap-3">
                <span class=${'flex-shrink-0 mt-0.5 ' + style.iconColor}>
                  ${style.icon({ size: 16 })}
                </span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-medium text-slate-800">${gap.message}</span>
                    <${Badge} color=${style.badge}>${gap.severity}<//>
                    <span class="text-xs text-slate-400">${gap.area}</span>
                  </div>
                  <p class="text-xs text-slate-500 mt-1">${gap.action}</p>
                </div>
              </div>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

// ─── Export Readiness Report ─────────────────────────────────────────────────

function generateReportHTML(score, grade, breakdown, gaps, entries, narratives, billet) {
  const colors = gradeColor(grade);
  const catCounts = {};
  for (const cat of CATEGORIES) catCounts[cat.id] = 0;
  for (const e of entries) {
    if (catCounts[e.category] !== undefined) catCounts[e.category]++;
  }
  const completedNarratives = narratives.filter(n => n.response && n.response.trim().length > 0).length;
  const turnoverDays = daysFromNow(billet.turnoverDate);
  const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Passdown Readiness Report - ${billet.title || 'Untitled'}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1e293b; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 32px; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
  .score-box { display: flex; align-items: center; gap: 20px; padding: 20px; border: 2px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; }
  .score-circle { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column; font-weight: bold; }
  .score-circle .number { font-size: 28px; }
  .score-circle .grade { font-size: 14px; }
  .bar-outer { background: #f1f5f9; border-radius: 6px; height: 8px; overflow: hidden; margin-top: 4px; }
  .bar-inner { height: 8px; border-radius: 6px; }
  .breakdown-item { margin-bottom: 10px; }
  .breakdown-label { font-size: 13px; display: flex; justify-content: space-between; color: #475569; }
  .gap { padding: 10px 12px; border-radius: 8px; margin-bottom: 8px; font-size: 13px; }
  .gap-high { background: #fef2f2; border: 1px solid #fecaca; }
  .gap-medium { background: #fffbeb; border: 1px solid #fde68a; }
  .gap-low { background: #f8fafc; border: 1px solid #e2e8f0; }
  .gap-title { font-weight: 600; }
  .gap-action { color: #64748b; margin-top: 4px; }
  .cat-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 13px; }
  .cat-label { width: 160px; color: #475569; }
  .cat-count { width: 30px; text-align: right; font-weight: 600; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<h1>Passdown Readiness Report</h1>
<div class="meta">
  ${billet.title ? `<strong>${billet.title}</strong>` : 'Billet not configured'}
  ${billet.unit ? ` &mdash; ${billet.unit}` : ''}
  <br>Generated: ${now}
  ${billet.turnoverDate && turnoverDays !== null ? `<br>Turnover: ${new Date(billet.turnoverDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} (${Math.max(0, turnoverDays)} days)` : ''}
</div>

<div class="score-box">
  <div class="score-circle" style="background: ${grade === 'A' ? '#dcfce7' : grade === 'B' ? '#dbeafe' : grade === 'C' ? '#fef3c7' : grade === 'D' ? '#ffedd5' : '#fee2e2'}; color: ${grade === 'A' ? '#15803d' : grade === 'B' ? '#1d4ed8' : grade === 'C' ? '#b45309' : grade === 'D' ? '#c2410c' : '#dc2626'}">
    <div class="number">${score}</div>
    <div class="grade">${grade}</div>
  </div>
  <div>
    <div style="font-weight: 600; font-size: 18px;">Overall Score: ${score}/100</div>
    <div style="color: #64748b; font-size: 13px;">
      ${score >= 90 ? 'Excellent readiness for turnover.' : score >= 70 ? 'Good progress, some gaps remain.' : 'Significant gaps to address.'}
    </div>
  </div>
</div>

<h2>Score Breakdown</h2>
${[
    { key: 'categoryCoverage', label: 'Category Coverage' },
    { key: 'verification', label: 'Verification' },
    { key: 'narratives', label: 'Narratives' },
    { key: 'startHere', label: 'Start Here' },
    { key: 'billetConfig', label: 'Billet Config' },
  ].map(item => {
    const b = breakdown[item.key];
    const pct = b.max > 0 ? (b.score / b.max) * 100 : 0;
    return `<div class="breakdown-item"><div class="breakdown-label"><span>${item.label}</span><span>${b.score}/${b.max}</span></div><div class="bar-outer"><div class="bar-inner" style="width:${pct}%;background:${pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'}"></div></div><div style="font-size:11px;color:#94a3b8">${b.detail}</div></div>`;
  }).join('')}

<h2>Category Distribution</h2>
${CATEGORIES.map(cat => `<div class="cat-row"><span class="cat-label">${cat.label}</span><span class="cat-count">${catCounts[cat.id]}</span></div>`).join('')}

<h2>Narratives</h2>
<p style="font-size:13px;color:#475569">${completedNarratives} of ${NARRATIVE_COUNT} prompts completed (${Math.round(completedNarratives / NARRATIVE_COUNT * 100)}%)</p>

<h2>Gaps & Recommendations (${gaps.length})</h2>
${gaps.length === 0 ? '<p style="color:#16a34a;font-size:13px">No gaps detected.</p>' : gaps.map(gap => `<div class="gap gap-${gap.severity}"><div class="gap-title">${gap.message} <span style="font-size:11px;color:#94a3b8">[${gap.severity}]</span></div><div class="gap-action">${gap.action}</div></div>`).join('')}

<div class="footer">
  Passdown v${CONFIG.VERSION} &mdash; All data stored locally. No telemetry.
</div>
</body>
</html>`;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Analytics() {
  const { entries, narratives, startHereIds, billet } = useApp();

  const { totalScore, grade, breakdown } = useMemo(
    () => computeHealthScore(entries, narratives, startHereIds, billet),
    [entries, narratives, startHereIds, billet]
  );

  const gaps = useMemo(
    () => detectGaps(entries, narratives, startHereIds, billet, breakdown),
    [entries, narratives, startHereIds, billet, breakdown]
  );

  const handleExportReport = useCallback(() => {
    const reportHTML = generateReportHTML(totalScore, grade, breakdown, gaps, entries, narratives, billet);
    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `passdown-readiness-report-${dateStr}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Readiness report exported', 'success');
  }, [totalScore, grade, breakdown, gaps, entries, narratives, billet]);

  return html`
    <div class="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Readiness Report
          </h1>
          <p class="text-sm text-slate-500 mt-1">Turnover readiness analysis -- all data computed locally.</p>
        </div>
        <${Button} onClick=${handleExportReport}>
          ${IconDownload({ size: 16 })} Export Report
        <//>
      </div>

      <!-- Health Score -->
      <${HealthScoreCard} score=${totalScore} grade=${grade} />

      <!-- Score Breakdown + Category Chart -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <${ScoreBreakdown} breakdown=${breakdown} />
        <${CategoryChart} entries=${entries} />
      </div>

      <!-- Verification + Narratives + Timeline -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <${VerificationDonut}
          counts=${breakdown.verification.counts}
          total=${entries.length}
        />
        <${NarrativeProgress} narratives=${narratives} />
        <${TimelineCard} billet=${billet} />
      </div>

      <!-- Gaps -->
      <${GapsList} gaps=${gaps} />
    </div>
  `;
}
