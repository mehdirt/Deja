// Local PII vault — maps numbered placeholders back to the original values
// they replaced, so "Fill in" can offer them again without keeping raw PII in
// the prompt library / backups / exports.
//
// Lives in its own chrome.storage.local key (NOT inside prefs or Dexie prompts).
// Nothing here is included in a downloaded backup. Clearing the vault only
// forgets the map; saved prompts keep their [email_1] placeholders.

const KEY = 'piiVault'
/** Soft ceiling so a busy library can't grow an unbounded secret map. */
export const VAULT_MAX_ENTRIES = 200

export type PiiVault = Record<string, string>

function coerceVault(raw: unknown): PiiVault {
  if (!raw || typeof raw !== 'object') return {}
  const out: PiiVault = {}
  for (const [token, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof token !== 'string' || typeof value !== 'string') continue
    if (!token.startsWith('[') || !token.endsWith(']')) continue
    if (!value.trim()) continue
    out[token] = value
  }
  return out
}

export async function readPiiVault(): Promise<PiiVault> {
  try {
    const res = await chrome.storage.local.get(KEY)
    return coerceVault(res?.[KEY])
  } catch {
    return {}
  }
}

async function writeVault(vault: PiiVault): Promise<void> {
  try {
    await chrome.storage.local.set({ [KEY]: vault })
  } catch {
    /* storage unavailable — never throw into the host page */
  }
}

/** Merge new token→value mappings; drop oldest entries if over the soft cap. */
export async function mergePiiVault(mappings: PiiVault): Promise<PiiVault> {
  const entries = Object.entries(mappings).filter(([, v]) => typeof v === 'string' && v.trim())
  if (entries.length === 0) return readPiiVault()

  const current = await readPiiVault()
  // Re-insert updated keys at the end so "oldest" eviction stays meaningful.
  for (const [token, value] of entries) {
    delete current[token]
    current[token] = value
  }
  const keys = Object.keys(current)
  if (keys.length > VAULT_MAX_ENTRIES) {
    const drop = keys.length - VAULT_MAX_ENTRIES
    for (let i = 0; i < drop; i++) delete current[keys[i]]
  }
  await writeVault(current)
  return current
}

export async function clearPiiVault(): Promise<void> {
  await writeVault({})
}

/** Prefill map for template blanks: blank name ("email_1") → remembered value. */
export function vaultValuesForPlaceholders(
  vault: PiiVault,
  tokens: string[],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const token of tokens) {
    const value = vault[token]
    if (!value) continue
    // "[email_1]" → name "email_1"
    const name = token.slice(1, -1)
    if (name) out[name] = value
  }
  return out
}

export function onPiiVaultChange(cb: (vault: PiiVault) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[KEY]) cb(coerceVault(changes[KEY].newValue))
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
