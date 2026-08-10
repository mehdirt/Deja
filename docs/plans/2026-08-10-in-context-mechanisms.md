# In-context mechanisms (M1–M7) — implementation plan

**Date:** 2026-08-10
**Status:** Phases A–G built and reviewed (2026-08-10/11). Phase H: H0 and the copy-only parts done; screenshots and the demo video still need a human with a browser.
**Interactive reference:** the evaluation demo built 2026-08-10 (working mock of all seven, Deja tokens, both themes). Treat it as the visual/UX target, not as code to port — it is vanilla JS against a fake library.

---

## Why this exists

Grammarly's mechanism was never grammar. It was **placement**: it lives inside the box you are typing in, quietly, all the time. Deja is the opposite shape today — the library is a place you visit, and the one in-page moment (`resurface.ts`) only fires when the similarity threshold is crossed. On an ordinary day a user sees nothing at all, which is exactly the failure mode `ROADMAP.md` Phase 6 already named: *"nothing visible happening and the extension being forgotten."*

These seven mechanisms give Deja a steady in-page presence without turning it into a nag.

**Non-negotiable framing:** every one of these is **additive**. The popup stays the quick glance and the off switch. The library stays home (search, tags, favourites, backups, settings). If a user turned all seven off, Deja must behave exactly as it does today. Nothing here moves where prompts live or changes how they are saved.

---

## The seven

| ID | Name | One line |
| --- | --- | --- |
| M1 | A quiet dot that's always there | Small Deja button anchored to the composer; faint when idle, lit when matches exist; opens a mini panel with search + insert. |
| M2 | Type `//` to reach anything saved | Inline picker at the caret, keyboard-driven, fills `{blanks}` before inserting. |
| M3 | Turn it off here, from the dot | Never-save-here and pause-for-an-hour in the panel footer, with undo. |
| M4 | Suggestions learn from what you use | Using a suggestion raises its standing; dismissing lowers it. Local, no scoring of the person. |
| M5 | When saving breaks, offer a hand-save | Selector broken → dot goes amber → "Save this one by hand". |
| M6 | Ask what they use AI for | Skippable intent chips on the welcome view; changes which starters an empty library shows. |
| M7 | Show it instead of describing it | Auto-playing miniature of the resurface moment on the welcome view (static with a "Play the demo" button under reduced motion). |

---

## Constraints this plan must honor

Drawn from `CLAUDE.md`, `DESIGN.md`, and `ROADMAP.md` — violate any of these and the work is wrong even if it functions.

1. **Never block the host page.** Content scripts fail silently. Every `chrome.*` call wrapped; orphaned-context guard (`if (!chrome.runtime?.id) return`) before every `sendMessage`.
2. **Latency budget.** Enter → stored under 100 ms. The dot and picker must add **zero** synchronous work to the capture hot path. All gating reads go through the existing sync snapshot (`captureGate.ts`).
3. **Local-first.** No network, no telemetry. M4's learning signal never leaves the machine.
4. **Plain language.** Every user-visible string checked against the `DESIGN.md` voice table before it ships. "Never save from…" not "blocklist". "Save this one by hand" not "manual capture".
5. **MV3 workers are short-lived.** No state in background module scope that matters across wakes — except caches that are safe to lose (see the pool cache below).
6. **Capture only the prompt text.** None of this reads AI responses.
7. **Everyday users, not engineers.** No mechanism may require understanding a regex, a JSON file, or the word "selector".

---

## Phase A — Foundations (build first, ship nothing user-visible)

M1, M2, M3 and M5 all need the same three things that do not exist yet: an anchored in-page surface richer than a tooltip, the ability for a content script to search the library, and the ability to write one prompt on demand. Build these once.

### A1. Shared overlay theme — `src/content/shared/overlayTheme.ts` (new)

**Problem it solves.** `resurface.ts` and `toast.ts` each hardcode the `--dj-*` palette inside their Shadow DOM (`:host{all:initial}` blocks CSS variable inheritance — see the comment at `src/content/shared/resurface.ts:149`). Adding four more overlays means six copies of the palette drifting apart, and the user's requirement is explicitly *"synced UI in both dark/light mode"*.

**Shape.** One module exporting the palette as a CSS string plus the shared primitives:

```ts
/** The --dj-* palette, inlined for Shadow DOM (light + dark). Single source
 *  for every in-page overlay. Mirrors src/styles/globals.css — when tokens
 *  change there, change them here in the same commit. */
export const OVERLAY_TOKENS: string   // :host{--dj-bg:…} + @media (prefers-color-scheme: dark){:host{…}}
export const OVERLAY_BASE: string     // card, button, focus-ring, scrollbar, reduced-motion primitives
export function createOverlayHost(label: string): { host: HTMLDivElement; shadow: ShadowRoot }
```

Key change vs today: declare the tokens **on `:host` as custom properties** rather than hardcoding hexes per rule. `:host{all:initial}` blocks *inheritance* from the page, but properties declared on `:host` itself cascade into the shadow tree normally. That means one dark-mode media query per overlay instead of one per rule, and dark mode can never be half-applied.

**Migration.** Refactor `resurface.ts` and `toast.ts` onto it in the same phase. Their rendered appearance must not change — this is a pure de-duplication. Verify with a before/after screenshot pair on one site in each theme.

