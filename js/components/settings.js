// ─── Settings ────────────────────────────────────────────────────────────────
// Billet setup, preferences, AI placeholder, data management, and about.

import { html } from '../core/config.js';
import CONFIG, { VERIFICATION_INTERVAL_DAYS } from '../core/config.js';
import { useApp } from './app.js';
import Store from '../core/store.js';
import AIService from '../core/ai-service.js';
import WebLLMService from '../core/webllm-service.js';
import { Button, Select, ConfirmDialog, ProgressBar, showToast } from '../shared/ui.js';
import { IconWarning } from '../shared/icons.js';

const { useState, useEffect, useCallback, useMemo } = React;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ─── Settings Icon (inline to avoid name collisions) ─────────────────────────

function SettingsPageIcon({ size = 24 }) {
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  `;
}

// ─── Billet Setup ────────────────────────────────────────────────────────────

function BilletSetup() {
  const { billet, setBillet } = useApp();
  const [form, setForm] = useState({ ...billet });
  const [dirty, setDirty] = useState(false);

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    setBillet(form);
    setDirty(false);
    showToast('Billet information saved', 'success');
  };

  const inputClass = 'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 class="text-lg font-semibold text-navy-900">Billet Setup</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class=${labelClass}>Billet Title</label>
          <input type="text" value=${form.title || ''} onChange=${e => update('title', e.target.value)}
            class=${inputClass} placeholder="e.g., S-3 Operations Officer" />
        </div>
        <div>
          <label class=${labelClass}>Organization / Unit</label>
          <input type="text" value=${form.unit || ''} onChange=${e => update('unit', e.target.value)}
            class=${inputClass} placeholder="e.g., 1st Bn, 5th Marines" />
        </div>
      </div>
      <div>
        <label class=${labelClass}>Mission</label>
        <textarea value=${form.billetDescription || ''} onChange=${e => update('billetDescription', e.target.value)}
          rows="3" class=${inputClass}
          placeholder="Brief description of the billet mission and primary responsibilities..." />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class=${labelClass}>Outgoing PCS / Turnover Date</label>
          <input type="date" value=${form.turnoverDate || ''} onChange=${e => update('turnoverDate', e.target.value)}
            class=${inputClass} />
        </div>
        <div>
          <label class=${labelClass}>Incoming Arrival Date (optional)</label>
          <input type="date" value=${form.incomingDate || ''} onChange=${e => update('incomingDate', e.target.value)}
            class=${inputClass} />
        </div>
      </div>
      <div class="flex justify-end pt-2">
        <${Button} onClick=${handleSave} disabled=${!dirty}>Save Billet Info<//>
      </div>
    </div>
  `;
}

// ─── Preferences ─────────────────────────────────────────────────────────────

