import { useState } from 'react'
import { Logo } from '@/ui/Logo'
import { Library } from './Library'
import { Settings } from './Settings'
import { Privacy } from './Privacy'

type View = 'library' | 'settings' | 'privacy'

const NAV: Array<{ key: View; label: string }> = [
  { key: 'library', label: 'library' },
  { key: 'settings', label: 'settings' },
  { key: 'privacy', label: 'privacy' },
]

// Lightweight top-level shell for the options app. Library is the default
// view; settings and privacy are reachable from a calm, lowercase header nav.
// No router dependency — three views, one bit of state.
export function App() {
  const [view, setView] = useState<View>('library')

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <header className="flex items-center justify-between border-b border-line pb-3">
        <Logo size={26} />
        <nav className="flex items-center gap-1 font-mono text-xs" aria-label="Sections">
          {NAV.map((n, i) => (
            <span key={n.key} className="inline-flex items-center">
              {i > 0 && <span className="px-1 text-ink-faint" aria-hidden>·</span>}
              <button
                onClick={() => setView(n.key)}
                aria-current={view === n.key ? 'page' : undefined}
                className={`rounded-btn px-2 py-1 transition-colors hover:bg-sunk ${
                  view === n.key ? 'text-accent' : 'text-ink-soft'
                }`}
              >
                {n.label}
              </button>
            </span>
          ))}
        </nav>
      </header>

      {view === 'library' && <Library />}
      {view === 'settings' && <Settings />}
      {view === 'privacy' && <Privacy />}
    </div>
  )
}