**Shadow roots are `mode: 'closed'` from here on.** Today's overlays use `attachShadow({ mode: 'open' })`, which means any script running in the host page can reach the rendered content through `element.shadowRoot`. That was a narrow leak while the only overlay content was a prompt already textually close to what the user had just typed. It stops being narrow the moment M1 and M2 render *arbitrary rows of the saved library* into the page: an empty-query panel is a list of the user's most-used prompts, and the picker searches the whole library. `createOverlayHost` therefore returns a **closed** root, and the migration flips `resurface.ts` and `toast.ts` over with it — there is no reason any of the six should be page-readable.

Closed roots cost us nothing we use (we hold our own element references) and cost a little at debug time: `document.querySelector('div').shadowRoot` returns `null` in DevTools. Note that in the module header so the next person doesn't think it is broken.

### A1b. Trusted-event gating for the new trigger paths

A closed root stops the page *reading* our surfaces. It does not stop the page *driving* them: a hostile script can `dispatchEvent` a synthetic `input` carrying `//` or a synthetic `click` on the dot, and then read whatever the extension inserts back into the composer. So the two paths that **open a library-reading surface** additionally require a real user:

```ts
// Only a genuine user gesture may open a surface that reads the library.
// Capture is deliberately NOT gated this way — a site's own framework can
// legitimately emit synthetic input events, and refusing those would mean
// silently not saving someone's prompt. Failing closed is fine for the
// picker (nothing opens; the dot is still there) and unacceptable for capture.
if (!event.isTrusted) return
```

Applies to: the `//` trigger in `picker.ts` and the dot's click handler in `presence.ts`. It does **not** apply to `capture.ts`, `resurface.ts`'s similarity query, or the health probe.

**Threat model, stated once so it survives review:** the content script lives inside a page we do not trust. The three exposures worth naming are (1) a page script reading our overlay content — mitigated by closed roots; (2) a page script driving our surfaces to make the extension type library content into a field it can read — mitigated by the `isTrusted` gate; (3) a page script forging one of our runtime messages — *not* newly introduced here (the existing `PROMPT_CAPTURED` handler already trusts its content-script sender and ignores `_sender`), unchanged by this work, and worth a separate look rather than a rushed patch inside this plan.

**Type/font rules carried over (do not "fix" these):**
- Overlays use `font: 13px/1.4 system-ui, …` — the **system UI stack**, deliberately, so an overlay on chatgpt.com reads as part of that page. Figtree is for extension pages only.
- Mono (`ui-monospace`) only for `{blank}` tokens, `[email_1]` placeholders, hostnames, and the literal `//` key hint.
- Radii: 10px for overlay cards (matches the existing tooltip), 8px for rows, 6px for icon buttons. The 16px/11px pair from `DESIGN.md` is for extension pages; overlays sit tighter on purpose.
- Shadow: `0 8px 28px rgba(0,0,0,.18)`, dark `.4`.
- Focus: `outline:2px solid var(--dj-accent); outline-offset:1px` on every interactive element.
- Motion: `.14s ease-out` enter, wrapped in `@media (prefers-reduced-motion: reduce){animation:none}`.

### A2. Anchoring kit — `src/content/shared/anchor.ts` (new)

Extract the positioning logic currently inline in `resurface.ts` (`reposition`, the scroll/resize throttle at `REPOSITION_THROTTLE_MS`) into a reusable helper, because four surfaces now need it and they must not each re-implement viewport clamping.

```ts
export type AnchorSide = 'above' | 'below' | 'right-outside' | 'inside-bottom-right'
export function anchorTo(card: HTMLElement, rect: DOMRect, side: AnchorSide, gap = 8): void
export function watchAnchor(getRect: () => DOMRect | null, onMove: () => void): () => void
```

Rules: clamp to viewport with an 8px margin; flip `above → below` when there is no room; never render off-screen; throttle scroll/resize at 100 ms as today.

### A3. New runtime messages — `src/lib/types.ts`

Content scripts cannot read the extension's IndexedDB (isolated world runs at the host page's origin), so every library read goes through the worker. Four additions, following the existing `SimilarQueryMessage` / `SimilarResponse` shape exactly:

```ts
/** Content → background: search the library for the in-page panel / picker. */
export type LibrarySearchMessage = {
  type: 'LIBRARY_SEARCH'
  query: string          // '' means "recent + most useful", not "everything"
  limit?: number         // default 6
}
export type LibrarySearchResponse =
  | { ok: true; rows: LibraryRow[] }
  | { ok: false; error: string }

/** A library row thin enough to cross the message boundary cheaply. */
export type LibraryRow = {
  id: number
  text: string
  platform: Platform
  usageCount: number
  lastUsedAt: number
}

/** Content → background: the user explicitly kept this one (M5 hand-save). */
export type SaveManualMessage = {
  type: 'SAVE_MANUAL'
  text: string
  platform: Platform
  url: string
}

/** Content → background: a saved prompt was reused from an in-page surface. */
export type PromptUsedMessage = {
  type: 'PROMPT_USED'
  id: number
}

/** Content → background: a suggestion was waved away (M4). */
export type SuggestionDismissedMessage = {
  type: 'SUGGESTION_DISMISSED'
  id: number
}
```

All four get added to the `RuntimeMessage` union. Handlers land in `src/background/index.ts` alongside the existing ones, each returning `true` for the async response.

### A4. Worker-scope pool cache — `src/background/pool.ts` (new)

**This is the `ROADMAP.md` "resurface scaling (deferred until it bites)" item arriving, and it bites now.** Today `SIMILAR_QUERY` re-reads the whole `prompts` table and trigram-scans it on every debounced keystroke (`src/background/index.ts:162`). M2's picker adds a second full-table read per keystroke of the query. Two full scans per keystroke on a 2 000-row library will miss the latency budget.