function Preferences() {
  const { settings, setSettings } = useApp();
  const [interval, setInterval] = useState(settings.verifyIntervalDays || VERIFICATION_INTERVAL_DAYS);
  const [dirty, setDirty] = useState(false);

  const handleChange = (value) => {
    setInterval(parseInt(value) || VERIFICATION_INTERVAL_DAYS);
    setDirty(true);
  };

  const handleSave = () => {
    setSettings({ ...settings, verifyIntervalDays: interval });
    setDirty(false);
    showToast('Preferences saved', 'success');
  };

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 class="text-lg font-semibold text-navy-900">Preferences</h2>
      <div class="max-w-xs">
        <label class="block text-sm font-medium text-slate-700 mb-1">Verification Interval (days)</label>
        <input type="number" min="1" max="365" value=${interval}
          onChange=${e => handleChange(e.target.value)}
          class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm text-slate-700
                 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500" />
        <p class="text-xs text-slate-500 mt-1">
          Entries flagged "expiring" 30 days before this interval, "stale" after. Default: ${VERIFICATION_INTERVAL_DAYS} days.
        </p>
      </div>
      <div class="flex justify-end pt-2">
        <${Button} onClick=${handleSave} disabled=${!dirty}>Save Preferences<//>
      </div>
    </div>
  `;
}

// ─── Offline AI (WebLLM) ──────────────────────────────────────────────────────

const WEBLLM_MODELS = [
  { value: 'Phi-3.5-mini-instruct-q4f16_1-MLC',    label: 'Phi 3.5 Mini (recommended)', size: '~2.2 GB' },
  { value: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',    label: 'SmolLM2 1.7B',               size: '~1.0 GB' },
  { value: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',    label: 'Qwen 2.5 1.5B',              size: '~1.0 GB' },
  { value: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',     label: 'Llama 3.2 3B',               size: '~1.8 GB' },
];

function OfflineAIConfiguration() {
  const [webGPUSupported, setWebGPUSupported] = useState(null); // null = checking
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem('passdown_webllm_model') || WEBLLM_MODELS[0].value
  );
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [modelReady, setModelReady] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [provider, setProvider] = useState(
    () => localStorage.getItem('passdown_ai_provider') || 'firebase'
  );

  // Check WebGPU support on mount
  useEffect(() => {
    const check = async () => {
      const supported = WebLLMService.isSupported();
      setWebGPUSupported(supported);
      // Check if a model is already cached/loaded
      if (supported && WebLLMService.isReady()) {
        setModelReady(true);
        setModelLoaded(true);
      }
    };
    check();
  }, []);

  const modelInfo = WEBLLM_MODELS.find(m => m.value === selectedModel) || WEBLLM_MODELS[0];

  const handleModelChange = useCallback((value) => {
    setSelectedModel(value);
    localStorage.setItem('passdown_webllm_model', value);
    // Reset ready state if model changed from what's loaded
    if (WebLLMService.isReady() && WebLLMService.getModelId() !== value) {
      setModelReady(false);
      setModelLoaded(false);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    setProgress(0);
    setProgressText('Initializing...');
    try {
      await WebLLMService.load(selectedModel, (report) => {
        if (report.progress !== undefined) {
          setProgress(Math.round(report.progress * 100));
        }
        if (report.text) {
          setProgressText(report.text);
        }
      });
      setModelReady(true);
      setModelLoaded(true);
      showToast('Offline AI model ready', 'success');
    } catch (err) {
      console.error('[OfflineAI] Download failed:', err);
      showToast('Model download failed: ' + err.message, 'error');
    } finally {
      setDownloading(false);
    }
  }, [selectedModel]);

  const handleUnload = useCallback(() => {
    WebLLMService.unload();
    setModelReady(false);
    setModelLoaded(false);
    showToast('Model unloaded — GPU memory freed', 'info');
  }, []);

  const handleProviderChange = useCallback((newProvider) => {
    setProvider(newProvider);
    localStorage.setItem('passdown_ai_provider', newProvider);
    if (typeof AIService.setProvider === 'function') {
      AIService.setProvider(newProvider);
    }
    showToast('AI provider set to ' + (newProvider === 'webllm' ? 'Offline (WebLLM)' : 'Online (Firebase)'), 'info');
  }, []);

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-navy-900">Offline AI (WebLLM)</h2>
        <span class=${
          webGPUSupported === null
            ? 'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-50 text-slate-500 border border-slate-200'
            : webGPUSupported
              ? 'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-green-50 text-green-700 border border-green-200'
              : 'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-red-50 text-red-700 border border-red-200'
        }>
          <span class=${
            webGPUSupported === null ? 'w-2 h-2 rounded-full bg-slate-400'
              : webGPUSupported ? 'w-2 h-2 rounded-full bg-green-500'
              : 'w-2 h-2 rounded-full bg-red-500'
          } />
          ${webGPUSupported === null ? 'Checking...'
            : webGPUSupported ? 'WebGPU supported'
            : 'WebGPU not supported'}
        </span>
      </div>

      <p class="text-sm text-slate-600 leading-relaxed">
        Run AI entirely in your browser — no internet needed, no data leaves your machine.
      </p>

      ${!webGPUSupported && webGPUSupported !== null && html`
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p class="text-sm text-amber-800 font-medium mb-1">WebGPU Not Available</p>
          <p class="text-xs text-amber-700 leading-relaxed">
            Offline AI requires WebGPU, available in Chrome 113+, Edge 113+, or other Chromium browsers.
            Offline AI requires a WebGPU-capable browser to run.
          </p>
        </div>
      `}

      ${webGPUSupported && html`
        <!-- Model Selection -->
        <div class="space-y-3">
          <${Select}
            label="Model"
            value=${selectedModel}
            onChange=${handleModelChange}
            options=${WEBLLM_MODELS.map(m => ({ value: m.value, label: m.label }))}
            disabled=${downloading}
          />
          <p class="text-xs text-slate-500">
            ${modelInfo.size} download, cached after first use.
          </p>
        </div>

        <!-- Download / Status -->
        ${downloading && html`
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-slate-700 font-medium">Downloading model...</span>
              <span class="text-slate-500">${progress}%</span>
            </div>
            <${ProgressBar} value=${progress} color="bg-blue-500" />
            <p class="text-xs text-slate-500">${progressText}</p>
          </div>
        `}

        ${modelReady && !downloading && html`
          <div class="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
            <p class="text-sm text-green-800 font-medium">Model ready — works offline!</p>
          </div>
        `}

        <div class="flex flex-wrap items-center gap-3">
          ${!modelReady && !downloading && html`
            <${Button} onClick=${handleDownload}>
              Download & Enable
            <//>
          `}
          ${modelReady && !downloading && !modelLoaded && html`
            <${Button} onClick=${handleDownload}>
              Load Model
            <//>
          `}
          ${modelLoaded && html`
            <${Button} variant="secondary" onClick=${handleUnload}>
              Unload Model
            <//>
          `}
        </div>

        <p class="text-xs text-slate-500 pt-2 border-t border-slate-200">
          All AI runs locally on your device. No data is transmitted to any server.
        </p>
      `}
    </div>
  `;
}

