import { INTENTS, type Intent } from '@/lib/prefs'

// "What do you mostly use AI for?" — the one question the welcome screen asks.
//
// It is cosmetic by design: the answer only decides which hand-written examples
// show while the library is still empty. Nothing is recorded about the person,
// nothing is sent anywhere, and skipping is a first-class choice rather than a
// way to end up with a worse page (see startersFor — an empty pick shows
// everything). A setup question that changes nothing important is the only kind
// worth asking someone in their first thirty seconds.

const LABELS: Record<Intent, string> = {
  email: 'Writing emails ✉️',
  planning: 'Planning things',
  learning: 'Learning something new',
  everyday: 'Everyday questions',
}

export function IntentChips({
  selected,
  onToggle,
  onSkip,
}: {
  selected: readonly string[]
  onToggle: (intent: Intent) => void
  onSkip?: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {INTENTS.map((intent) => {
          const on = selected.includes(intent)
          return (
            <button
              key={intent}
              onClick={() => onToggle(intent)}
              aria-pressed={on}
              className={`dj-chip transition-colors ${
                on ? 'border-accent bg-accent-soft font-semibold text-accent' : 'hover:bg-sunk'
              }`}
            >
              {LABELS[intent]}
            </button>
          )
        })}
      </div>
      {onSkip && (
        <div className="flex items-center gap-3">
          <button onClick={onSkip} className="dj-btn px-3 py-1.5 text-sm">
            Skip for now
          </button>
          <span className="dj-meta">You can change this later — nothing depends on it.</span>
        </div>
      )}
    </div>
  )
}
