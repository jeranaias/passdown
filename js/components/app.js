import { html } from '../core/config.js';
import CONFIG, { CATEGORIES } from '../core/config.js';
import Store from '../core/store.js';
import { buildIndex } from '../core/search.js';
import AIService from '../core/ai-service.js';
import WebLLMService from '../core/webllm-service.js';
import { ToastContainer, Toast } from '../shared/ui.js';
import {
  IconSearch, IconFolder, IconUsers, IconCalendar, IconChat,
  IconCheck, IconStar, IconDownload, IconMenu, IconX,
  IconChevronDown, IconChevronRight, ICON_MAP,
} from '../shared/icons.js';
import AIChatSidebar from './ai-chat.js';

const {
  useState, useEffect, useRef, useCallback, useMemo,
  createContext, useContext,
} = React;

// --- AppContext ---------------------------------------------------------------

export const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppContext.Provider');
  return ctx;
}

// --- Hash helpers -------------------------------------------------------------

function getHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  // Strip query string for route matching, but keep it in the hash for components to parse
  const h = raw.split('?')[0].toLowerCase();
  return h || 'dashboard';
}

function navigate(hash) {
  window.location.hash = '#' + hash;
}

// --- Inline SVG helpers (sidebar-only, avoids double-import name collisions) --

function HomeIcon(props) {
  const { size = 18, className = '' } = props || {};
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      class=${className}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  `;
}

function SettingsIcon(props) {
  const { size = 18, className = '' } = props || {};
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      class=${className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  `;
}

function BrowseIcon(props) {
  const { size = 16, className = '' } = props || {};
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      class=${className}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  `;
}

function CaptureIcon(props) {
  const { size = 16, className = '' } = props || {};
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      class=${className}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  `;
}