// ─── AI Configuration ─────────────────────────────────────────────────────────

const FIREBASE_FIELDS = [
  { key: 'apiKey',            label: 'API Key',             placeholder: 'AIzaSy...' },
  { key: 'authDomain',       label: 'Auth Domain',         placeholder: 'my-project.firebaseapp.com' },
  { key: 'projectId',        label: 'Project ID',          placeholder: 'my-project' },
  { key: 'storageBucket',    label: 'Storage Bucket',      placeholder: 'my-project.appspot.com' },
  { key: 'messagingSenderId', label: 'Messaging Sender ID', placeholder: '123456789' },
  { key: 'appId',            label: 'App ID',              placeholder: '1:123456789:web:abc123' },
];

function AIConfiguration() {
  const { settings, setSettings } = useApp();
  const existing = settings.firebaseConfig || {};
  const [form, setForm] = useState({ ...existing });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // 'success' | 'error' | null
  const [confirmClear, setConfirmClear] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isConfigured = !!(settings.firebaseConfig && settings.firebaseConfig.apiKey);
  const aiEnabled = settings.aiEnabled || false;

  const inputClass = 'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await AIService.init(form);
      setTestResult('success');
      showToast('Firebase connection successful', 'success');
    } catch (err) {
      setTestResult('error');
      showToast('Connection failed: ' + err.message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setSettings({ ...settings, firebaseConfig: { ...form } });
    setDirty(false);
    showToast('Firebase configuration saved', 'success');
    // Re-initialize AI with the new config
    if (form.apiKey) {
      AIService.init(form).catch(() => {});
    }
  };

  const handleClear = () => {
    setForm({});
    setSettings({ ...settings, firebaseConfig: null, aiEnabled: false });
    setDirty(false);
    setTestResult(null);
    setConfirmClear(false);
    AIService.destroy();
    showToast('Firebase configuration cleared', 'info');
  };

  const handleToggleAI = (enabled) => {
    setSettings({ ...settings, aiEnabled: enabled });
    if (enabled && settings.firebaseConfig && settings.firebaseConfig.apiKey) {
      AIService.init(settings.firebaseConfig).catch(() => {});
    }
  };

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-navy-900">AI Configuration</h2>
        <span class=${
          isConfigured
            ? 'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-green-50 text-green-700 border border-green-200'
            : 'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-50 text-slate-500 border border-slate-200'
        }>
          <span class=${isConfigured ? 'w-2 h-2 rounded-full bg-green-500' : 'w-2 h-2 rounded-full bg-slate-400'} />
          ${isConfigured ? 'Connected' : 'Not configured'}
        </span>
      </div>

      <!-- Default AI info -->
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <p class="text-sm text-green-800 font-medium mb-1">AI is ready to use</p>
        <p class="text-xs text-green-700 leading-relaxed">
          Passdown AI uses Google Gemini 2.5 Flash (free tier). Just click the AI chat button and sign in with Google — no setup required.
          The fields below are only needed if you want to use your own Firebase project.
        </p>
      </div>

      <!-- Advanced: Custom Firebase config -->
      <details class="border border-slate-200 rounded-lg">
        <summary class="px-4 py-2 text-sm font-medium text-slate-600 cursor-pointer hover:bg-slate-50">
          Advanced: Use your own Firebase project
        </summary>
        <div class="px-4 pb-4 pt-2 space-y-3 border-t border-slate-200">

      <!-- Config fields -->
      <div class="space-y-3">
        ${FIREBASE_FIELDS.map(field => html`
          <div key=${field.key}>
            <label class=${labelClass}>${field.label}</label>
            <input
              type=${field.key === 'apiKey' ? 'password' : 'text'}
              value=${form[field.key] || ''}
              onChange=${e => updateField(field.key, e.target.value)}
              class=${inputClass}
              placeholder=${field.placeholder}
              autocomplete="off"
            />
          </div>
        `)}
      </div>

      <!-- Enable AI toggle -->
      <div class="flex items-center gap-3 pt-2 border-t border-slate-200">
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked=${aiEnabled}
            onChange=${e => handleToggleAI(e.target.checked)}
            class="sr-only peer"
          />
          <div class="w-9 h-5 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-navy-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-navy-600" />
        </label>
        <span class="text-sm font-medium text-slate-700">Enable AI Features</span>
      </div>

      <!-- Action buttons -->
      <div class="flex flex-wrap items-center gap-3 pt-2">
        <${Button}
          onClick=${handleTestConnection}
          disabled=${!form.apiKey || testing}
        >
          ${testing ? 'Testing...' : 'Test Connection'}
        <//>
        <${Button}
          onClick=${handleSave}
          disabled=${!dirty || !form.apiKey}
        >
          Save Firebase Config
        <//>
        ${isConfigured && html`
          <${Button}
            variant="danger"
            onClick=${() => setConfirmClear(true)}
          >
            Clear Firebase Config
          <//>
        `}
      </div>

      <!-- Test result feedback -->
      ${testResult === 'success' && html`
        <p class="text-sm text-green-600 font-medium">Connection test passed.</p>
      `}
      ${testResult === 'error' && html`
        <p class="text-sm text-red-600 font-medium">Connection test failed. Check your config values.</p>
      `}

        </div>
      </details>

      <${ConfirmDialog}
        isOpen=${confirmClear}
        onCancel=${() => setConfirmClear(false)}
        onConfirm=${handleClear}
        title="Clear Firebase Config"
        message="This will remove your custom Firebase configuration. The built-in AI will continue to work."
        confirmText="Clear Config"
        danger=${true}
      />
    </div>
  `;
}

// ─── Data Management ─────────────────────────────────────────────────────────

function DataManagement() {
  const { entries } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);
  const storageSize = useMemo(() => Store.getStorageSize(), [entries]);

  const handleClear = useCallback(() => {
    Store.clearAll();
    setConfirmClear(false);
    showToast('All data cleared', 'info');
    window.location.reload();
  }, []);

  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 class="text-lg font-semibold text-navy-900">Data Management</h2>
      <div>
        <p class="text-sm text-slate-700 font-medium">Storage Usage</p>
        <p class="text-xs text-slate-500">${formatBytes(storageSize)} of ~5 MB used</p>
        <div class="w-48 h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
          <div class="h-full bg-navy-600 rounded-full transition-all"
            style=${{ width: Math.min((storageSize / (5 * 1024 * 1024)) * 100, 100) + '%' }} />
        </div>
      </div>
      <div class="pt-2 border-t border-slate-200">
        <${Button} variant="danger" onClick=${() => setConfirmClear(true)}>
          ${IconWarning({ size: 16 })} Clear All Data
        <//>
      </div>
      <${ConfirmDialog} isOpen=${confirmClear} onCancel=${() => setConfirmClear(false)} onConfirm=${handleClear}
        title="Clear All Data"
        message="This will permanently delete all entries, narratives, and settings. Export your data first! This action cannot be undone."
        confirmText="Delete Everything" danger=${true} />
    </div>
  `;
}

