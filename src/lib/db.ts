import Dexie, { type Table } from 'dexie'
import type { Platform, Prompt } from './types'

class DejaDB extends Dexie {
  prompts!: Table<Prompt, number>

  constructor() {
    // NOTE: the IndexedDB database is named 'deja'. This is an internal key users
    // never see. It was renamed from 'promptshelf' alongside the product rename;
    // any prompts captured under the old name in a pre-rename build are not
    // migrated (Dexie opens a fresh database under the new name). This is
    // acceptable while the extension is unpublished and only has local dev data.
    super('deja')
    this.version(1).stores({
      prompts: '++id, platform, createdAt, lastUsedAt',
    })
    // v2 (Phase 3) — ADDITIVE: add a multi-entry index on tags (`*tags`) so we
    // can query by tag. We do NOT index `pinned`: IndexedDB cannot index boolean
    // values, so a `pinned` index would be dead and misleading — pin ordering is
    // done in-memory instead. The `prompts` table is NOT dropped or recreated, so
    // existing rows are preserved untouched. Old rows simply have no `tags`/`pinned`
    // keys; the multi-entry index just omits them and code below treats them as []/false.
    this.version(2).stores({
      prompts: '++id, platform, createdAt, lastUsedAt, *tags',
    })
    // v3 — version bump only; no schema change vs v2. During development the v2
    // schema was edited in place (a `pinned` index was added, then removed —
    // booleans aren't indexable). Editing an already-applied version's schema
    // makes Dexie throw "schema was changed" on open for anyone who loaded the
    // intermediate build, which silently breaks ALL writes, capture included.
    // Bumping the version forces Dexie to run a clean upgrade and reconcile the
    // indexes. Data is preserved.
    this.version(3).stores({
      prompts: '++id, platform, createdAt, lastUsedAt, *tags',
    })
  }
}

export const db = new DejaDB()

export async function savePrompt(
  input: Omit<Prompt, 'id' | 'usageCount' | 'lastUsedAt'>,
): Promise<number> {
  const now = input.createdAt
  return db.prompts.add({ ...input, usageCount: 0, lastUsedAt: now })
}

/** Normalize prompt text for duplicate detection (whitespace + case). */
export function normalizePromptText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

/** True when two prompt bodies are the same after normalization. */
export function promptTextMatches(a: string, b: string): boolean {
  return normalizePromptText(a) === normalizePromptText(b)
}

/** Find a non-deleted prompt with the same platform + normalized text, if any. */
export async function findExistingPrompt(
  platform: Platform,
  text: string,
): Promise<Prompt | undefined> {
  const target = normalizePromptText(text)
  if (!target) return undefined
  const rows = await db.prompts.where('platform').equals(platform).toArray()
  return rows.find((p) => !p.deletedAt && normalizePromptText(p.text) === target)
}

// Default view excludes soft-deleted rows AND legacy "minor" (soft-capture)
// prompts, so the popup, resurface pool, and the library's default list stay
// tidy. Pass { includeMinor: true } to also return minor prompts — the library
// uses this to offer a "show filtered" view for rows from before skip-store,
// and the background includes them in resurface when the user opts to keep minors.
export async function listPrompts(opts: { includeMinor?: boolean } = {}): Promise<Prompt[]> {
  const all = await db.prompts.orderBy('createdAt').reverse().toArray()
  return all.filter((p) => !p.deletedAt && (opts.includeMinor || !p.minor))
}

// Bulk-replace the text of specific prompts — used by the settings "scan &
// redact existing library" action to retro-clean PII captured before redaction
// was on. One transaction so it's atomic.
export async function bulkUpdateText(updates: Array<{ id: number; text: string }>): Promise<void> {
  if (!updates.length) return
  await db.transaction('rw', db.prompts, async () => {
    for (const u of updates) await db.prompts.update(u.id, { text: u.text })
  })
}

// Promote a legacy minor (soft-capture) prompt to a normal one, or demote a
// normal prompt. Used by the library's "keep" affordance for rows saved under
// the old store-but-hide behavior.
export async function setMinor(id: number, minor: boolean): Promise<void> {
  await db.prompts.update(id, { minor })
}

