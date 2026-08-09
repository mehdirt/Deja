// Shared “restore from a backup file” path for Settings + empty Library.
import { importPrompts } from './db'
import { trimLibraryToCap } from './libraryCap'

export type RestoreBackupResult =
  | { ok: true; message: string; imported: number; skipped: number }
  | { ok: false; message: string }

export async function restoreBackupFromText(
  text: string,
  libraryCap: number,
): Promise<RestoreBackupResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {
      ok: false,
      message: "Couldn't read that file. It should be a backup from Deja.",
    }
  }

  // A Deja backup is a JSON array of prompts. Anything else parses fine but
  // isn't ours — say so plainly instead of reporting "imported 0".
  if (!Array.isArray(parsed)) {
    return { ok: false, message: "That file isn't a Deja backup." }
  }

  const res = await importPrompts(parsed)
  let trimNote = ''
  if (libraryCap > 0 && res.imported > 0) {
    const trimmed = await trimLibraryToCap(libraryCap)
    if (trimmed > 0) {
      trimNote =
        trimmed === 1
          ? ' Removed 1 rarely used prompt to stay under your limit.'
          : ` Removed ${trimmed} rarely used prompts to stay under your limit.`
    }
  }

  return {
    ok: true,
    imported: res.imported,
    skipped: res.skipped,
    message: `Added ${res.imported}. Skipped ${res.skipped} you already had.${trimNote}`,
  }
}