**Scope deliberately small — do not build the inverted index yet.** Just cache the row list in worker scope:

```ts
let cached: { rows: Prompt[]; at: number } | null = null
export async function getPool(includeMinor: boolean): Promise<Prompt[]>
export function invalidatePool(): void   // called after every write path
```

Invalidate on: `PROMPT_CAPTURED` save, `SAVE_MANUAL`, `UNDO_CAPTURE`, delete/restore, import, cap trim, clear-all, **and both of Phase E's write paths — `touchUsage` (via `PROMPT_USED`) and `touchDismiss` (via `SUGGESTION_DISMISSED`)**. Those two are easy to forget because they only bump counters, but they are exactly the fields M4's re-ranking reads: miss them and the learned ordering silently lags a whole worker lifetime behind the signals meant to drive it. The worker dying loses the cache, which is correct and free. If real libraries later feel slow *with* this cache, then build the trigram inverted index the roadmap describes — not before.

**Acceptance:** measure with `performance.now()` around the `LIBRARY_SEARCH` handler on a seeded 2 000-row library; p95 under 30 ms warm.

### A5. Prefs — `src/lib/prefs.ts`

Additive, defaults chosen so **the extension behaves as it does today until the user opts in to nothing** (i.e. the defaults *are* the new behaviour, since the user approved all seven — but each is individually switchable):

```ts
inPageDot: boolean        // M1 — default true
slashPicker: boolean      // M2 — default true
learnFromUse: boolean     // M4 — default true
intents: string[]         // M6 — default []; e.g. ['email','planning','learning','everyday']
welcomeDemoSeen: boolean  // M7 — default false
```

Follow the file's existing discipline exactly: add to the `Prefs` interface with a comment explaining the *why*, add to `DEFAULT_PREFS`, and add coercion in `coerce()` (`obj.inPageDot !== false` for on-by-default booleans; a validated string array for `intents`). `writePrefs` merging already protects against clobbering.

Extend `captureGate.ts`'s snapshot consumers so the dot and picker read these synchronously — no new storage reads on the hot path.

### A6. DB — `src/lib/db.ts`

M4 needs one new counter. Additive, following the file's own upgrade discipline (read the v2/v3 comments at `src/lib/db.ts:14-33` before touching this — an in-place schema edit once silently broke all writes):

```ts
this.version(4).stores({
  prompts: '++id, platform, createdAt, lastUsedAt, *tags',   // unchanged indexes
})
```

Schema string is identical — the bump exists only to reconcile cleanly. The new field is unindexed and optional on `Prompt`:

```ts
/** How many times a suggestion of this prompt was waved away. Feeds the
 *  resurface ordering only; never shown to the user and never a score of them. */
dismissCount?: number
```

Plus one function:

```ts
export async function touchDismiss(id: number): Promise<void>  // Dexie modify(), same race-safe shape as touchUsage
```

**Deliberately not doing:** query-scoped dismissal counters (storing fingerprints of what someone typed is a privacy cost with a weak payoff). The existing session-scoped, query-normalised dismissal in `resurface.ts` stays as-is for the "stop showing me this right now" job; `dismissCount` is only a long-run ordering signal.

---

## Phase B — M1 (the quiet dot) + M3 (turn it off here)

Shipped together: M3 is two rows in M1's panel footer, and shipping the dot without a way to turn it off would be the wrong order.

### Files

- `src/content/shared/presence.ts` — **new**, the dot and its panel.
- `src/content/shared/editable.ts` — gains the extracted `replaceComposerText()`.
- `src/content/shared/resurface.ts` — loses its local copy of `replaceComposerText()` and imports it from `editable.ts`.
- `src/content/<platform>/index.ts` × 5 — one added `attachPresence(getInput, '<platform>')` line each. Selectors stay where they are.
- `src/options/Settings.tsx` — toggles.

### Behaviour

**Anchor.** Bottom-right, **outside** the composer's right edge (`right-outside`, 8 px gap), falling back to inside-bottom-right when the viewport is tight. Outside-first is deliberate: every supported site puts its own send button inside the bottom-right of the composer, and overlapping it would be the single fastest way to make people uninstall.

**States** (mutually exclusive, driven by one `data-state` attribute):

| State | Look | When |
| --- | --- | --- |
| `idle` | 26 px circle, `opacity:.55`, hairline `--dj-line` border, mark inside | Composer empty or nothing matches |
| `matches` | `opacity:1`, accent ring `0 0 0 3px color-mix(in srgb, var(--dj-accent) 16%, transparent)`, count badge | The debounced query returned matches |
| `off` | `opacity:.4`, `filter:grayscale(1)` | Site switched off or paused |
| `broken` | Amber (`--dj-warn`) ring + `!` badge | M5, see Phase D |

**Precedence, since the states are exclusive:** `off` wins over `broken` wins over `matches` wins over `idle`. A paused or switched-off site never shows the amber ring — "we're not saving here because you said so" and "we're not saving here because the site moved" are different messages, and showing the alarming one when the user is the reason would be a lie. In incognito with auto-pause on, there is **no dot at all** (the whole point of that mode is to leave no trace in the session).

**Match count comes free.** Do **not** add a second query. `resurface.ts` already runs a debounced `SIMILAR_QUERY` and receives `{ matches, total }`. Give `attachResurface` an `onMatches(total: number)` callback that `presence.ts` subscribes to, and route that same response into the dot. This is the single most important performance decision in the plan: the dot costs zero extra work.

