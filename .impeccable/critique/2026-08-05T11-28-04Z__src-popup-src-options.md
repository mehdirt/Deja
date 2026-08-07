---
target: Deja extension UI (popup, options, resurface)
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-05T11-28-04Z
slug: src-popup-src-options
---
Method: dual-agent (A: 327077e0-944f-453c-95d1-c4a8024ad336 · B: f32387b7-2a8d-4ece-a969-9abda8b4e0e0)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Insert path hides tooltip with no confirm; copy path gets “Copied — paste it anywhere ✓”. CaptureStatus mostly color dots. |
| 2 | Match System / Real World | 3 | Strong plain voice; leaks: “Most useful”, “Short ones (N)”, Welcome ⌘⇧K vs ⌘K soup, “Block” under “Never save from…” |
| 3 | User Control and Freedom | 3 | Soft-delete undo + Esc/clear solid; default insert wipe of live draft has no product-level undo teach |
| 4 | Consistency and Standards | 2 | “Pin” vs “Favorites”; copy confirms / insert silent; Privacy “in one click” vs Settings confirm; dual health UIs |
| 5 | Error Prevention | 2 | Default insert clears composer mid-draft; Library Backspace deletes with only timed undo |
| 6 | Recognition Rather Than Recall | 3 | Labels present; sort/filter/resurface default meaning under-taught at point of use |
| 7 | Flexibility and Efficiency | 3 | ⌘K/arrows/Enter/Backspace, bulk, pins/tags — power path exists, mostly invisible to novices |
| 8 | Aesthetic and Minimalist Design | 2 | Populated Library dumps platform pills + Favorites + sort + tags + Select several at once |
| 9 | Error Recovery | 3 | Soft-delete undo, ErrorRetry, plain import failures; insert→copy fallback can surprise |
| 10 | Help and Documentation | 3 | Welcome + “Show me how this works again” + feedback; weak contextual help for sort/resurface default |
| **Total** | | **28/40** | **Good (low end)** |

## Design Specificity Verdict

**LLM assessment**: Authored for Deja, not a swapped SaaS shell. Warm paper, Literata wordmark, “quietly saving”, index-card prompts, voice-table discipline (“Hide personal info”, “Download a backup”, “Never save from…”, “More options”). Weak spots are Operate chrome: six equal platform pills, opaque “Most useful”, Settings-as-preference-sheet. Resurface openers are the most product-specific interaction; default insert makes that moment more Deja and more consequential — identity clear, consequence teaching thin.

**Deterministic scan**: `detect.mjs --json` on `src/popup`, `src/options`, `src/ui`, `globals.css` → exit 0, **zero findings**. Sanity check confirmed detector works (Inter throwaway → exit 2). Shell HTML is `#root`-only; TSX still scanned clean. Runtime contrast/focus/overlap need browser — unavailable this run.

**Visual overlays**: unavailable. No puppeteer; `chrome-extension://` not injectable via live-server; no browser MCP. Fallback: Aug 5 `.tmp/browser-verify/` screenshots (welcome, settings, library, popup, pause, capture-status) — visual only, not overlay.

## Overall Impression

Still a coherent warm notebook with real progressive disclosure in Settings and excellent empty/Welcome tone. Score drops vs Aug 4’s 32/40 mainly because **insert-as-default** raised stakes at the brand moment without teaching/confirm, and the **populated Library** still opens as a control panel. Prior P1s (Welcome re-entry, tag-AND copy) are fixed and no longer lead.

## What's Working

1. **Welcome emotional architecture** — one job, three lived steps, CTAs “Try a question on ChatGPT” / “Take a look around first”; Settings re-entry “Show me how this works again” exists.
2. **Settings progressive disclosure** — everyday prefs first; regex / restore / erase under More options with plain summary.
3. **Empty + pause voice** — “Nothing here yet — take your time 🌱”; “Quietly saving for you”; soft-delete undo copy.

## Priority Issues

**[P1] Default insert undertaught / underconfirmed**
- What: Resurface defaults to replace composer (`prefs.resurfaceClick: insert`). Overlay confirms only on copy; insert `hide()`s. Welcome step 3: “One click, and it’s yours again” — never says the box clears.
- Why: Mid-draft click at the déjà-vu moment can wipe new wording; high-stakes valley.
- Fix: Teach in Welcome; brief insert confirm (“Replaced — undo with ⌘Z in the chat”); or first-run soft confirm once.
- Suggested command: `$impeccable clarify` / `$impeccable onboard`

**[P1] Library filter wall once anything is saved**
- What: At `prompts.length > 0`: 6 platform pills + Favorites + 4-way sort + tags + “Select several” + optional “Short ones”.
- Why: Primary task (find & reuse) buried; fails chunking / ≤4 choices; tone shifts friend → clerk.
- Fix: Default search + list; tuck platform/sort/tags behind Filter; demote Select several / Short ones.
- Suggested command: `$impeccable distill` / `$impeccable layout`

**[P1] Resurface secondary controls weak for keyboard / SR**
- What: “See all →”, “›”, “×” are `<span>`s inside one `<button>`; meta colors still `#9a968d` in Shadow DOM.
- Why: Cannot tab to step/See all/dismiss independently; faint meta fails low vision.
- Fix: Real focusable controls; sync overlay faint to updated tokens.
- Suggested command: `$impeccable audit`

**[P2] Status-by-color on capture health**
- What: Library CaptureStatus uses green/red/faint dots; broken adds text, ok/unknown often do not.
- Why: Quiet breakage easy to miss.
- Fix: Pair every dot with short text, or only show strip when broken/unknown.
- Suggested command: `$impeccable harden`

**[P2] Vocabulary / claim inconsistencies**
- What: Card “Pin” vs filter “Favorites”; Privacy “in one click” vs Settings confirm; “Block” under “Never save from…”; opaque “Most useful”.
- Why: Literal readers mistrust or freeze.
- Fix: One word for pin/favorite; Privacy → “after a confirmation”; rename or explain Most useful; Block → Add / Never save.
- Suggested command: `$impeccable clarify`

## Persona Red Flags

**Jordan (first-timer)**: Empty Library fine; after first saves, six site pills + Favorites + sort with no “you only need search” cue. “Most useful” / “Short ones” opaque. Welcome tip packs ⌘⇧K vs ⌘K. Weak lead “A past you might help →”.

**Sam (a11y)**: Resurface nested spans; health dots `aria-hidden` + color; Backspace deletes focused card with 6s undo trap; Mac-centric ⌘K chrome; insert outcome not announced.

**Maya (everyday non-coder — primary)**: Wants landlord-email prompt; hits platform chrome and “Most useful” first. Default “Type it in for me” while rewriting a trip plan → draft gone; Settings hint never seen. Two backup buttons day one. Starters vanish → power chrome appears — tone cliff.

## Minor Observations

- Tag AND copy now present (“Showing prompts with every tag you've picked”) — prior P1 closed.
- Emoji density mostly within DESIGN.md; don’t add more.
- “API keys & tokens” / “IBANs” cold but correctly under More options.
- Cut weak LEAD_PHRASE “A past you might help →”.
- Library header is meta-only (“N prompts · safe on this device”) — thin hierarchy under nav.

## Questions to Consider

1. Should default click ever destroy in-progress words without a one-beat confirm?
2. Would Maya’s Library be more Deja as search + recent cards with filters behind one control?
3. Does “Most useful” deserve to exist if you cannot say in one plain sentence what it measures?
4. Should Welcome teach one keyboard story (pin the icon) and retire the ⌘ soup until Settings re-entry?
