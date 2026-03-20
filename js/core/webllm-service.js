// ─── WebLLM Service ─────────────────────────────────────────────────────────
// Offline AI inference using WebGPU via @mlc-ai/web-llm.
// Runs entirely in the browser — no server, no API calls, no data leaves the machine.
// Requires Chrome 113+ or Edge 113+ with WebGPU support.

const DEFAULT_MODEL = 'Phi-3.5-mini-instruct-q4f16_1-MLC';

const AVAILABLE_MODELS = Object.freeze([
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi 3.5 Mini (3.8B)', size: '~1.8 GB', license: 'MIT', recommended: true },
  { id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC', name: 'SmolLM2 (1.7B)', size: '~1 GB', license: 'Apache 2.0', recommended: false },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 (1.5B)', size: '~1 GB', license: 'Apache 2.0', recommended: false },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 (3B)', size: '~1.8 GB', license: 'Llama Community', recommended: false },
]);

// ─── WebLLM Service Object ──────────────────────────────────────────────────

const WebLLMService = {
  initialized: false,
  loading: false,
  progress: { text: '', progress: 0 },
  modelId: null,
  engine: null,

  // ── WebGPU Support Check ────────────────────────────────────────────────

  isSupported() {
    return !!navigator.gpu;
  },

  // ── Initialize Engine ───────────────────────────────────────────────────

  async init(modelId, onProgress) {
    if (this.loading) {
      console.warn('[WebLLM] Already loading a model. Please wait.');
      return;
    }

    if (!this.isSupported()) {
      throw new Error('WebGPU is not supported in this browser. Use Chrome 113+ or Edge 113+.');
    }

    const targetModel = modelId || DEFAULT_MODEL;

    // If already initialized with the same model, skip
    if (this.initialized && this.engine && this.modelId === targetModel) {
      console.log('[WebLLM] Already initialized with model:', targetModel);
      return;
    }

    // If initialized with a different model, unload first
    if (this.initialized && this.engine && this.modelId !== targetModel) {
      await this.unload();
    }

    this.loading = true;
    this.progress = { text: 'Importing WebLLM library...', progress: 0 };

    try {
      const webllm = await import('https://esm.sh/@mlc-ai/web-llm@0.2.74');

      this.progress = { text: 'Initializing model engine...', progress: 0 };

      const progressCallback = (report) => {
        this.progress = {
          text: report.text || '',
          progress: typeof report.progress === 'number' ? report.progress : 0,
        };
        if (typeof onProgress === 'function') {
          onProgress(this.progress);
        }
      };

      const engine = await webllm.CreateMLCEngine(targetModel, {
        initProgressCallback: progressCallback,
      });

      this.engine = engine;
      this.modelId = targetModel;
      this.initialized = true;
      this.loading = false;
      this.progress = { text: 'Model ready.', progress: 1 };

      console.log('[WebLLM] Initialized with model:', targetModel);
    } catch (err) {
      this.loading = false;
      this.initialized = false;
      this.engine = null;
      this.modelId = null;
      this.progress = { text: 'Initialization failed: ' + (err.message || 'Unknown error'), progress: 0 };

      console.error('[WebLLM] Initialization failed:', err);
      throw err;
    }
  },

  // ── Availability Check ──────────────────────────────────────────────────

  isAvailable() {
    return this.initialized && this.engine !== null;
  },

  getModelId() {
    return this.modelId || null;
  },

  // ── Multi-Turn Chat ─────────────────────────────────────────────────────

  async chat(messages, systemPrompt) {
    if (!this.isAvailable()) {
      throw new Error('WebLLM engine is not initialized. Call init() first.');
    }

    try {
      const chatMessages = [];

      // System prompt
      if (systemPrompt) {
        chatMessages.push({ role: 'system', content: systemPrompt });
      }

      // Conversation history
      for (const msg of messages) {
        chatMessages.push({
          role: msg.role === 'model' ? 'assistant' : msg.role,
          content: msg.content,
        });
      }

      const response = await this.engine.chat.completions.create({
        messages: chatMessages,
        temperature: 0.4,
        max_tokens: 2048,
      });

      const text = response.choices?.[0]?.message?.content || '';
      return text;
    } catch (err) {
      console.error('[WebLLM] Chat error:', err);
      throw new Error('WebLLM chat failed: ' + (err.message || 'Unknown error'));
    }
  },

  // ── Single-Turn Generation ──────────────────────────────────────────────

  async generate(prompt) {
    if (!this.isAvailable()) {
      throw new Error('WebLLM engine is not initialized. Call init() first.');
    }

    try {
      const response = await this.engine.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
      });

      const text = response.choices?.[0]?.message?.content || '';
      return text;
    } catch (err) {
      console.error('[WebLLM] Generate error:', err);
      throw new Error('WebLLM generation failed: ' + (err.message || 'Unknown error'));
    }
  },

  // ── Unload Model ────────────────────────────────────────────────────────

  async unload() {
    if (this.engine) {
      try {
        await this.engine.unload();
        console.log('[WebLLM] Model unloaded:', this.modelId);
      } catch (err) {
        console.warn('[WebLLM] Error during unload:', err);
      }
    }

    this.engine = null;
    this.initialized = false;
    this.loading = false;
    this.modelId = null;
    this.progress = { text: '', progress: 0 };
  },

  // ── Available Models ────────────────────────────────────────────────────

  getAvailableModels() {
    return AVAILABLE_MODELS;
  },

  // ── Cache Status ────────────────────────────────────────────────────────

  async getCacheStatus() {
    try {
      const cacheNames = await caches.keys();
      // WebLLM uses cache names that contain 'webllm' or model-related prefixes
      const webllmCaches = cacheNames.filter(name =>
        name.toLowerCase().includes('webllm') ||
        name.toLowerCase().includes('mlc') ||
        name.toLowerCase().includes('tvmjs')
      );

      if (webllmCaches.length === 0) {
        return { cached: false, modelId: null };
      }

      // Check if the current/default model appears in any cache
      const targetModel = this.modelId || DEFAULT_MODEL;
      let modelCached = false;

      for (const cacheName of webllmCaches) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        const hasModel = keys.some(req =>
          req.url.includes(targetModel) || req.url.includes(targetModel.replace(/-/g, '_'))
        );
        if (hasModel) {
          modelCached = true;
          break;
        }
      }

      return {
        cached: modelCached || webllmCaches.length > 0,
        modelId: modelCached ? targetModel : null,
        cacheNames: webllmCaches,
      };
    } catch (err) {
      console.warn('[WebLLM] Cache status check failed:', err);
      return { cached: false, modelId: null };
    }
  },
};

export default WebLLMService;
