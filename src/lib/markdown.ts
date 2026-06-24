// Markdown export — pure helpers, no DOM / no DB. Turns a list of prompts into
// one readable .md document. Each prompt becomes a section with a heading
// (platform + human date), an optional tags line, and the text in a fenced
// block so multi-line / code prompts survive the round trip to a human reader.
//
// NOTE on scope: markdown is the human-readable export, so it intentionally
// OMITS soft-deleted rows (tombstones). The JSON export, by contrast,
// intentionally INCLUDES tombstones so a re-import won't resurrect deletions.

import { PLATFORM_LABEL, type Prompt } from './types'

/** Choose a fence longer than the longest backtick run in the text. CommonMark
 *  only closes a fenced block on a fence of length >= the opening one, so a
 *  prompt that itself contains ``` can't terminate its own block early. */
function fenceFor(text: string): string {
  const run = Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length))
  return '`'.repeat(Math.max(3, run + 1))
}

/** Render one prompt as a markdown section. `label` is the human platform
 *  label and `dateStr` the pre-formatted human date. */
export function promptToMarkdownSection(p: Prompt, label: string, dateStr: string): string {
  const fence = fenceFor(p.text)
  const tags = (p.tags ?? []).length ? `\n_tags: ${(p.tags ?? []).join(', ')}_\n` : ''
  return `## ${label} — ${dateStr}\n${tags}\n${fence}\n${p.text}\n${fence}\n`
}

/** Default human date formatter for the markdown export. */
function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Build the full markdown document for a list of prompts. Soft-deleted rows
 *  are filtered out (see the note above). */
export function buildMarkdown(prompts: Prompt[]): string {
  const live = prompts.filter((p) => !p.deletedAt)
  const sections = live.map((p) =>
    promptToMarkdownSection(p, PLATFORM_LABEL[p.platform], formatDate(p.createdAt)),
  )
  const count = `${live.length} ${live.length === 1 ? 'prompt' : 'prompts'} · stored locally`
  return `# deja export\n\n_${count}_\n\n${sections.join('\n')}`
}
