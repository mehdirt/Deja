// Decide whether a stored prompt should be rendered as markdown in the library.
// Ordinary prose stays plain `whitespace-pre-wrap` so stray * or _ don't flip
// into accidental formatting. Fences and clear markdown structure opt in.

const FENCE = /```[\w+-]*\n[\s\S]*?```/
const HEADING = /(?:^|\n)#{1,3}\s+\S/
const LIST = /(?:^|\n)(?:[-*+]|\d+\.)\s+\S/
const INLINE_CODE = /`[^`\n]+`/
const EMPHASIS = /(?:\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/
const BLOCKQUOTE = /(?:^|\n)>\s+\S/
const LINK = /\[[^\]]+\]\(https?:\/\/[^)]+\)/

/** True when rendering as markdown will help more than hurt. Pure. */
export function looksLikeMarkdown(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (FENCE.test(t)) return true

  let signals = 0
  if (HEADING.test(t)) signals++
  if (LIST.test(t)) signals++
  if (INLINE_CODE.test(t)) signals++
  if (EMPHASIS.test(t)) signals++
  if (BLOCKQUOTE.test(t)) signals++
  if (LINK.test(t)) signals++
  return signals >= 2
}