function FederationIcon(props) {
  const { size = 18, className = '' } = props || {};
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      class=${className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  `;
}

function BarChartIcon(props) {
  const { size = 18, className = '' } = props || {};
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      class=${className}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  `;
}

function ShieldLogo(props) {
  const { size = 20 } = props || {};
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      class="text-olive-300">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  `;
}

// --- NavItem ------------------------------------------------------------------

function NavItem({ icon, label, hash, active, onClick, indent = false }) {
  const cls = [
    'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
    indent ? 'pl-10' : '',
    active
      ? 'bg-navy-800 text-white font-medium'
      : 'text-navy-200 hover:bg-navy-800/50 hover:text-white',
  ].filter(Boolean).join(' ');

  return html`
    <button
      onClick=${() => { onClick ? onClick() : navigate(hash); }}
      class=${cls}
    >
      <span class="flex-shrink-0">${icon}</span>
      <span class="truncate">${label}</span>
    </button>
  `;
}

// --- NavGroup (expandable) ----------------------------------------------------

function NavGroup({ icon, label, children, activeHash }) {
  const childHashes = ['capture', 'browse', 'search'];
  const hasActiveChild = childHashes.some(h => activeHash === h);
  const [expanded, setExpanded] = useState(hasActiveChild);

  useEffect(() => {
    if (hasActiveChild && !expanded) setExpanded(true);
  }, [hasActiveChild]);

  const chevronCls = 'flex-shrink-0 transition-transform duration-200' +
    (expanded ? '' : ' -rotate-90');

  return html`
    <div>
      <button
        onClick=${() => setExpanded(e => !e)}
        class="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-navy-200 hover:bg-navy-800/50 hover:text-white"
      >
        <span class="flex-shrink-0">${icon}</span>
        <span class="flex-1 text-left truncate">${label}</span>
        <span class=${chevronCls}>
          ${IconChevronDown({ size: 14 })}
        </span>
      </button>
      ${expanded && html`
        <div class="mt-0.5 space-y-0.5">
          ${children}
        </div>
      `}
    </div>
  `;
}

// --- Sidebar ------------------------------------------------------------------

function Sidebar({ activeHash, mobile = false, onClose, showInstall = false }) {
  const handleNav = useCallback((hash) => {
    navigate(hash);
    if (mobile && onClose) onClose();
  }, [mobile, onClose]);

  const asideCls = 'flex flex-col h-full bg-navy-900 text-white ' +
    (mobile ? 'w-72' : 'w-64');

  return html`
    <aside class=${asideCls}>

      <!-- Header / Brand -->
      <div class="flex items-center gap-3 px-4 py-5 border-b border-navy-700/50">
        <div class="flex-shrink-0 w-9 h-9 rounded-lg bg-navy-700 flex items-center justify-center">
          ${ShieldLogo({ size: 20 })}
        </div>
        <div class="flex-1 min-w-0">
          <h1 class="text-lg font-bold tracking-tight text-white">Passdown</h1>
          <p class="text-[10px] text-navy-400 uppercase tracking-widest">Knowledge Transfer</p>
        </div>
        ${mobile && html`
          <button onClick=${onClose} class="text-navy-300 hover:text-white p-1">
            ${IconX({ size: 20 })}
          </button>
        `}
      </div>

      <!-- Navigation -->
      <nav role="navigation" class="flex-1 overflow-y-auto px-3 py-4 space-y-1">

        <${NavItem}
          icon=${HomeIcon()}
          label="Dashboard"
          hash="dashboard"
          active=${activeHash === 'dashboard'}
          onClick=${() => handleNav('dashboard')}
        />

        <${NavGroup}
          icon=${IconFolder({ size: 18 })}
          label="Knowledge Base"
          activeHash=${activeHash}
        >
          <${NavItem}
            icon=${CaptureIcon()}
            label="Capture"
            hash="capture"
            active=${activeHash === 'capture'}
            onClick=${() => handleNav('capture')}
            indent
          />
          <${NavItem}
            icon=${BrowseIcon()}
            label="Browse"
            hash="browse"
            active=${activeHash === 'browse'}
            onClick=${() => handleNav('browse')}
            indent
          />
        <//>

        <${NavItem}
          icon=${IconUsers({ size: 18 })}
          label="Stakeholders"
          hash="capture/stakeholders"
          active=${activeHash === 'capture/stakeholders'}
          onClick=${() => handleNav('capture/stakeholders')}
        />

        <${NavItem}
          icon=${IconCalendar({ size: 18 })}
          label="Calendar"
          hash="capture/calendar"
          active=${activeHash === 'capture/calendar'}
          onClick=${() => handleNav('capture/calendar')}
        />

        <${NavItem}
          icon=${IconChat({ size: 18 })}
          label="Narratives"
          hash="narrative"
          active=${activeHash === 'narrative'}
          onClick=${() => handleNav('narrative')}
        />

        <${NavItem}
          icon=${IconSearch({ size: 18 })}
          label="Search"
          hash="search"
          active=${activeHash === 'search'}
          onClick=${() => handleNav('search')}
        />

        <${NavItem}
          icon=${IconCheck({ size: 18 })}
          label="Verification"
          hash="verify"
          active=${activeHash === 'verify'}
          onClick=${() => handleNav('verify')}
        />

        <${NavItem}
          icon=${IconStar({ size: 18 })}
          label="Start Here"
          hash="start-here"
          active=${activeHash === 'start-here'}
          onClick=${() => handleNav('start-here')}
        />

        <div class="pt-3 mt-3 border-t border-navy-700/50">
          <${NavItem}
            icon=${IconDownload({ size: 18 })}
            label="Export/Import"
            hash="export"
            active=${activeHash === 'export'}
            onClick=${() => handleNav('export')}
          />

          <${NavItem}
            icon=${FederationIcon()}
            label="Federation"
            hash="federation"
            active=${activeHash === 'federation'}
            onClick=${() => handleNav('federation')}
          />

          <${NavItem}
            icon=${BarChartIcon()}
            label="Readiness Report"
            hash="analytics"
            active=${activeHash === 'analytics'}
            onClick=${() => handleNav('analytics')}
          />

          <${NavItem}
            icon=${SettingsIcon()}
            label="Settings"
            hash="settings"
            active=${activeHash === 'settings'}
            onClick=${() => handleNav('settings')}
          />
        </div>
      </nav>

      <!-- Install / Footer -->
      <div class="px-4 py-3 border-t border-navy-700/50 space-y-2">
        ${showInstall && html`
          <button
            onClick=${() => window.installPWA && window.installPWA()}
            class="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Install for Offline
          </button>
        `}
        <p class="text-[10px] text-navy-500 text-center">
          v${CONFIG.VERSION} -- All data stored locally
        </p>
      </div>
    </aside>
  `;
}

// --- Placeholder Component ----------------------------------------------------

function Placeholder({ name }) {
  return html`
    <div class="flex items-center justify-center h-full min-h-[60vh]">
      <div class="text-center">
        <div class="mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="1" class="mx-auto text-slate-300">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
        </div>
        <h2 class="text-lg font-semibold text-slate-600">${name}</h2>
        <p class="text-sm text-slate-400 mt-1">This view is not yet implemented.</p>
      </div>
    </div>
  `;
}

// --- Route Renderer -----------------------------------------------------------

const componentCache = new Map();

async function loadComponent(hash) {
  if (componentCache.has(hash)) return componentCache.get(hash);

  const componentMap = {
    'dashboard':            () => import('./dashboard.js'),
    'capture':              () => import('./capture.js'),
    'capture/stakeholders': () => import('./stakeholder-map.js'),
    'capture/calendar':     () => import('./calendar-view.js'),
    'browse':               () => import('./entry-list.js'),
    'search':               () => import('./search-panel.js'),
    'narrative':            () => import('./narrative.js'),
    'verify':               () => import('./verification.js'),
    'start-here':           () => import('./start-here.js'),
    'export':               () => import('./export-import.js'),
    'federation':           () => import('./federation.js'),
    'analytics':            () => import('./analytics.js'),
    'settings':             () => import('./settings.js'),
    'print':                () => import('./print-view.js'),
    'ai-chat':              () => import('./ai-chat.js'),
  };

  const loader = componentMap[hash];
  if (!loader) return null;

  try {
    const mod = await loader();
    componentCache.set(hash, mod);
    return mod;
  } catch (err) {
    console.warn('[Router] Module for "' + hash + '" not found:', err.message);
    return null;
  }
}

function RouteView({ hash }) {
  const [Component, setComponent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    loadComponent(hash).then(mod => {
      if (cancelled) return;
      if (mod && mod.default) {
        setComponent(() => mod.default);
      } else {
        setComponent(() => () => html`<${Placeholder} name=${hash} />`);
      }
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setComponent(() => () => html`<${Placeholder} name=${hash} />`);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [hash]);

  if (loading) {
    return html`
      <div class="flex items-center justify-center h-full min-h-[40vh]">
        <div class="flex items-center gap-3 text-slate-400">
          <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span class="text-sm">Loading...</span>
        </div>
      </div>
    `;
  }

  return Component ? html`<${Component} />` : null;
}

// --- App Component ------------------------------------------------------------

export default function App() {
  // State
  const [billet, setBilletState]        = useState({ ...CONFIG.DEFAULT_BILLET });
  const [entries, setEntries]           = useState([]);
  const [narratives, setNarratives]     = useState([]);
  const [startHereIds, setStartHereIds] = useState([]);
  const [settings, setSettingsState]    = useState({ ...CONFIG.DEFAULT_SETTINGS });
  const [searchIndex, setSearchIndex]   = useState(new Map());
  const [toasts, setToasts]             = useState([]);
  const [activeHash, setActiveHash]     = useState(getHash());
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [aiChatOpen, setAiChatOpen]     = useState(false);
  const [showInstall, setShowInstall]   = useState(false);

  const toastId = useRef(0);

  // Listen for PWA install availability
  useEffect(() => {
    const onAvailable = () => setShowInstall(true);
    const onInstalled = () => setShowInstall(false);
    window.addEventListener('pwa-install-available', onAvailable);
    window.addEventListener('pwa-installed', onInstalled);
    return () => {
      window.removeEventListener('pwa-install-available', onAvailable);
      window.removeEventListener('pwa-installed', onInstalled);
    };
  }, []);

  // Hydrate from Store on mount
  useEffect(() => {
    const data = Store.load();
    setBilletState(data.billet);
    setEntries(data.entries);
    setNarratives(data.narratives);
    setStartHereIds(data.startHere);
    setSettingsState(data.settings);
    setSearchIndex(buildIndex(data.entries));

    // Check WebGPU availability for offline AI
    if (WebLLMService.isSupported()) {
      console.log('[App] WebGPU available for offline AI');
    }
  }, []);

  // Hash routing
  useEffect(() => {
    function onHashChange() {
      setActiveHash(getHash());
      setSidebarOpen(false);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Ctrl+K toggles AI chat sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setAiChatOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for open-ai-chat custom events from components (e.g., search panel)
  useEffect(() => {
    const handleOpenAIChat = (e) => {
      setAiChatOpen(true);
      // If a query is provided, dispatch it to the chat sidebar via another event
      if (e.detail && e.detail.query) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('ai-chat-prefill', { detail: { query: e.detail.query } }));
        }, 100);
      }
    };
    window.addEventListener('open-ai-chat', handleOpenAIChat);
    return () => window.removeEventListener('open-ai-chat', handleOpenAIChat);
  }, []);

  // Rebuild search index when entries change
  useEffect(() => {
    setSearchIndex(buildIndex(entries));
  }, [entries]);

  // Toast helpers
  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // CRUD methods

  const addEntry = useCallback((entry) => {
    const updated = Store.addEntry(entry);
    setEntries(updated);
    addToast('Entry added', 'success');
    return updated;
  }, [addToast]);

  const updateEntry = useCallback((id, updates) => {
    const updated = Store.updateEntry(id, updates);
    setEntries(updated);
    return updated;
  }, []);

  const deleteEntry = useCallback((id) => {
    const updated = Store.deleteEntry(id);
    setEntries(updated);
    setStartHereIds(prev => prev.filter(sid => sid !== id));
    addToast('Entry deleted', 'info');
    return updated;
  }, [addToast]);

  const setBillet = useCallback((billetData) => {
    Store.saveBillet(billetData);
    setBilletState(billetData);
  }, []);

  const addNarrative = useCallback((narrative) => {
    const updated = Store.addNarrative(narrative);
    setNarratives(updated);
    addToast('Narrative added', 'success');
    return updated;
  }, [addToast]);

  const updateNarrative = useCallback((id, updates) => {
    const updated = Store.updateNarrative(id, updates);
    setNarratives(updated);
    return updated;
  }, []);

  const setStartHere = useCallback((ids) => {
    Store.saveStartHere(ids);
    setStartHereIds(ids);
  }, []);

  const setSettings = useCallback((newSettings) => {
    Store.saveSettings(newSettings);
    setSettingsState(newSettings);
  }, []);

  const refreshFromStore = useCallback(() => {
    const data = Store.load();
    setBilletState(data.billet);
    setEntries(data.entries);
    setNarratives(data.narratives);
    setStartHereIds(data.startHere);
    setSettingsState(data.settings);
    setSearchIndex(buildIndex(data.entries));
  }, []);

  // Context value
  const contextValue = useMemo(() => ({
    billet,
    entries,
    narratives,
    startHereIds,
    settings,
    searchIndex,
    toasts,
    activeHash,

    addEntry,
    updateEntry,
    deleteEntry,
    setBillet,
    addNarrative,
    updateNarrative,
    setStartHere,
    setSettings,
    refreshFromStore,

    addToast,
    dismissToast,
    navigate,
  }), [
    billet, entries, narratives, startHereIds, settings, searchIndex, toasts,
    activeHash, addEntry, updateEntry, deleteEntry, setBillet,
    addNarrative, updateNarrative, setStartHere, setSettings, refreshFromStore,
    addToast, dismissToast,
  ]);

  // Render
  return html`
    <${AppContext.Provider} value=${contextValue}>
      <div class="flex h-screen overflow-hidden">

        <!-- Desktop Sidebar -->
        <div class="hidden lg:flex flex-shrink-0">
          <${Sidebar} activeHash=${activeHash} showInstall=${showInstall} />
        </div>

        <!-- Mobile Sidebar Overlay -->
        ${sidebarOpen && html`
          <div class="lg:hidden fixed inset-0 z-50 flex">
            <div
              class="fixed inset-0 bg-black/50 modal-backdrop"
              onClick=${() => setSidebarOpen(false)}
            />
            <div class="relative z-50 slide-in">
              <${Sidebar}
                activeHash=${activeHash}
                mobile
                onClose=${() => setSidebarOpen(false)}
                showInstall=${showInstall}
              />
            </div>
          </div>
        `}

        <!-- Main Content Area -->
        <div class="flex-1 flex flex-col min-w-0 overflow-hidden">

          <!-- Mobile Header -->
          <header class="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-sm no-print">
            <button
              onClick=${() => setSidebarOpen(true)}
              class="p-1.5 -ml-1 rounded-md text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Open menu"
            >
              ${IconMenu({ size: 22 })}
            </button>
            <div class="flex items-center gap-2 min-w-0">
              ${ShieldLogo({ size: 20 })}
              <span class="font-bold text-navy-900 truncate">Passdown</span>
            </div>
          </header>

          <!-- Page Content -->
          <main class="flex-1 overflow-y-auto bg-slate-50 pb-10">
            <${RouteView} hash=${activeHash} />
          </main>
        </div>
      </div>

      <button
        onClick=${() => setAiChatOpen(true)}
        className="fixed bottom-10 right-6 w-14 h-14 bg-navy-700 hover:bg-navy-600 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105 z-40 no-print"
        aria-label="Open AI Assistant"
        title="AI Assistant (Ctrl+K)"
      >
        ${IconChat({ size: 24 })}
      </button>
      <${AIChatSidebar} isOpen=${aiChatOpen} onClose=${() => setAiChatOpen(false)} />

      <${ToastContainer} toasts=${toasts} onDismiss=${dismissToast} />
      <${Toast} />
    <//>
  `;
}

export { navigate };
