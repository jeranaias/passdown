import { html } from '../core/config.js';

// ─── SVG Icon Components ────────────────────────────────────────────────────
// Heroicons-style outline icons. Each accepts { size, className } props.

function icon(paths, { size = 20, className = '' } = {}) {
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      class=${className}>
      ${paths}
    </svg>
  `;
}

export function IconSearch({ size = 20, className = '' } = {}) {
  return icon(html`
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  `, { size, className });
}

export function IconPlus({ size = 20, className = '' } = {}) {
  return icon(html`
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  `, { size, className });
}

export function IconEdit({ size = 20, className = '' } = {}) {
  return icon(html`
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  `, { size, className });
}

export function IconTrash({ size = 20, className = '' } = {}) {
  return icon(html`
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  `, { size, className });
}

export function IconCheck({ size = 20, className = '' } = {}) {
  return icon(html`
    <polyline points="20 6 9 17 4 12" />
  `, { size, className });
}

export function IconWarning({ size = 20, className = '' } = {}) {
  return icon(html`
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  `, { size, className });
}

export function IconClock({ size = 20, className = '' } = {}) {
  return icon(html`
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  `, { size, className });
}

export function IconUsers({ size = 20, className = '' } = {}) {
  return icon(html`
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  `, { size, className });
}

export function IconFolder({ size = 20, className = '' } = {}) {
  return icon(html`
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  `, { size, className });
}

export function IconCalendar({ size = 20, className = '' } = {}) {
  return icon(html`
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  `, { size, className });
}

export function IconDownload({ size = 20, className = '' } = {}) {
  return icon(html`
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  `, { size, className });
}

export function IconUpload({ size = 20, className = '' } = {}) {
  return icon(html`
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  `, { size, className });
}

export function IconPrinter({ size = 20, className = '' } = {}) {
  return icon(html`
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  `, { size, className });
}

export function IconChat({ size = 20, className = '' } = {}) {
  return icon(html`
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  `, { size, className });
}

export function IconMenu({ size = 20, className = '' } = {}) {
  return icon(html`
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  `, { size, className });
}

export function IconX({ size = 20, className = '' } = {}) {
  return icon(html`
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  `, { size, className });
}

export function IconChevronDown({ size = 20, className = '' } = {}) {
  return icon(html`
    <polyline points="6 9 12 15 18 9" />
  `, { size, className });
}

export function IconChevronRight({ size = 20, className = '' } = {}) {
  return icon(html`
    <polyline points="9 18 15 12 9 6" />
  `, { size, className });
}

export function IconFlag({ size = 20, className = '' } = {}) {
  return icon(html`
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  `, { size, className });
}

export function IconLightbulb({ size = 20, className = '' } = {}) {
  return icon(html`
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
  `, { size, className });
}

export function IconScale({ size = 20, className = '' } = {}) {
  return icon(html`
    <line x1="12" y1="3" x2="12" y2="21" />
    <polyline points="1 12 5 8 9 12" />
    <path d="M1 12a4 4 0 0 0 8 0" />
    <polyline points="15 12 19 8 23 12" />
    <path d="M15 12a4 4 0 0 0 8 0" />
    <line x1="5" y1="8" x2="19" y2="8" />
  `, { size, className });
}

export function IconArrowUp({ size = 20, className = '' } = {}) {
  return icon(html`
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  `, { size, className });
}

export function IconArrowDown({ size = 20, className = '' } = {}) {
  return icon(html`
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  `, { size, className });
}

export function IconEye({ size = 20, className = '' } = {}) {
  return icon(html`
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  `, { size, className });
}

export function IconStar({ size = 20, className = '' } = {}) {
  return icon(html`
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  `, { size, className });
}

export function IconRefresh({ size = 20, className = '' } = {}) {
  return icon(html`
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  `, { size, className });
}

export function IconExternalLink({ size = 20, className = '' } = {}) {
  return icon(html`
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  `, { size, className });
}

export function IconCopy({ size = 20, className = '' } = {}) {
  return icon(html`
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  `, { size, className });
}

// ─── Icon Map ───────────────────────────────────────────────────────────────
// Allows looking up icons by string name (used by category config)

export const ICON_MAP = {
  search: IconSearch,
  plus: IconPlus,
  edit: IconEdit,
  trash: IconTrash,
  check: IconCheck,
  warning: IconWarning,
  clock: IconClock,
  users: IconUsers,
  folder: IconFolder,
  calendar: IconCalendar,
  download: IconDownload,
  upload: IconUpload,
  printer: IconPrinter,
  chat: IconChat,
  menu: IconMenu,
  x: IconX,
  chevronDown: IconChevronDown,
  chevronRight: IconChevronRight,
  flag: IconFlag,
  lightbulb: IconLightbulb,
  scale: IconScale,
  arrowUp: IconArrowUp,
  arrowDown: IconArrowDown,
  eye: IconEye,
  star: IconStar,
  refresh: IconRefresh,
  externalLink: IconExternalLink,
  copy: IconCopy,
};
