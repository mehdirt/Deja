import { forwardRef, useState } from 'react'
import type { Prompt } from '@/lib/types'
import { PLATFORM_COLOR, PLATFORM_LABEL } from '@/lib/types'
import { relativeTime, truncate } from '@/lib/format'
import { PinIcon } from '@/ui/PinIcon'

interface Props {
  prompt: Prompt
  onCopy: (p: Prompt) => void
  onDelete?: (p: Prompt) => void
  onTogglePin?: (p: Prompt) => void
  onAddTag?: (p: Prompt, tag: string) => void
  onRemoveTag?: (p: Prompt, tag: string) => void
  onTagClick?: (tag: string) => void
  activeTags?: string[]
  // Selection mode (bulk). When `selectable`, a checkbox replaces nothing else;
  // when checked, the card is part of the current bulk selection.
  selectable?: boolean
  checked?: boolean
  onToggleCheck?: (p: Prompt) => void
  compact?: boolean
  selected?: boolean
}

export const PromptCard = forwardRef<HTMLDivElement, Props>(function PromptCard(
  {
    prompt,
    onCopy,
    onDelete,
    onTogglePin,
    onAddTag,
    onRemoveTag,
    onTagClick,
    activeTags = [],
    selectable,
    checked,
    onToggleCheck,
    compact,
    selected,
  },
  ref,
) {
  const [copied, setCopied] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const tags = prompt.tags ?? []
  const pinned = prompt.pinned ?? false

  const handleCopy = () => {
    onCopy(prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  const commitTag = () => {
    const t = draft.trim()
    if (t && onAddTag) onAddTag(prompt, t)
    setDraft('')
    setAdding(false)
  }

  return (
    <div
      ref={ref}
      className={`ps-card flex flex-col gap-2 p-4 transition-shadow ${
        selected ? 'ring-2 ring-accent' : ''
      } ${checked ? 'ring-2 ring-accent/60' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          {selectable && (
            <input
              type="checkbox"
              checked={!!checked}
              onChange={() => onToggleCheck?.(prompt)}
              aria-label={`Select prompt: "${truncate(prompt.text, 40)}"`}
              className="h-3.5 w-3.5 accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          )}
          <span className="ps-chip font-mono">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: PLATFORM_COLOR[prompt.platform] }}
              aria-hidden="true"
            />
            {PLATFORM_LABEL[prompt.platform]}
          </span>
        </span>
        <span className="flex items-center gap-2 font-mono text-xs text-ink-faint">
          {pinned && <PinIcon filled className="text-accent" />}
          {relativeTime(prompt.createdAt)}
          {prompt.usageCount > 0 && ` · used ${prompt.usageCount}×`}
        </span>
      </div>

      <p className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-ink">
        {truncate(prompt.text, compact ? 160 : 600)}
      </p>

      {(tags.length > 0 || (!compact && onAddTag)) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => {
            const active = activeTags.includes(t)
            return (
              <span key={t} className={`ps-tag ${active ? 'ps-tag-active' : ''}`}>
                <button
                  onClick={() => onTagClick?.(t)}
                  aria-label={`Filter by tag ${t}`}
                  title={t}
                  className="ps-tag-label bg-transparent"
                >
                  {t}
                </button>
                {onRemoveTag && (
                  <button
                    onClick={() => onRemoveTag(prompt, t)}
                    aria-label={`Remove tag ${t}`}
                    className="text-ink-faint hover:text-danger"
                  >
                    ×
                  </button>
                )}
              </span>
            )
          })}
          {!compact && onAddTag && (
            adding ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitTag}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitTag()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setDraft('')
                    setAdding(false)
                  }
                }}
                placeholder="tag…"
                aria-label="Add a tag"
                className="ps-input w-24 px-2 py-0.5 font-mono text-[11px]"
              />
            ) : (
              <button
                onClick={() => setAdding(true)}
                aria-label="Add a tag"
                className="ps-tag text-ink-faint hover:text-ink"
              >
                + tag
              </button>
            )
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-1 pt-1">
        {onTogglePin && (
          <button
            onClick={() => onTogglePin(prompt)}
            aria-label={pinned ? 'Unpin prompt' : 'Pin prompt'}
            aria-pressed={pinned}
            className="ps-btn ps-btn-ghost px-2 py-1 text-xs"
          >
            {pinned ? 'unpin' : 'pin'}
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(prompt)}
            aria-label="Delete prompt"
            className="ps-btn ps-btn-ghost px-2 py-1 text-xs hover:text-danger"
          >
            delete
          </button>
        )}
        <button
          onClick={handleCopy}
          aria-label="Copy prompt to clipboard"
          aria-live="polite"
          className="ps-btn ps-btn-primary min-w-[68px] px-2 py-1 text-xs"
        >
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>
    </div>
  )
})