export async function softDelete(id: number): Promise<void> {
  await db.prompts.update(id, { deletedAt: Date.now() })
}

export async function restore(id: number): Promise<void> {
  await db.prompts.update(id, { deletedAt: null })
}

// Permanent removal — used only to undo a just-captured prompt, where the
// row was never really wanted, so there's nothing to soft-delete.
export async function hardDelete(id: number): Promise<void> {
  await db.prompts.delete(id)
}

// Atomic increment via modify() (not get-then-update) so two near-simultaneous
// bumps of the same row — e.g. a fuzzy-duplicate capture racing a Library click
// — both land instead of one clobbering the other.
export async function touchUsage(id: number): Promise<void> {
  const now = Date.now()
  await db.prompts.where('id').equals(id).modify((p) => {
    p.usageCount = (p.usageCount ?? 0) + 1
    p.lastUsedAt = now
  })
}

// Tags ---------------------------------------------------------------
// Normalize: trim, lowercase, collapse internal whitespace, drop empties,
// dedupe. Keeps tags short and comparable so filtering is predictable.
function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function normalizeTags(raw: string[]): string[] {
  const out: string[] = []
  for (const t of raw) {
    const n = normalizeTag(t)
    if (n && !out.includes(n)) out.push(n)
  }
  return out
}

export async function setTags(id: number, tags: string[]): Promise<void> {
  await db.prompts.update(id, { tags: normalizeTags(tags) })
}

export async function addTag(id: number, tag: string): Promise<void> {
  const p = await db.prompts.get(id)
  if (!p) return
  await db.prompts.update(id, { tags: normalizeTags([...(p.tags ?? []), tag]) })
}

export async function removeTag(id: number, tag: string): Promise<void> {
  const p = await db.prompts.get(id)
  if (!p) return
  const target = normalizeTag(tag)
  await db.prompts.update(id, { tags: (p.tags ?? []).filter((t) => t !== target) })
}

// Pinning -------------------------------------------------------------
export async function togglePin(id: number): Promise<void> {
  const p = await db.prompts.get(id)
  if (!p) return
  await db.prompts.update(id, { pinned: !(p.pinned ?? false) })
}

// Bulk soft-delete — reuses the same soft-delete semantics as softDelete so
// the existing undo affordance (restore) works on each row in the batch.
export async function bulkSoftDelete(ids: number[]): Promise<void> {
  const now = Date.now()
  await db.prompts.where('id').anyOf(ids).modify({ deletedAt: now })
}

export async function bulkRestore(ids: number[]): Promise<void> {
  await db.prompts.where('id').anyOf(ids).modify({ deletedAt: null })
}

export async function exportAll(): Promise<Prompt[]> {
  return db.prompts.toArray()
}

// Import ---------------------------------------------------------------
// Round-trips with exportAll()'s JSON. We treat the file as untrusted: every
// row is validated and coalesced, malformed rows are skipped, and incoming
// rows become NEW rows (we drop/regenerate `id` so an imported id can never
// collide with or overwrite an existing key).

/** A stable content key for dedupe. Two rows with the same platform, createdAt
 *  and text are considered the same captured prompt — re-importing the same
 *  file (or overlapping files) won't pile up duplicates. */
export function contentKey(p: Pick<Prompt, 'platform' | 'createdAt' | 'text'>): string {
  return `${p.platform}|${p.createdAt}|${p.text}`
}

const PLATFORMS = new Set<Platform>(['chatgpt', 'claude', 'gemini', 'deepseek', 'grok'])

/** Validate + coalesce one untrusted row into a clean Prompt (sans id), or
 *  return null if it's too malformed to keep. Pure — unit-testable. */
