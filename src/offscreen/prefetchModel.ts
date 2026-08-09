// Prefetch Xenova NER files into an in-memory Transformers.js customCache.
// Owns the slow ~100MB download so we can report real byte progress and recover
// from stalled connections (hub.js has no idle timeout).

import { env } from '@huggingface/transformers'
import { NER_MODEL_ID } from '@/lib/nerPii'
import { fetchWithProgress } from './fetchWithProgress'

/** Relative paths transformers.js will request for dtype q8. */
export const NER_MODEL_FILES: Array<{
  path: string
  /** soft weight for progress */
  weight: number
  /** Skip quietly on 404 (tokenizer.json often replaces vocab.txt). */
  optional?: boolean
}> = [
  { path: 'config.json', weight: 1 },
  { path: 'tokenizer_config.json', weight: 1 },
  { path: 'special_tokens_map.json', weight: 1, optional: true },
  { path: 'tokenizer.json', weight: 8 },
  { path: 'vocab.txt', weight: 4, optional: true },
  { path: 'onnx/model_quantized.onnx', weight: 100 },
]

function remoteUrl(modelId: string, filePath: string, revision = 'main'): string {
  const host = (env.remoteHost || 'https://huggingface.co/').replace(/\/?$/, '/')
  const template = env.remotePathTemplate || '{model}/resolve/{revision}/'
  const base = template.replaceAll('{model}', modelId).replaceAll('{revision}', encodeURIComponent(revision))
  return host + base.replace(/\/?$/, '/') + filePath.replace(/^\//, '')
}

function contentType(path: string): string {
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.txt')) return 'text/plain'
  if (path.endsWith('.onnx')) return 'application/octet-stream'
  return 'application/octet-stream'
}

export type PrefetchProgress = {
  /** 0–1 across all files (by weight × bytes). */
  fraction: number
  file: string
  fileFraction: number
}

/**
 * Download model files into a Map and point Transformers.js at it via customCache.
 * Returns when every file is ready for `pipeline()`.
 */
export async function prefetchNerModel(
  onProgress: (p: PrefetchProgress) => void,
  opts?: { signal?: AbortSignal; modelId?: string },
): Promise<void> {
  const modelId = opts?.modelId ?? NER_MODEL_ID
  /** One byte buffer per file; Response built on match so we don't 4× the 100MB blob. */
  const store = new Map<string, { bytes: Uint8Array; path: string }>()
  const totalWeight = NER_MODEL_FILES.reduce((s, f) => s + f.weight, 0)
  let doneWeight = 0

  const toResponse = (entry: { bytes: Uint8Array; path: string }) =>
    new Response(new Blob([entry.bytes as BlobPart]), {
      status: 200,
      headers: {
        'Content-Type': contentType(entry.path),
        'Content-Length': String(entry.bytes.byteLength),
      },
    })

  // tryCache probes localPath (`/models/{id}/{file}`) then remoteURL.
  const put = (url: string, path: string, bytes: Uint8Array) => {
    const entry = { bytes, path }
    store.set(url, entry)
    store.set(path, entry)
    store.set(`${modelId}/${path}`, entry)
    store.set(`/models/${modelId}/${path}`, entry)
  }

  env.useBrowserCache = false
  env.useCustomCache = true
  env.allowRemoteModels = true
  env.allowLocalModels = false
  env.customCache = {
    match: async (request: RequestInfo | string) => {
      const key = typeof request === 'string' ? request : request.url
      const hit = store.get(key)
      if (hit) return toResponse(hit)
      for (const [k, v] of store) {
        if (key.endsWith(k) || k.endsWith(key)) return toResponse(v)
      }
      return undefined
    },
    put: async (request: RequestInfo | string, response: Response) => {
      const key = typeof request === 'string' ? request : request.url
      const buf = new Uint8Array(await response.arrayBuffer())
      store.set(key, { bytes: buf, path: key })
    },
  }

  for (const file of NER_MODEL_FILES) {
    if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const url = remoteUrl(modelId, file.path)
    try {
      const bytes = await fetchWithProgress(url, {
        signal: opts?.signal,
        stallMs: 20_000,
        // Big ONNX blob gets more retries — Chromium often resets long streams.
        maxAttempts: file.weight >= 50 ? 6 : 4,
        onProgress: (bp) => {
          const fileFrac = bp.fraction
          const overall = (doneWeight + file.weight * fileFrac) / totalWeight
          onProgress({
            fraction: Math.min(0.97, overall),
            file: file.path,
            fileFraction: fileFrac,
          })
        },
      })
      put(url, file.path, bytes)
      doneWeight += file.weight
      onProgress({
        fraction: Math.min(0.97, doneWeight / totalWeight),
        file: file.path,
        fileFraction: 1,
      })
    } catch (err) {
      if (file.optional) {
        doneWeight += file.weight
        continue
      }
      const tip = String((err as Error)?.message ?? err)
      throw new Error(`Couldn’t download ${file.path}: ${tip}`)
    }
  }
}
