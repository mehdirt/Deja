// Resilient byte download for the NER model. Transformers.js's hub reader has
// no idle timeout — a stalled connection hangs forever with progress stuck.
// We own the fetch: resolve CDN URL, chunked Range reads (mid-stream "network
// error" on ~100MB blobs is common in Chromium), stall detection, retries.

export type ByteProgress = {
  loaded: number
  total: number
  /** 0–1 across this single file (or overall if total known). */
  fraction: number
}

export type FetchWithProgressOptions = {
  /** Abort if no chunk arrives for this long (ms). Default 20s. */
  stallMs?: number
  /** Attempts per chunk / stream. Default 5. */
  maxAttempts?: number
  /** Range chunk size for large files. Default 8 MiB. */
  chunkBytes?: number
  onProgress?: (p: ByteProgress) => void
  signal?: AbortSignal
}

const DEFAULT_CHUNK = 8 * 1024 * 1024

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function emitProgress(
  onProgress: FetchWithProgressOptions['onProgress'],
  loaded: number,
  total: number,
  done = false,
): void {
  const fraction = done
    ? 1
    : total > 0
      ? Math.min(0.99, loaded / total)
      : Math.min(0.95, 1 - 1 / (1 + loaded / (32 * 1024 * 1024)))
  onProgress?.({
    loaded,
    total: total > 0 ? total : loaded,
    fraction,
  })
}

function networkishMessage(err: unknown): string {
  const msg = String((err as Error)?.message ?? err ?? 'network error')
  if (/^network error$/i.test(msg.trim())) {
    return 'Download interrupted (connection reset). Retrying…'
  }
  return msg
}

/** Read a response body with stall timeout. */
async function readResponseBody(
  res: Response,
  stallMs: number,
  signal: AbortSignal | undefined,
): Promise<Uint8Array> {
  if (!res.body) throw new Error('Download returned an empty body')

  const chunks: Uint8Array[] = []
  let loaded = 0
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let stalled = false
  let stallTimer: ReturnType<typeof setTimeout> | undefined

  const ac = new AbortController()
  const onOuterAbort = () => ac.abort()
  signal?.addEventListener('abort', onOuterAbort, { once: true })

  const bumpStall = () => {
    if (stallTimer) clearTimeout(stallTimer)
    stallTimer = setTimeout(() => {
      stalled = true
      void reader?.cancel('stall').catch(() => {})
      ac.abort()
    }, stallMs)
  }

  try {
    reader = res.body.getReader()
    for (;;) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      bumpStall()
      const { done, value } = await reader.read()
      if (done) break
      if (value?.byteLength) {
        chunks.push(value)
        loaded += value.byteLength
      }
    }
    if (stalled) throw new Error('Download stalled — connection stopped responding')
  } finally {
    if (stallTimer) clearTimeout(stallTimer)
    signal?.removeEventListener('abort', onOuterAbort)
  }

  const out = new Uint8Array(loaded)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}

type ResolvedTarget = {
  url: string
  total: number
  /** When the probe already returned the full body (no Range support). */
  earlyBody?: Uint8Array
}

/**
 * Follow redirects once (HF resolve → CDN) and learn Content-Length via a
 * tiny Range probe so later retries hit the CDN blob directly.
 */
async function resolveTarget(
  url: string,
  stallMs: number,
  signal: AbortSignal | undefined,
): Promise<ResolvedTarget> {
  const ac = new AbortController()
  const onOuterAbort = () => ac.abort()
  signal?.addEventListener('abort', onOuterAbort, { once: true })
  let stallTimer: ReturnType<typeof setTimeout> | undefined
  try {
    stallTimer = setTimeout(() => ac.abort(), stallMs)
    const res = await fetch(url, {
      headers: { Range: 'bytes=0-0' },
      signal: ac.signal,
    })
    if (stallTimer) clearTimeout(stallTimer)
    const finalUrl = res.url || url

    if (res.status === 206) {
      const cr = res.headers.get('Content-Range')
      const m = cr?.match(/\/(\d+)\s*$/)
      const total = m ? parseInt(m[1], 10) : 0
      await res.arrayBuffer()
      return { url: finalUrl, total }
    }

    if (!res.ok) {
      throw new Error(`Download failed (${res.status})`)
    }

    // Server ignored Range — stream this response as the full body.
    const lenHeader = res.headers.get('Content-Length')
    const total = lenHeader ? parseInt(lenHeader, 10) : 0
    const earlyBody = await readResponseBody(res, stallMs, signal)
    return { url: finalUrl, total: total || earlyBody.byteLength, earlyBody }
  } finally {
    if (stallTimer) clearTimeout(stallTimer)
    signal?.removeEventListener('abort', onOuterAbort)
  }
}

/**
 * Download a URL to a Uint8Array with stall timeout + retries.
 * Large files use chunked Range requests against the post-redirect CDN URL.
 */
