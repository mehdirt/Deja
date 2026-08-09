import { describe, expect, it, vi, afterEach } from 'vitest'
import { fetchWithProgress } from './fetchWithProgress'

function streamOf(...parts: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of parts) controller.enqueue(p)
      controller.close()
    },
  })
}

describe('fetchWithProgress', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports fraction from Content-Length and returns bytes', async () => {
    const body = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        calls += 1
        const range = new Headers(init?.headers).get('Range')
        if (range === 'bytes=0-0') {
          return new Response(new Uint8Array([1]), {
            status: 206,
            headers: {
              'Content-Length': '1',
              'Content-Range': 'bytes 0-0/8',
            },
          })
        }
        return new Response(streamOf(body.subarray(0, 4), body.subarray(4)), {
          status: 200,
          headers: { 'Content-Length': '8' },
        })
      }),
    )

    const ticks: number[] = []
    const out = await fetchWithProgress('https://example.com/f.bin', {
      stallMs: 5_000,
      onProgress: (p) => ticks.push(p.fraction),
    })

    expect(out).toEqual(body)
    expect(ticks.at(-1)).toBeCloseTo(1, 5)
    expect(calls).toBeGreaterThanOrEqual(2)
  })

  it(
    'retries a stalled chunk and finishes via Range',
    async () => {
      const full = new Uint8Array([9, 9, 9, 9])
      let calls = 0
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: string, init?: RequestInit) => {
          calls += 1
          const range = new Headers(init?.headers).get('Range')
          if (range === 'bytes=0-0') {
            return new Response(new Uint8Array([9]), {
              status: 206,
              headers: {
                'Content-Length': '1',
                'Content-Range': 'bytes 0-0/4',
              },
            })
          }
          // First full-body attempt hangs until cancel
          if (calls === 2) {
            return new Response(
              new ReadableStream<Uint8Array>({
                start() {
                  /* hang */
                },
                cancel() {
                  /* allow cancel */
                },
              }),
              {
                status: 200,
                headers: { 'Content-Length': '4' },
              },
            )
          }
          return new Response(full, {
            status: 200,
            headers: { 'Content-Length': '4' },
          })
        }),
      )

      const out = await fetchWithProgress('https://example.com/f.bin', {
        stallMs: 80,
        maxAttempts: 4,
      })
      expect(out).toEqual(full)
      expect(calls).toBeGreaterThanOrEqual(3)
    },
    15_000,
  )

  it('downloads large files in Range chunks', async () => {
    const total = 20
    const bytes = Uint8Array.from({ length: total }, (_, i) => i + 1)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const range = new Headers(init?.headers).get('Range') ?? ''
        if (range === 'bytes=0-0') {
          return new Response(new Uint8Array([bytes[0]!]), {
            status: 206,
            headers: {
              'Content-Length': '1',
              'Content-Range': `bytes 0-0/${total}`,
            },
          })
        }
        const m = range.match(/^bytes=(\d+)-(\d+)$/)
        if (!m) throw new Error(`unexpected range ${range}`)
        const start = parseInt(m[1]!, 10)
        const end = parseInt(m[2]!, 10)
        const slice = bytes.subarray(start, end + 1)
        return new Response(slice, {
          status: 206,
          headers: {
            'Content-Length': String(slice.byteLength),
            'Content-Range': `bytes ${start}-${end}/${total}`,
          },
        })
      }),
    )

    const out = await fetchWithProgress('https://cdn.example/big.bin', {
      stallMs: 5_000,
      chunkBytes: 8,
    })
    expect(out).toEqual(bytes)
  })
})
