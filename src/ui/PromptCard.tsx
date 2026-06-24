import type { Prompt } from '@/lib/types'
import { relativeTime, truncate } from '@/lib/format'

interface Props {
  prompt: Prompt
  onCopy: (p: Prompt) => void
  onDelete?: (p: Prompt) => void
  compact?: boolean
}

const PLATFORM_LABEL: Record<Prompt['platform'], string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
}

export function PromptCard({ prompt, onCopy, onDelete, compact }: Props) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="chip">{PLATFORM_LABEL[prompt.platform]}</span>
        <span className="text-xs text-ink-800/60 dark:text-ink-50/60">
          {relativeTime(prompt.createdAt)}
        </span>
      </div>
      <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
        {truncate(prompt.text, compact ? 160 : 600)}
      </p>
      <div className="flex items-center justify-end gap-2 pt-1">
        {onDelete && (
          <button
            onClick={() => onDelete(prompt)}
            className="text-xs text-ink-800/60 hover:text-red-600 dark:text-ink-50/60"
          >
            Delete
          </button>
        )}
        <button
          onClick={() => onCopy(prompt)}
          className="text-xs px-2 py-1 rounded bg-accent text-white hover:opacity-90"
        >
          Copy
        </button>
      </div>
    </div>
  )
}