// ─── About ───────────────────────────────────────────────────────────────────

function About() {
  return html`
    <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 class="text-lg font-semibold text-navy-900">About</h2>
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <span class="text-sm text-slate-700 font-medium">Version</span>
          <span class="text-sm text-slate-500">${CONFIG.VERSION}</span>
        </div>
        <p class="text-sm text-slate-600">
          <strong>Passdown</strong> -- Zero-cost knowledge transfer for military billet turnover.
        </p>
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div class="flex items-start gap-2">
            <div class="flex-shrink-0 mt-0.5">${IconWarning({ size: 18, className: 'text-amber-600' })}</div>
            <div>
              <h3 class="text-sm font-semibold text-amber-800">OPSEC Notice</h3>
              <p class="text-xs text-amber-700 mt-1 leading-relaxed">
                REMINDER: Do not enter classified information, PII (personal names),
                or specific manning numbers. Use billet titles, not personal names.
                Review all entries for OPSEC compliance before sharing or exporting.
              </p>
            </div>
          </div>
        </div>
        <div class="text-xs text-slate-400 pt-2 border-t border-slate-100">
          <p>MIT License -- Free for government and personal use.</p>
          <p class="mt-1">All data is stored locally in your browser. No data is transmitted to external servers.</p>
        </div>
      </div>
    </div>
  `;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Settings() {
  return html`
    <div class="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 class="text-2xl font-bold text-navy-900 flex items-center gap-2">
        ${SettingsPageIcon({ size: 24 })} Settings
      </h1>
      <${BilletSetup} />
      <${Preferences} />
      <${OfflineAIConfiguration} />
      <${DataManagement} />
      <${About} />
    </div>
  `;
}