**The dot does not inherit the tooltip's suppression.** `resurface.ts` suppresses the *tooltip* for a query the user dismissed with `×`/Esc. The dot must keep its count in that case — dismissing "stop showing me this popup" is not "I no longer have anything saved about this", and a dot that goes dark right after a dismissal reads as broken. So: the debounced query still runs and still reports `total` to the dot; only the tooltip honors `dismissedFor`. The shared `MIN_CHARS` floor stays as-is for both — below it, matching is noise either way.

**Panel.** Opens above the composer, 320–380 px wide, max-height 260 px:
- Header: a title and a real `×` close button — the same affordance the tooltip already has. Escape alone is not enough for a mouse-first, non-technical audience, and the panel is focus-trapped while open. Clicking anywhere outside the panel also closes it. All three paths return focus to the composer.
- Search field (`--dj-sunk` background, focus flips to `--dj-surface` with an accent bottom border).
- Rows: two-line clamp of the prompt text with `{blanks}` rendered in accent mono, then a meta line — platform dot (`PLATFORM_COLOR`, hairline ring so ChatGPT's white shows), relative time, `used N×`. `tabular-nums` on the count.
- **Loading:** the worker may be cold, so a `LIBRARY_SEARCH` round trip is not always instant. After 120 ms with no response, show three low-opacity `--dj-sunk` placeholder rows (the skeleton pattern the extension pages already use). The 120 ms delay matters — showing skeletons for a 20 ms warm response is a flash, and a flash reads as a bug.
- Empty state, plain: "Nothing here matches that yet."
- **More than fits:** `LIBRARY_SEARCH` returns 6. When more matched, the last row is "See all in your library →", which fires the existing `OPEN_LIBRARY` message with the current query — the same affordance and the same message the tooltip's "See all" already uses. Without it, the panel quietly caps the user's library at six and gives them nowhere to go.
- Footer (M3): "Not here — never save from `chatgpt.com`" and "Pause saving for an hour". Both act immediately, **close the panel**, repaint the dot to `off`, and show an undo in the existing toast; hostname in mono. Leaving the panel open would show a live search box for a site the user just switched off — a visibly contradictory state.

**Clicking a row** = the same contract as the resurface tooltip: replace the composer via `replaceComposerText()` (extract it from `resurface.ts` into `editable.ts` so both use one implementation), or copy when `prefs.resurfaceClick === 'copy'`. Then send `PROMPT_USED`. If the prompt has blanks, the panel switches to the fill-in step first (Phase C's shared component).

**Saving off ≠ reading off — the one rule every surface follows.** This needs deciding once, here, because M1, M2 and M5 all hit it:

| State | Dot | Panel / picker | Why |
| --- | --- | --- | --- |
| Paused, or this site switched off | `off` | **Opens, library readable, insert works.** Footer flips to "Turn saving back on here" / "Resume saving now". | Pause and per-site off mean *don't record what I type*. They have never meant *lock me out of my own library*, and reading is the half with no privacy cost. |
| Incognito with auto-pause on | **absent** | — | The point of that mode is to leave no trace in the session. Fail closed, as `captureGate.ts` already does deliberately. |
| Domain matches a "never save from…" rule | **absent** | — | The user named this domain as somewhere Deja does not operate. Honour it completely. |

Contrast with M5's hand-save, which is a *write* and therefore stays blocked in every row above the first.

**Accessibility.** Dot is a real `<button>` with a state-accurate `aria-label`. Panel is `role="dialog"` with `aria-label`, focus moves to the search field on open, `Escape` closes and returns focus to the composer, focus is trapped while open. `mousedown` preventDefault on every control so the composer keeps focus (the pattern already used at `resurface.ts:214`).

**Never do:** animate the dot on idle, pulse it for attention, or show it when the composer has never been focused on this page. Presence, not attention-seeking.

### Settings

Extend the existing **"Suggestions while you type"** section (`Settings.tsx:785`) rather than adding a new one — it is already the right home and everyday-first ordering matters.

- "Show a small Deja button in the chat box" — *"A quiet dot at the corner of the box. It lights up when you've asked something similar before."*
- The per-site switches under "Where Deja works" already cover M3's persistent side; the panel footer just reaches them faster.

### Acceptance

- Dot appears on all five sites, never overlaps the site's own send button at 1280×800 or 1440×900, light and dark.
- Zero measurable change in Enter→stored latency (measure before/after).
- Turning the pref off removes it completely — no leftover DOM node.

---

## Phase C — M2 (type `//`)

### Files

- `src/content/shared/picker.ts` — **new**.
- `src/content/shared/blanks.ts` — **new**, the shared fill-in step used by both the picker and M1's panel.
- `src/lib/template.ts` — reused unchanged (`findPlaceholders`, `fillTemplate`, `blankLabel` already exist and already ignore code fences).
- `src/options/Settings.tsx` — the `//` toggle.

### Behaviour

**Trigger.** `//` typed in a composer that passes `isCapturableField()`, on a trusted event (A1b), on a page where the surfaces are allowed at all (the "saving off ≠ reading off" table in Phase B — so the picker still works while paused or site-off, and is absent entirely in auto-paused incognito or on a blocklisted domain). Everything after it up to the caret is the query. Cancel the picker on: whitespace run, `Escape`, caret moving out of the token, blur, or submit.

**Why `//` and not `/`.** A single slash is a live command trigger in several of these products' composers and in ordinary prose ("and/or"). Two slashes have no meaning in any of the five sites and are trivially escapable by typing a space between them. Trigger only when the `//` is at a word boundary — never inside a URL (`https://`), which is the one collision that would actually bite.

**Search.** Debounced 120 ms (tighter than resurface's 400 ms — this is an explicit, intentional gesture, so it must feel instant), `LIBRARY_SEARCH` with the caret query. Empty query returns the most-useful-first list via `usefulnessScore` from `ranking.ts`. Non-empty runs `searchPrompts` from `search.ts` so plural/spelling folding and synonym expansion apply for free. `LIBRARY_SEARCH` honours `filterStrength` the same way `SIMILAR_QUERY` does (`includeMinor` only when the filter is `off`) — a throwaway the library deliberately never saved should not reappear here. Same 120 ms skeleton rule as the panel.

**Keyboard.** `ArrowUp`/`ArrowDown` move, `Enter` takes, `Escape` closes, `Tab` takes (Grammarly's muscle memory). All handled in a capture-phase `keydown` and `preventDefault`ed **only** while the picker is open, so the host page's own key handling is untouched the rest of the time.

**Taking a row** removes the `//query` token from the composer, then either inserts the prompt or opens the blanks step. `PROMPT_USED` is sent.

**Nothing found.** A non-empty query that returns no rows shows the same line as M1's panel — "Nothing here matches that yet." — in the same place the list would be. Never leave an empty floating box on screen.

**Blanks step** (`blanks.ts`, shared with M1): one input per distinct placeholder, label rendered in mono showing the raw token, `blankLabel()` used for the human name. Enter in the last field commits. "Back" returns to the list. Skipped entirely for prompts with no blanks — never show an empty form.

**Accessibility.** Focus stays in the composer (moving it would break the caret). The picker is `role="listbox"` in the shadow tree with `aria-activedescendant` mirrored onto the composer, plus an `aria-live="polite"` line announcing "N saved prompts, use up and down arrows". The panel from M1 is the mouse-friendly path; this is the keyboard path.

### Settings

Under the same section: "Let me type `//` to pull up a saved prompt" — *"Two slashes in the chat box opens a quick search of everything you've saved."* The `//` in mono.

### Acceptance

- Works in a `<textarea>` (ChatGPT legacy) and in ProseMirror/contenteditable composers (Claude, Gemini).
- Typing `https://example.com` never opens it.
- p95 keystroke-to-list-update under 60 ms on a 2 000-row library.

---

## Phase D — M5 (hand-save when saving breaks)

### Files

- `src/content/shared/presence.ts` — the broken panel view.
- `src/content/shared/health.ts` — expose the current probe result to the presence layer.
- `src/background/index.ts` — `SAVE_MANUAL` handler.

### Behaviour

**Trigger.** The existing probe (`startHealthProbe`) already flips to unhealthy when the selector misses and re-probes every 30 s. Today that only writes to storage for the Settings view. Give it a subscriber so `presence.ts` learns about the transition and paints the dot amber.

**Panel content** — plain words, no blame, no jargon:
- Heading: "Deja can't see this box right now"
- Body: "This site changed its layout, so nothing here is being saved. You can still keep this one."
- The current draft in a `--dj-sunk` block, clamped to ~4 lines.
- Primary: "Save this one by hand" → `SAVE_MANUAL`.
- Toast on success: "Saved by hand — it's in your library now." with Undo (reuses `UNDO_CAPTURE`).

**`SAVE_MANUAL` handler.** Deliberately **not** a copy of the `PROMPT_CAPTURED` path:
- PII redaction **does** run (identical call, same vault merge) — the user asked to keep the text, not to keep their card number.
- The throwaway classifier **does not** run. An explicit click is an explicit intent; filtering it would be overriding the user.
- Duplicate/near-duplicate collapsing **does** run — same reasons as the normal path.
- Library cap trim **does** run.
- Blocklist and pause **are** honored on the content side before the button is even offered. Never offer a hand-save on a blocked domain.

### Acceptance

- Break a selector deliberately (edit the array in one content script), confirm amber within one re-probe cycle, confirm the hand-save lands in the library with PII redacted.
- With the site switched off or paused, the dot stays `off` (never amber — see Phase B's precedence rule) and the panel shows its normal library rows with the M3 footer, no broken-state copy and no save button. In auto-paused incognito or on a blocklisted domain there is no dot to click.

---

## Phase E — M4 (suggestions learn from what you use)

### Files

- `src/lib/ranking.ts` — one new pure function.
- `src/background/index.ts` — blend it into the `SIMILAR_QUERY` ordering; handle `PROMPT_USED` / `SUGGESTION_DISMISSED`.
- `src/lib/db.ts` — `touchDismiss`.
- `src/options/Settings.tsx` — the "Learn from which suggestions I use" toggle.

### Behaviour

**Signals, all already local:**
- Accept → `touchUsage(id)` (exists; bumps `usageCount` + `lastUsedAt`). Fired by every reuse path: the tooltip's main click, a panel row, a picker row, and the blanks step's commit.
- Dismiss → `touchDismiss(id)` (new; bumps `dismissCount`). **Fired by the resurface tooltip's existing `×`**, for the candidate currently on screen.

That last point needs stating plainly because it is the only place a dismissal can come from. Panel and picker rows deliberately get **no** per-row "not this one" control — they are lists the user opened on purpose and rejecting a row there is just… not clicking it, which is not a signal worth a button and would clutter a 2-line row. The `×` is the one place a user says "no, not that" about a specific suggestion Deja volunteered.

So the `×` now does two things, and they are different jobs on different timescales: it suppresses the tooltip for this exact query text (session-scoped, existing behaviour, unchanged) **and** it sends `SUGGESTION_DISMISSED` so that prompt's long-run standing drops a little. Neither replaces the other.

**Ordering.** Keep similarity dominant — this is a re-rank, not a replacement:

```ts
/** Blend lexical similarity with how the person has actually treated this
 *  prompt. Similarity stays dominant (0.8) so a genuinely closer match still
 *  wins; standing only breaks near-ties. Pure — unit-testable without a DB. */
export function suggestionRank(
  score: number,
  p: Pick<Prompt, 'usageCount' | 'lastUsedAt' | 'dismissCount'>,
  now: number,
): number
```

Shape: `0.8 * score + 0.2 * normalisedStanding`.

**The normalisation is load-bearing, not a detail.** `similarity()` returns `[0, 1]`; `usefulnessScore()` is **unbounded** — it is `(usageCount + 1) × recencyDecay`, so a prompt used daily reaches double digits. Blending the raw value would let standing dominate outright rather than break ties, which is the exact opposite of what this section promises. So squash it first:

```ts
const standing = usefulnessScore(p, now) / (1 + (p.dismissCount ?? 0))
const normalisedStanding = standing / (standing + STANDING_K)   // → [0, 1)
```

`STANDING_K` (start at 3) is the usefulness value at which a prompt has half the standing bonus available. Saturating rather than pool-relative is deliberate: a pool-relative normalisation would make one prompt's rank depend on unrelated prompts, so the same query would reorder itself as the library grew. `STANDING_K` and the 0.8/0.2 split live next to the similarity thresholds, marked **provisional** with the same comment convention — tuned from watched reactions, not guessed twice.

**Guard rails, stated in code comments so they survive:**
- Never falls below the similarity threshold — standing can reorder candidates, never introduce one.
- `dismissCount` decays in effect (it divides a recency-decayed score), so a prompt dismissed once a year ago is not punished forever.
- Nothing is shown to the user. No score, no bar, no "top prompt". The demo's "why this order" panel was an explanatory device for evaluating the idea — **do not ship it**; `ROADMAP.md` cuts prompt scoring on principle and a visible score is the same thing wearing a different hat.

**Settings.** "Learn from which suggestions I use" — *"Deja pays attention to which saved prompts you reach for, and offers those first. This never leaves your computer."* Off switch means the blend weight is zero; the counters still accrue harmlessly.

### Acceptance

- Unit tests on `suggestionRank`: accepting a lower-scoring prompt three times promotes it above a marginally closer one; dismissing does the reverse; a below-threshold prompt never surfaces regardless of standing.
- Existing `similarity.test.ts` expectations unchanged.

---

## Phase F — M6 (intent chips) + M7 (show, don't describe)

Both are extension-page work, so they use Tailwind + the `dj-*` component primitives from `globals.css` — **not** the overlay kit. Both themes come free from the token system; verify anyway.

### M6

- `src/lib/starter.ts` — add an `intent` field to `StarterPrompt`. One value per existing `kind`, so the mapping is total and nothing is left to inference: `✉️ Email → 'email'`, `📚 Learning → 'learning'`, `🤔 Deciding → 'deciding'`, `✍️ Writing → 'writing'`, `🏠 Everyday → 'everyday'`, `💼 Work → 'work'`. Keep both fields — `kind` is what the eye groups by, `intent` is what filters. The four welcome chips map to a subset (`email`, `planning`→`everyday`+`deciding`, `learning`, `everyday`); an `intent` with no chip simply never gets filtered *in*, which is why the "never show fewer than three" floor below matters.
- `src/ui/StarterPrompts.tsx` — filter by `prefs.intents` when non-empty; show everything when empty. Never show fewer than three.
- `src/options/Welcome.tsx` — a chip row between the greeting and the steps.
- `src/options/Settings.tsx` — the quiet "Which examples to show" row under "Your prompts".

**Copy:** "What do you mostly use AI for?" / "Pick as many as you like — it only changes the examples we show you first." Chips use `.dj-chip` with the accent-soft selected state. A visible **"Skip for now"**; nothing is ever required, and the chips never appear again after the welcome view (they live in Settings afterwards, under "Your prompts", as a quiet "Which examples to show" row).

**Emoji:** one per chip is within the `DESIGN.md` allowance (starter categories are explicitly listed as a place emoji earn their keep). Not on the buttons.

### M7

- `src/ui/WelcomeDemo.tsx` — **new**. A miniature composer that types a loose phrase, shows a scaled-down resurface tooltip, then swaps in the saved wording. 6–8 s loop with a replay button.

**Build it with CSS keyframes + one `setTimeout` chain, not a library.** Under `prefers-reduced-motion: reduce`, render the **final frame statically** plus a "Play the demo" button — never auto-loop.

**`welcomeDemoSeen` is what stops it becoming wallpaper.** Set it true once the loop has played through. On any later view — the returning visitor arriving from Settings' "Show me how this works again" — render the same static final frame plus the "Play the demo" button, i.e. exactly the reduced-motion presentation. Someone who already watched it does not need it moving at them again, and reusing the reduced-motion path means there is one static presentation to build and check, not two.

Placement: replaces the third step's body text in `Welcome.tsx` (the "Later, it finds you again" step, which is precisely the thing people cannot picture from words). Keep the written step title; the demo sits under it. Also reachable later from Settings' existing "Show me how this works again".

**Fidelity rule:** the miniature must use the *real* tooltip's proportions and colours, sourced from `overlayTheme.ts` — a demo that looks unlike the real moment teaches the wrong thing.

### Acceptance

- Picking two chips changes the starter list; skipping shows the full set; reload preserves the choice.
- Reduced-motion honored; no layout shift when the loop restarts (reserve the tooltip's height).

---

## Phase G — Whole-system pass

1. **Voice audit.** Every new string against the `DESIGN.md` table. Read the panel, picker, broken state, toasts, and both settings sections out loud as if to someone who has never opened a terminal.
2. **Theme audit.** All six overlay surfaces (toast, resurface, dot, panel, picker, blanks) in light and dark, on all five sites. The sites themselves have light and dark modes — check a dark overlay on a light host page and vice versa, since our overlays follow the OS preference, not the host's.
3. **Latency re-measure.** Enter→stored, popup→first result, keystroke→picker.
4. **Tests.** New colocated files: `presence.test.ts` (the state machine, including the `off` > `broken` precedence and the no-dot-in-incognito case), `picker.test.ts` (trigger/cancel rules, the `https://` case, the `isTrusted` gate), `pool.test.ts` (invalidation — including the `touchUsage`/`touchDismiss` paths), `ranking.test.ts` (extend for `suggestionRank`: normalisation keeps standing bounded, similarity stays dominant, a below-threshold prompt never surfaces), `prefs.test.ts` (extend for the new keys and their coercion defaults).
5. **Review.** `compound-engineering:ce-code-review` over the full diff before calling it done.
6. **Presentation** — Phase H below covers the outward-facing surfaces (landing page, store listing, screenshots, video, privacy page, README, in-extension empty states). H0 is independent of this work and should be done now.
7. **Docs, in the same body of work:**
   - `DESIGN.md` — an "In-page surfaces" subsection covering the overlay token contract and the tighter radii.
   - `ROADMAP.md` — mark the pool cache done and note that the inverted index is still deferred; log M1–M7 as a phase.
   - `README.md` — the `//` shortcut is user-facing and belongs in usage.
   - `MEMORY/LOG.md` — dated entry per the workflow rules.

---

## Phase H — Presentation (the outward-facing surfaces)

Shipping M1–M7 changes what Deja *is* in one sentence, so every surface that describes it goes stale at the same moment. Worse, three of them are stale **already** — `ROADMAP.md` Phase 6 flagged this and it was never closed. Doing the two together is cheaper than doing them twice.

**Status (2026-08-11):** H0 done, plus the copy-only parts of H2 — landing page fourth beat, store listing, privacy page, README, and the demo-video script. Screenshots and the video itself still need a human with a browser.

### H0. What is already wrong today (fix regardless of M1–M7)

1. **The store listing describes behavior the extension no longer has.** `store/listing.md` says of the resurface moment: *"Click to copy it to your clipboard — it never types into the box unless you opt in."* The default flipped to **insert** on 2026-08-05. The file's own header warns *"reviewers compare the listing against behavior"* — this is the exact kind of mismatch that gets a submission bounced, and it is also just untrue to the user.
2. **The screenshots predate the entire visual identity.** `store/screenshot-*.png` are dated **2026-07-10**; Phase 6's bundled fonts, sentence case, plain-English vocabulary, and the warm-paper Structure palette all landed in August. So the store shows Deja rendering in OS-fallback fonts — the precise bug Phase 6 was about ("the product literally looked its best for the audience it was least useful to"), now frozen in the shop window.
3. **`README.md` still leads with the old vocabulary.** Section headings read *"Capture you can trust"*, *"Selective capture"*, *"Capture controls"*. The `DESIGN.md` voice table maps capture → **save**. The README is the first thing a curious person reads on a public repo.
4. **`store/assets.md`'s video script quotes copy that no longer exists** — a toast reading *"remembered."* (it says "Saved for you ✔") and a settings line reading *"capture is working ✓"* (it says "Saving" / "Not yet" / "Needs attention").

The landing page (`site/index.html`, updated 2026-08-09) and privacy page are in good shape — same tokens, right voice. They need *additions*, not repair.

### H1. The positioning shift M1–M7 forces

Every surface currently frames Deja **passively**: it "quietly saves", it "resurfaces", it works "in the background". That was accurate. After M1 and M2 it is only half the story — Deja becomes something you also **reach for**, mid-sentence, on purpose.

The landing page's three-beat flow (*ask like you always do → saves it on this computer → the right one comes back*) is the clearest expression of the old frame, and it now needs a fourth beat: **and it's right there when you want it.**

That is the whole content change. Say it once, well, in each place — do not bolt seven feature bullets onto every surface.

### H2. Surface-by-surface

**Landing page — `site/index.html`.** Tokens are already synced with the extension (done 2026-08-08), so this is *content* work, not a restyle. Add the fourth flow step. Add one section showing the `//` picker, because it is the most demonstrable thing Deja will do and the hardest to convey in prose.

> **Reuse the evaluation demo.** The interactive demo built for this decision is already a self-contained page using the real tokens, the real fonts, and both themes. Its mock composer + picker is a better landing-page section than any screenshot or video — it lets someone *try* the mechanism before installing. Lift the stage, drop the control rail and the verdict UI, and inline it. This is the highest-leverage single item in Phase H.

**Store listing — `store/listing.md`.** Fix the copy/insert lie first (that one is a today-bug). Then rewrite `▸ AUTOMATIC CAPTURE` and `▸ "YOU'VE BEEN HERE BEFORE"` to carry the new frame, and add one block for the in-page library reach. Re-verify the 132-character summary after any edit — the current one is at 131.

**Screenshots — all five, retaken, plus two new.** The existing shot list in `store/assets.md` stays; the seeding instructions there still apply. New shots: **the panel open on a real chat page** (the single clearest image of what Deja now is) and **the `//` picker mid-query with a blank-filled row**. Retake the other five against the current UI — they are the ones showing the wrong fonts.

**Demo video — `store/assets.md` script.** Rewrite beats 1–2. The current script opens on a passive save and waits for a tooltip that may or may not appear; the new script opens on someone typing `//`, picking their own prompt, filling a blank, and sending. That is a 15-second demo instead of a 45-second one, and it shows a person in control rather than a tool being clever at them.

**Privacy page — `site/privacy.html`.** One honest addition under *Built-in protections*: the new in-page surfaces **read** your library inside the chat page, and the page itself cannot see them (closed shadow roots) or drive them (trusted-event gating). This is a genuine strengthening of the privacy story, not a caveat — say it as one.

**README.md.** Rename the three "capture" headings per the voice table. Add `//` to *Using Deja*. Add the new modules to *Architecture & how it works* — that section is how a contributor forms a mental model, and six new files with no entry there is how a codebase starts feeling undocumented.

**In-extension presentation.** Welcome is already handled (M6, M7). Two more: Settings' *Suggestions while you type* section gains the new toggles (specified per phase above), and the **Library empty state** should mention that `//` works on the chat sites — right now it teaches only "send a prompt and it appears here", which after M2 is no longer the fastest path to value.

### H3. Ordering

Do **H0 now** — it is four small corrections and two of them are factually wrong statements about shipped behavior. Do the rest **after Phase C lands**, not before: the screenshots and the video need the panel and picker to exist to photograph, and rewriting the pitch before the thing is built means writing it twice.

### H4. Acceptance

- No surface claims behavior the build does not have. Check the listing against the extension line by line before submitting.
- Every screenshot renders in bundled Figtree/Literata (not an OS fallback) — verify by eye against a known-good extension page.
- The word "capture" appears in no user-facing copy on any surface.
- Someone who has never used Deja can watch the 15-second demo and correctly describe what the `//` picker does.

---

## Build order and why

```
H0 (fix what's already wrong — do this now, it's independent)
A (foundations)  →  B (M1+M3)  →  C (M2)  →  D (M5)  →  E (M4)  →  F (M6+M7)  →  G  →  H1–H4
```

- **A before everything** — four surfaces share it; building it later means four rewrites.
- **B before C** — the panel is the mouse path and the simpler one; the picker reuses its row rendering and blanks step.
- **D after B** — it is a third state of B's dot.
- **E anywhere after B**, but last of the in-page work because it is the only one whose value is invisible on day one and it wants real usage to tune against.
- **F is independent** — it touches no content-script code and could be parallelised if someone else is working.

Each phase is independently shippable and independently revertible via a pref — with one honest exception: **M5 has no pref of its own**. It is a third state of M1's dot, so `inPageDot: false` takes it with it. That is the right coupling (a hand-save offer with no dot to click would be unreachable), but it means M5 cannot be rolled back alone.

---

## Risks, honestly

| Risk | Mitigation |
| --- | --- |
| The dot collides with a site's own composer UI | Anchor outside-right first, per-site position offsets if needed, and the pref kills it outright. Re-check after every site redesign — same discipline as selectors. |
| `//` collides with something a site adds later | Word-boundary trigger, no-op inside URLs, one keystroke of escape (space), and a pref. |
| Two full-table scans per keystroke | Phase A4's pool cache, measured before shipping C. |
| Six overlays drift visually | `overlayTheme.ts` is a single source; the refactor of the two existing overlays onto it is part of Phase A, not "later". |
| Ambient presence starts to feel like nagging | No idle animation, no attention pulses, count badge only, everything dismissible, everything switchable. If early users describe it as "busy", cut the count badge first. |
| A hostile script on a host page reads or drives the new surfaces | Closed shadow roots (A1) and an `isTrusted` gate on the two surface-opening triggers (A1b). Runtime-message forgery is pre-existing and explicitly out of scope here. |
| Scope creep into scoring/gamification | M4 ships with no visible score. Stated in code comments, not just here. |

---

## Explicitly not in this work

Semantic/embedding recall, LLM prompt improvement, auto-tagging, a visible standing score, query-fingerprint dismissal memory, the trigram inverted index, per-row "not this one" controls in the panel or picker, sender validation on the runtime-message handlers (pre-existing; deserves its own look), and any change to what the popup or library are for.

---

## Review

Reviewed 2026-08-10 by `ce-doc-review` (coherence, feasibility, design-lens, scope-guardian, security-lens). Seventeen findings; all applied. The ones that changed the design rather than the prose: closed shadow roots + `isTrusted` gating (A1/A1b), the saturating normalisation in `suggestionRank` (Phase E — the original blend would have let standing swamp similarity), the `×` as the single source of dismissal signal (M4 had a message with no caller), the `off`/`broken` precedence rule, and the "saving off ≠ reading off" table that settles gating for M1, M2 and M5 in one place.
