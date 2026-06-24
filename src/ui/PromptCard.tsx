import { forwardRef, useState } from 'react'
import type { Prompt } from '@/lib/types'
import { PLATFORM_COLOR, PLATFORM_LABEL } from '@/lib/types'
import { relativeTime, truncate } from '@/lib/format'

interface Props {
  prompt: Prompt
  onCopy: (p: Prompt) => void
  onDelete?: (p: Prompt) => void
  compact?: boolean
  selected?: boolean
}

export const PromptCard = forwardRef<HTMLDivElement, Props>(function PromptCard(
  { prompt, onCopy, onDelete, compact, selected },
  ref,
) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    onCopy(prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div
      ref={ref}
      className={`ps-card flex flex-col gap-2 p-4 transition-shadow ${
        selected ? 'ring-2 ring-accent' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="ps-chip font-mono">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: PLATFORM_COLOR[prompt.platform] }}
            aria-hidden="true"
          />
          {PLATFORM_LABEL[prompt.platform]}
        </span>
        <span className="font-mono text-xs text-ink-faint">
          {relativeTime(prompt.createdAt)}
          {prompt.usageCount > 0 && ` · used ${prompt.usageCount}×`}
        </span>
      </div>

      <p className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-ink">
        {truncate(prompt.text, compact ? 160 : 600)}
      </p>

      <div className="flex items-center justify-end gap-1 pt-1">
        {onDelete && (
          <button
            onClick={() => onDelete(prompt)}
            aria-label="Delete prompt"
            className="ps-btn ps-btn-ghost px-2 py-1 text-xs hover:text-danger"
          >
            Delete
          </button>
        )}
        <button
          onClick={handleCopy}
          aria-label="Copy prompt to clipboard"
          aria-live="polite"
          className="ps-btn ps-btn-primary min-w-[68px] px-2 py-1 text-xs"
        >
          {copied ? 'copied ✓' : 'Copy'}
        </button>
      </div>
    </div>
  )
})
