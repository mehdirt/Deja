import { useState } from 'react'
import { Logo } from '@/ui/Logo'
import { Library } from './Library'
import { Settings } from './Settings'
import { Privacy } from './Privacy'
import { Welcome } from './Welcome'

type View = 'library' | 'settings' | 'privacy' | 'welcome'

const NAV: Array<{ key: Exclude<View, 'welcome'>; label: string }> = [
  { key: 'library', label: 'My prompts' },
  { key: 'settings', label: 'Settings' },
  { key: 'privacy', label: 'Privacy' },
]

// The post-install welcome is a view here rather than its own page: it needs
// the same shell and styles, and folding it in keeps the extension to two HTML
// entry points. The background worker opens this page with ?welcome=1 on
// install.
function initialView(): View {
  try {
    return new URLSearchParams(window.location.search).has('welcome') ? 'welcome' : 'library'
  } catch {
    return 'library'
  }
}

// Lightweight top-level shell for the options app. Library is the default
// view; settings and privacy are reachable from a calm header nav.
// No router dependency — a handful of views, one bit of state.
export function App() {
  const [view, setView] = useState<View>(initialView)
  // Where to return once Welcome is dismissed — the view it was opened from,
  // not always 'library' (e.g. reopened from Settings via onShowWelcome).
  const [priorView, setPriorView] = useState<Exclude<View, 'welcome'>>('library')

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <header className="flex items-center justify-between border-b border-line pb-3">
        <Logo size={26} />
        <nav className="flex items-center gap-1 text-xs font-medium" aria-label="Sections">
          {NAV.map((n, i) => (
            <span key={n.key} className="inline-flex items-center">
              {i > 0 && (
                <span className="px-1 text-ink-faint" aria-hidden>
                  ·
                </span>
              )}
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

      {view === 'welcome' && <Welcome onDone={() => setView(priorView)} />}
      {view === 'library' && <Library onOpenSettings={() => setView('settings')} />}
      {view === 'settings' && (
        <Settings
          onShowWelcome={() => {
            setPriorView('settings')
            setView('welcome')
          }}
        />
      )}
      {view === 'privacy' && <Privacy />}
    </div>
  )
}