export async function fetchWithProgress(
  url: string,
  opts: FetchWithProgressOptions = {},
): Promise<Uint8Array> {
  const stallMs = opts.stallMs ?? 20_000
  const maxAttempts = opts.maxAttempts ?? 5
  const chunkBytes = opts.chunkBytes ?? DEFAULT_CHUNK

  let target: ResolvedTarget | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      target = await resolveTarget(url, stallMs, opts.signal)
      break
    } catch (err) {
      if (opts.signal?.aborted) throw err
      if (attempt >= maxAttempts) {
        throw new Error(networkishMessage(err))
      }
      await sleep(400 * attempt)
    }
  }
  if (!target) throw new Error('Download failed')

  if (target.earlyBody) {
    emitProgress(opts.onProgress, target.earlyBody.byteLength, target.total, true)
    return target.earlyBody
  }

  const total = target.total
  const useChunks = total > chunkBytes
  const parts: Uint8Array[] = []
  let loaded = 0
  let requestUrl = target.url

  const fetchRange = async (start: number, end: number): Promise<Uint8Array> => {
    const headers: Record<string, string> = {}
    if (useChunks || start > 0) {
      headers.Range = `bytes=${start}-${end}`
    }
    const ac = new AbortController()
    const onOuterAbort = () => ac.abort()
    opts.signal?.addEventListener('abort', onOuterAbort, { once: true })
    let stallTimer: ReturnType<typeof setTimeout> | undefined
    try {
      stallTimer = setTimeout(() => ac.abort(), stallMs)
      const res = await fetch(requestUrl, { headers, signal: ac.signal })
      if (stallTimer) clearTimeout(stallTimer)
      if (res.url) requestUrl = res.url

      if (res.status === 416 && start > 0) return new Uint8Array(0)
      if (!res.ok && res.status !== 206) {
        // Signed CDN URL may have expired — re-resolve next attempt.
        if (res.status === 403 || res.status === 401) requestUrl = url
        throw new Error(`Download failed (${res.status})`)
      }

      // Full 200 when we asked for a Range — take what we need / restart.
      if (res.status === 200 && start > 0) {
        const body = await readResponseBody(res, stallMs, opts.signal)
        return body.subarray(start)
      }

      return await readResponseBody(res, stallMs, opts.signal)
    } finally {
      if (stallTimer) clearTimeout(stallTimer)
      opts.signal?.removeEventListener('abort', onOuterAbort)
    }
  }

  if (!useChunks) {
    // Single stream (small files / unknown total).
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      try {
        const start = loaded
        const end = total > 0 ? total - 1 : 0
        const body =
          loaded > 0 && total > 0
            ? await fetchRange(start, end)
            : await fetchRange(0, total > 0 ? total - 1 : 0)

        if (loaded > 0 && total > 0) {
          parts.push(body)
          loaded += body.byteLength
        } else {
          parts.length = 0
          parts.push(body)
          loaded = body.byteLength
          if (total <= 0) {
            /* keep total 0 — asymptote progress */
          }
        }
        emitProgress(opts.onProgress, loaded, total > 0 ? total : loaded, true)
        break
      } catch (err) {
        if (opts.signal?.aborted) throw err
        if (attempt >= maxAttempts) throw new Error(networkishMessage(err))
        await sleep(500 * attempt)
        // Keep partial `loaded` for Range resume when possible.
        if (loaded === 0) requestUrl = url
      }
    }
  } else {
    while (loaded < total) {
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const start = loaded
      const end = Math.min(loaded + chunkBytes - 1, total - 1)
      let part: Uint8Array | null = null

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          part = await fetchRange(start, end)
          if (part.byteLength === 0 && start < total) {
            throw new Error('Download returned an empty chunk')
          }
          break
        } catch (err) {
          if (opts.signal?.aborted) throw err
          if (attempt >= maxAttempts) {
            throw new Error(networkishMessage(err))
          }
          await sleep(400 * attempt)
          if (attempt === 2) {
            // Re-resolve from origin — signed URL / CDN hop may be stale.
            try {
              const again = await resolveTarget(url, stallMs, opts.signal)
              requestUrl = again.url
            } catch {
              requestUrl = url
            }
          }
        }
      }

      if (!part) throw new Error('Download failed')
      // Guard against oversize last chunk.
      const need = total - loaded
      const slice = part.byteLength > need ? part.subarray(0, need) : part
      parts.push(slice)
      loaded += slice.byteLength
      emitProgress(opts.onProgress, loaded, total, loaded >= total)
    }
  }

  const out = new Uint8Array(loaded)
  let offset = 0
  for (const c of parts) {
    out.set(c, offset)
    offset += c.byteLength
  }
  if (total > 0 && loaded < total) {
    throw new Error(`Download incomplete (${loaded}/${total} bytes)`)
  }
  emitProgress(opts.onProgress, loaded, total > 0 ? total : loaded, true)
  return out
}
