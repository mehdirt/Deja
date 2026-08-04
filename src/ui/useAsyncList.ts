import { useCallback, useEffect, useRef, useState } from 'react'

type Status = 'loading' | 'ready' | 'error'

// Shared by Popup and Library: fetch a list, track loading/error, and expose
// `reload` for both the initial fetch and later silent refreshes (after a
// mutation, or a user-triggered retry). Only the very first fetch shows
// `loading` — a mutation-triggered reload shouldn't flash the list back to a
// skeleton, and a retry from an error state shouldn't either; it just resolves
// into `ready` or stays `error`.
export function useAsyncList<T>(fetcher: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([])
  const [status, setStatus] = useState<Status>('loading')

  // A ref, not a dependency: callers often pass a fresh arrow function each
  // render (e.g. `() => listPrompts({ includeMinor: true })`). Reading through
  // a ref keeps `reload`'s identity stable so the mount effect below only
  // fires once, while `reload` always calls the latest fetcher.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  // Guards against out-of-order resolution: callers fire reload() unawaited
  // from several places (mutation handlers, the retry button), so a slower
  // call dispatched earlier can otherwise settle after a faster later one and
  // overwrite fresher state with stale data. Only the most recently dispatched
  // call is allowed to commit when it settles.
  const requestId = useRef(0)

  const reload = useCallback(() => {
    const id = ++requestId.current
    return fetcherRef
      .current()
      .then((data) => {
        if (id !== requestId.current) return
        setItems(data)
        setStatus('ready')
      })
      .catch((err) => {
        if (id !== requestId.current) return
        console.error('useAsyncList: failed to load', err)
        setStatus('error')
      })
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { items, loading: status === 'loading', loadError: status === 'error', reload }
}
