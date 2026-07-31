// Spelled out rather than abbreviated ("5 minutes ago", not "5m ago") — the
// compact form reads as a log line, and this text sits next to prose.
export function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d} days ago`
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** The site name and conversation link for a stored prompt, when the captured
 *  URL actually points at a conversation. A prompt sent as the first message of
 *  a new chat is captured before the site assigns a conversation URL, so the
 *  path is bare — offering "open the chat" there would just reload the homepage. */
export function conversationUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return null
    // A bare "/" or a known landing path carries no conversation to return to.
    const path = u.pathname.replace(/\/+$/, '')
    if (!path || path === '/app' || path === '/new' || path === '/chat') return null
    return u.origin + u.pathname
  } catch {
    return null
  }
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n).trimEnd() + '…'
}
