// Offscreen document — runs Transformers.js NER. Service workers can't keep a
// WASM model resident; this hidden page can. Prompt text is inferred here and
// never sent to the network (only the model weights are downloaded once from
// Hugging Face).
//
// CRITICAL (MV3 CSP): @huggingface/transformers defaults wasmPaths to jsDelivr.
// ONNX Runtime / the bundler may also overwrite wasmPaths later (e.g. to a
// hashed .wasm-only object). We lock a local chrome-extension://onnx/ prefix
// so remote .mjs is never imported.

import { env, pipeline } from '@huggingface/transformers'
import { NER_MODEL_ID } from '@/lib/nerPii'
import { toSafeNerError } from '@/lib/nerErrors'
import { writeNerStatus } from '@/lib/nerStatus'
import type { NerEntity } from '@/lib/nerPii'

type TokenClassificationPipeline = (
  text: string,
  options?: { aggregation_strategy?: string },
) => Promise<NerEntity[]>

type WasmEnv = {
  wasmPaths?: unknown
  numThreads?: number
  proxy?: boolean
}

function localOnnxPrefix(): string {
  return chrome.runtime.getURL('onnx/')
}

function isSafeWasmPaths(value: unknown, localPrefix: string): boolean {
  if (typeof value === 'string') {
    if (value.includes('jsdelivr') || value.includes('cdn.')) return false
    return value === localPrefix || value.startsWith('chrome-extension://')
  }
  if (value && typeof value === 'object') {
    const o = value as { mjs?: unknown; wasm?: unknown }
    const mjs = typeof o.mjs === 'string' ? o.mjs : ''
    const wasm = typeof o.wasm === 'string' ? o.wasm : ''
    if (mjs.includes('jsdelivr') || wasm.includes('jsdelivr')) return false
    // Object form must include a same-origin .mjs — otherwise ORT falls back to CDN.
    return mjs.startsWith(localPrefix) && wasm.startsWith(localPrefix)
  }
  return false
}

/**
 * Force local ONNX paths and block later overwrites (CDN default, Vite hashed
 * wasm-only object, empty string, etc.).
 */
function lockLocalWasmPaths(): void {
  const wasm = env.backends?.onnx?.wasm as WasmEnv | undefined
  if (!wasm) return

  const localPrefix = localOnnxPrefix()
  wasm.numThreads = 1
  wasm.proxy = false

  let current: string = localPrefix
  try {
    Object.defineProperty(wasm, 'wasmPaths', {
      configurable: true,
      enumerable: true,
      get() {
        return current
      },
      set(value: unknown) {
        if (isSafeWasmPaths(value, localPrefix)) {
          current =
            typeof value === 'string' ? (value.endsWith('/') ? value : `${value}/`) : localPrefix
          return
        }
        // Ignore CDN / incomplete overwrites — keep the local prefix.
        current = localPrefix
      },
    })
  } catch {
    // defineProperty can fail if the field is non-configurable; fall back.
    wasm.wasmPaths = localPrefix
  }
  // Trigger setter normalization.
  wasm.wasmPaths = localPrefix
}

// Lock immediately after import — before any pipeline() / session init.
lockLocalWasmPaths()

let ner: TokenClassificationPipeline | null = null
let loadPromise: Promise<void> | null = null

/** Aggregate per-file download progress into one 0–1 value (never goes backwards). */
function createProgressTracker(): (item: {
  status?: string
  file?: string
  progress?: number
  loaded?: number
  total?: number
}) => void {
  const totals = new Map<string, number>()
  const loadedMap = new Map<string, number>()
  let lastWritten = -1
  let lastAt = 0

  return (item) => {
    const file = typeof item.file === 'string' ? item.file : ''
    if (item.status === 'progress' && file && typeof item.total === 'number' && item.total > 0) {
      totals.set(file, item.total)
      loadedMap.set(file, typeof item.loaded === 'number' ? item.loaded : 0)
    } else if (item.status === 'done' && file) {
      const t = totals.get(file)
      if (t != null) loadedMap.set(file, t)
      else if (typeof item.progress === 'number') {
        totals.set(file, 1)
        loadedMap.set(file, 1)
      }
    } else if (item.status === 'progress' && typeof item.progress === 'number' && !file) {
      const p = item.progress > 1 ? item.progress / 100 : item.progress
      const now = Date.now()
      if (p - lastWritten < 0.01 && now - lastAt < 120) return
      lastWritten = p
      lastAt = now
      void writeNerStatus({ state: 'downloading', progress: Math.min(0.99, Math.max(0, p)) })
      return
    } else {
      return
    }

    let loaded = 0
    let total = 0
    for (const [f, t] of totals) {
      total += t
      loaded += Math.min(loadedMap.get(f) ?? 0, t)
    }
    if (total <= 0) return
    const p = Math.min(0.99, loaded / total)
    const now = Date.now()
    if (p + 0.0001 < lastWritten) return
    if (p - lastWritten < 0.01 && now - lastAt < 120 && p < 0.99) return
    lastWritten = p
    lastAt = now
    void writeNerStatus({ state: 'downloading', progress: p })
  }
}

async function writeSafeError(err: unknown): Promise<void> {
  const safe = toSafeNerError(err)
  await writeNerStatus({
    state: 'error',
    progress: 0,
    error: safe.message,
    errorDetail: safe.detail,
  })
}

async function loadModel(): Promise<void> {
  if (ner) {
    await writeNerStatus({
      state: 'ready',
      progress: 1,
      error: undefined,
      errorDetail: undefined,
    })
    return
  }
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    lockLocalWasmPaths()
    await writeNerStatus({
      state: 'downloading',
      progress: 0,
      error: undefined,
      errorDetail: undefined,
      modelId: NER_MODEL_ID,
    })
    try {
      const onProgress = createProgressTracker()
      const pipe = await pipeline('token-classification', NER_MODEL_ID, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: onProgress,
      })
      ner = pipe as unknown as TokenClassificationPipeline
      await writeNerStatus({
        state: 'ready',
        progress: 1,
        error: undefined,
        errorDetail: undefined,
      })
    } catch (err) {
      ner = null
      loadPromise = null
      await writeSafeError(err)
      throw err
    }
  })()

  return loadPromise
}

async function infer(text: string): Promise<NerEntity[]> {
  if (!text.trim()) return []
  await loadModel()
  if (!ner) return []
  const out = await ner(text, { aggregation_strategy: 'simple' })
  return Array.isArray(out) ? out : []
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false

  if (message.type === 'NER_OFFSCREEN_PING') {
    sendResponse({ ok: true })
    return false
  }

  if (message.type === 'NER_OFFSCREEN_LOAD') {
    void loadModel()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        const safe = toSafeNerError(err)
        sendResponse({ ok: false, error: safe.message })
      })
    return true
  }

  if (message.type === 'NER_OFFSCREEN_INFER') {
    const text = typeof message.text === 'string' ? message.text : ''
    void infer(text)
      .then((entities) => sendResponse({ ok: true, entities }))
      .catch(() => sendResponse({ ok: false, entities: [] }))
    return true
  }

  return false
})
