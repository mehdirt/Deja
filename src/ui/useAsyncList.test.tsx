import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAsyncList } from './useAsyncList'

// react-dom's act() checks this flag before running; vitest doesn't set it by default.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type State<T> = ReturnType<typeof useAsyncList<T>>

function Harness<T>({
  fetcher,
  onState,
}: {
  fetcher: () => Promise<T[]>
  onState: (s: State<T>) => void
}) {
  onState(useAsyncList(fetcher))
  return null
}

describe('useAsyncList', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('resolves loading -> ready with the fetched items', async () => {
    let latest: State<string> | undefined
    await act(async () => {
      root.render(<Harness fetcher={() => Promise.resolve(['a', 'b'])} onState={(s) => (latest = s)} />)
    })
    expect(latest!.loading).toBe(false)
    expect(latest!.loadError).toBe(false)
    expect(latest!.items).toEqual(['a', 'b'])
  })

  it('a rejected fetch surfaces loadError instead of throwing', async () => {
    let latest: State<string> | undefined
    const fetcher = (): Promise<string[]> => Promise.reject(new Error('boom'))
    await act(async () => {
      root.render(<Harness fetcher={fetcher} onState={(s) => (latest = s)} />)
    })
    expect(latest!.loading).toBe(false)
    expect(latest!.loadError).toBe(true)
    expect(latest!.items).toEqual([])
  })

  it('retrying after an error re-invokes the latest fetcher and recovers to ready', async () => {
    let latest: State<string> | undefined
    let attempt = 0
    const fetcher = (): Promise<string[]> =>
      ++attempt === 1 ? Promise.reject(new Error('boom')) : Promise.resolve(['x'])

    await act(async () => {
      root.render(<Harness fetcher={fetcher} onState={(s) => (latest = s)} />)
    })
    expect(latest!.loadError).toBe(true)

    await act(async () => {
      await latest!.reload()
    })
    expect(latest!.loadError).toBe(false)
    expect(latest!.items).toEqual(['x'])
  })

  it('does not re-fetch on every render when the caller passes a fresh fetcher identity (Library.tsx pattern)', async () => {
    let calls = 0
    function Wrapper() {
      useAsyncList(() => {
        calls++
        return Promise.resolve(['y'])
      })
      return null
    }
    await act(async () => {
      root.render(<Wrapper />)
    })
    const callsAfterMount = calls
    await act(async () => {
      root.render(<Wrapper />) // fresh arrow, same as before — must not re-trigger the mount effect
    })
    expect(calls).toBe(callsAfterMount)
  })

  it('a reload() call does not flip loading back to true (no skeleton flash on mutation refresh)', async () => {
    let latest: State<string> | undefined
    await act(async () => {
      root.render(<Harness fetcher={() => Promise.resolve(['a'])} onState={(s) => (latest = s)} />)
    })
    expect(latest!.loading).toBe(false)

    let sawLoadingDuringReload = true
    await act(async () => {
      const pending = latest!.reload()
      sawLoadingDuringReload = latest!.loading
      await pending
    })
    expect(sawLoadingDuringReload).toBe(false)
  })

  it('ignores a stale reload that settles after a newer one (out-of-order resolution)', async () => {
    let latest: State<string> | undefined
    let resolveFirst: (v: string[]) => void = () => {}
    let calls = 0
    const fetcher = () => {
      calls++
      if (calls === 1) return new Promise<string[]>((resolve) => (resolveFirst = resolve))
      return Promise.resolve(['second'])
    }

    await act(async () => {
      root.render(<Harness fetcher={fetcher} onState={(s) => (latest = s)} />)
    })
    // First reload (from mount) is still pending. Dispatch a second one that
    // resolves immediately, then let the first (stale) one resolve after.
    await act(async () => {
      await latest!.reload()
    })
    expect(latest!.items).toEqual(['second'])

    await act(async () => {
      resolveFirst(['first'])
      await Promise.resolve()
    })
    // The stale first call must not overwrite the newer result.
    expect(latest!.items).toEqual(['second'])
  })
})
