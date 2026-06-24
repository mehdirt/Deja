import type { Platform } from './types'

// Capture health — our defense against the worst failure mode: a selector
// silently breaking so the user keeps typing into a shelf that records
// nothing. We persist a per-platform "are we still integrated with this
// site" signal in chrome.storage.local (not Dexie — it's tiny, and both
// content scripts and the options UI can read/write it directly).
//
// Principle #5: fail loud to *us*, silent to *them*. Nothing here ever
// leaves the machine; this is local introspection, not telemetry.

export interface PlatformHealth {
  /** Did we locate the prompt input on the last check? */
  ok: boolean
  /** When we last ran a check (epoch ms). */
  lastCheckedAt: number
  /** When capture was last confirmed working — selector found OR a real
   *  capture succeeded. Null until the first healthy moment. */
  lastHealthyAt: number | null
}

export type CaptureHealth = Partial<Record<Platform, PlatformHealth>>

const KEY = 'captureHealth'

export async function readHealth(): Promise<CaptureHealth> {
  try {
    const res = await chrome.storage.local.get(KEY)
    return (res?.[KEY] as CaptureHealth) ?? {}
  } catch {
    return {}
  }
}

export async function writeHealth(platform: Platform, ok: boolean, now = Date.now()): Promise<void> {
  try {
    const current = await readHealth()
    const prev = current[platform]
    current[platform] = {
      ok,
      lastCheckedAt: now,
      lastHealthyAt: ok ? now : (prev?.lastHealthyAt ?? null),
    }
    await chrome.storage.local.set({ [KEY]: current })
  } catch {
    /* storage unavailable (orphaned context) — never throw into the host page */
  }
}

/** Subscribe to health changes so an open library view updates live. */
export function onHealthChange(cb: (health: CaptureHealth) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === 'local' && changes[KEY]) cb((changes[KEY].newValue as CaptureHealth) ?? {})
  }
  try {
    chrome.storage.onChanged.addListener(listener)
  } catch {
    return () => {}
  }
  return () => {
    try {
      chrome.storage.onChanged.removeListener(listener)
    } catch {
      /* ignore */
    }
  }
}