export function normalizeImportedRow(raw: unknown): Omit<Prompt, 'id'> | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const text = typeof r.text === 'string' ? r.text : null
  if (!text || text.trim().length < 2) return null
  if (typeof r.platform !== 'string' || !PLATFORMS.has(r.platform as Platform)) return null
  const platform = r.platform as Platform
  const createdAt =
    typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : Date.now()
  const usageCount =
    typeof r.usageCount === 'number' && Number.isFinite(r.usageCount) && r.usageCount >= 0
      ? Math.floor(r.usageCount)
      : 0
  const lastUsedAt =
    typeof r.lastUsedAt === 'number' && Number.isFinite(r.lastUsedAt) ? r.lastUsedAt : createdAt
  const url = typeof r.url === 'string' ? r.url : ''
  const tags = Array.isArray(r.tags)
    ? normalizeTags(r.tags.filter((t): t is string => typeof t === 'string'))
    : []
  const pinned = r.pinned === true
  const minor = r.minor === true
  // Preserve tombstones: a soft-deleted/deleted row must stay deleted on import,
  // never resurrected. Keep deletedAt only when it's a real (number) tombstone.
  const deletedAt = typeof r.deletedAt === 'number' ? r.deletedAt : null
  return { text, platform, url, createdAt, usageCount, lastUsedAt, tags, pinned, minor, deletedAt }
}

export interface ImportResult {
  imported: number
  skipped: number
}

/** Import rows parsed from an export JSON. Validates/coalesces each row,
 *  skips malformed ones, dedupes against existing rows AND within the batch by
 *  content key, preserves tombstones, and inserts survivors as new rows. */
export async function importPrompts(rows: unknown): Promise<ImportResult> {
  if (!Array.isArray(rows)) return { imported: 0, skipped: 0 }

  // Existing content keys so a re-import doesn't duplicate. We include
  // soft-deleted rows here too, so a tombstone in the file won't re-add a
  // prompt the user already deleted.
  const existing = await db.prompts.toArray()
  const seen = new Set(existing.map((p) => contentKey(p)))

  const toAdd: Array<Omit<Prompt, 'id'>> = []
  let skipped = 0
  for (const raw of rows) {
    const row = normalizeImportedRow(raw)
    if (!row) {
      skipped += 1
      continue
    }
    const key = contentKey(row)
    if (seen.has(key)) {
      skipped += 1
      continue
    }
    seen.add(key)
    toAdd.push(row)
  }

  if (toAdd.length) await db.prompts.bulkAdd(toAdd)
  return { imported: toAdd.length, skipped }
}

// Delete finalize -----------------------------------------------------
// Soft-delete is only for a short Undo window in the library. After that the
// row must leave the disk — forever-tombstones with no trash UI are a privacy
// footgun. Library clears on its own timer; this sweep catches the case where
// the options page closed mid-window.
export const DELETE_UNDO_MS = 6_000
/** Safety margin past the Undo toast — used by background/options sweeps. */
export const DELETE_GRACE_MS = 60_000

export async function bulkHardDelete(ids: number[]): Promise<void> {
  if (!ids.length) return
  await db.prompts.where('id').anyOf(ids).delete()
}

/** Erase a row only if it is still soft-deleted (Undo was not used). */
export async function finalizeSoftDelete(id: number): Promise<void> {
  const p = await db.prompts.get(id)
  if (p && p.deletedAt != null) await db.prompts.delete(id)
}

/** Erase many rows only where each is still soft-deleted. */
export async function finalizeSoftDeletes(ids: number[]): Promise<void> {
  if (!ids.length) return
  await db.transaction('rw', db.prompts, async () => {
    for (const id of ids) {
      const p = await db.prompts.get(id)
      if (p && p.deletedAt != null) await db.prompts.delete(id)
    }
  })
}

/** Hard-delete soft-deleted rows older than `graceMs`. Returns how many. */
export async function purgeExpiredDeleted(graceMs = DELETE_GRACE_MS): Promise<number> {
  const cutoff = Date.now() - graceMs
  return db.prompts
    .filter((p) => typeof p.deletedAt === 'number' && (p.deletedAt as number) <= cutoff)
    .delete()
}

// Clear all ------------------------------------------------------------
// Hard wipe of the entire prompts table. This is the ONE place a hard delete of
// real prompts is acceptable, because it is an explicit, user-initiated,
// confirmed destructive action in settings — not the normal soft-delete path.
export async function clearAllData(): Promise<void> {
  await db.prompts.clear()
}
