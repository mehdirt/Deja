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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 pb-10 pt-5">
      <header className="flex items-center justify-between gap-4 pb-1">
        <Logo size={28} />
        <nav className="flex items-center gap-1 sm:gap-0" aria-label="Sections">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
              aria-current={view === n.key ? 'page' : undefined}
              className={`rounded-btn px-2.5 py-1.5 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:ml-3 sm:px-0 sm:py-0 ${
                view === n.key
                  ? 'text-accent sm:underline sm:decoration-accent/40 sm:underline-offset-[6px]'
                  : 'text-ink-soft hover:bg-sunk hover:text-ink sm:hover:bg-transparent sm:hover:underline sm:hover:decoration-line sm:hover:underline-offset-[6px]'
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </header>

      {view === 'welcome' && (
        <div key="welcome" className="dj-enter">
          <Welcome onDone={() => setView(priorView)} />
        </div>
      )}
      {view === 'library' && (
        <div key="library" className="dj-enter">
          <Library onOpenSettings={() => setView('settings')} />
        </div>
      )}
      {view === 'settings' && (
        <div key="settings" className="dj-enter">
          <Settings
            onShowWelcome={() => {
              setPriorView('settings')
              setView('welcome')
            }}
          />
        </div>
      )}
      {view === 'privacy' && (
        <div key="privacy" className="dj-enter">
          <Privacy />
        </div>
      )}
    </div>
  )
}
