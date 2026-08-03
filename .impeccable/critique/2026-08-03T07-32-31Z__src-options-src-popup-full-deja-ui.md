---
target: "Deja full UI (popup + options: Library, Settings, Privacy, Welcome)"
total_score: 34
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-03T07-32-31Z
slug: src-options-src-popup-full-deja-ui
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Status is strong (save indicator, per-site "Not visited yet", live prompt counts, import result text) but no visible confirmation after "Copy"/"Pin" clicks in the library. |
| 2 | Match System / Real World | 4 | Plain-language voice table is followed almost everywhere in the shipped UI — no "capture," "blocklist," "export," or "PII redaction" leaked into copy. |
| 3 | User Control and Freedom | 4 | Soft-delete (undoable), separate two-step confirm on "Delete everything," search clear (×), pause control. |
| 4 | Consistency and Standards | 3 | Bespoke pill/chip/card language is consistent, except the native `<select>` sort dropdown and native file-picker button, which break the visual system. |
| 5 | Error Prevention | 3 | "Delete everything" requires a second click ("Sure? This erases everything"); "Erase deleted prompts for good" — equally permanent — has no such guard (`src/options/Settings.tsx:338-342`). |
| 6 | Recognition Rather Than Recall | 4 | No icon-only controls; every action is text-labeled; tags and platform are always visible on cards. |
| 7 | Flexibility and Efficiency | 3 | ⌘K search hint, bulk "Select several" mode, per-card actions inline. No keyboard shortcuts beyond search focus. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean on populated screens; the Library header stacks 9+ controls (search, 6 platform pills, favorites toggle, sort dropdown, "Select several") above content, including on the empty state where none of them have anything to act on. |
| 9 | Error Recovery | 4 | Import gives specific, plain-language failure messages ("That file isn't a Deja backup" / "Couldn't read that file"); undo-capture and soft-delete both recover cleanly. |
| 10 | Help and Documentation | 3 | Contextual help appears exactly where needed ("A site isn't saving? Let me know →" right under the site toggle list); no searchable help, but the product doesn't need one at this scope. |
| **Total** | | **34/40** | **Good** |

## Design Specificity Verdict

**LLM assessment**: The interface reads as authored for this product, not a generic template. The "warm notebook" identity — paper background, ink hierarchy, a single indigo accent, the lowercase `de|ja` wordmark, the hand-written copy voice ("Ready when you are — no rush ☕") — is consistent across all five captured surfaces (Welcome, Library empty/populated, Settings collapsed/expanded, Privacy, both Popup states). The plain-language voice table in DESIGN.md is genuinely followed in the rendered UI: none of the banned jargon terms (capture, blocklist, export, PII redaction, filter strength) appear anywhere in the screens reviewed. The one place specificity lapses is exactly where native browser chrome leaks through — the `<select>` sort dropdown and the native file-picker button are the only two controls that look like "a web form" instead of "Deja."

**Deterministic scan**: `node .agents/skills/impeccable/scripts/detect.mjs --json src/options src/popup src/ui` — 0 findings, exit code 0. No hardcoded colors, no other mechanical violations caught. This corroborates that the Tailwind semantic tokens DESIGN.md mandates (`bg-bg`, `text-ink`, `border-line`, etc.) are actually used in practice, not just prescribed.

**Visual overlays**: not available this run — see Run Notes.

## Overall Impression

Deja's UI is unusually disciplined for its stage: copy, color, and component vocabulary hold together across onboarding, library, settings, and privacy without drift. The biggest opportunity isn't visual — it's trimming what's shown before there's anything to act on (empty-state chrome) and closing one real safety gap (an unconfirmed permanent-erase action) rather than any deep redesign.

## What's Working

- **Voice discipline**: Every screen speaks the plain-language dialect DESIGN.md defines — "Not sure what to ask? That's okay 💡", "Nothing here yet — take your time 🌱", "Sure? This erases everything." No screen slips into engineer-speak.
- **Two-step destructive confirm pattern**: "Delete everything" swaps its own label to a red "Sure? This erases everything" instead of popping a native `confirm()` dialog — in-place, on-brand, and still safe.
- **Contextual template affordance**: Cards whose text contains `{blanks}` or a `[email]` placeholder swap their primary button from "Copy" to "Fill in & copy" (`06-library-populated.png`, DeepSeek and Claude cards) — the UI adapts to content instead of asking the user to notice the placeholder themselves.

## Priority Issues

**[P1] "Erase deleted prompts for good" has no confirmation, while an equally permanent action next to it does**
- **Why it matters**: `onClearAll` (`src/options/Settings.tsx:327-336`) requires a second click before it runs. `onPurgeDeleted` (`src/options/Settings.tsx:338-342`) runs immediately on first click, permanently deleting tombstoned rows with no "are you sure" step — for a product whose entire pitch is "your prompts, safely kept," one click silently doing the one truly irreversible thing in the app is the sharpest inconsistency found.
- **Fix**: Give "Erase deleted prompts" the same swap-to-confirm pattern already built for "Delete everything."
- **Suggested command**: `$impeccable harden`

**[P1] Meta text fails contrast (`text-ink-faint` on `bg`)**
- **Why it matters**: `--dj-text-faint: #9a968d` on `--dj-bg: #faf8f3` computes to ≈2.8:1 contrast — below WCAG AA's 4.5:1 (and below the 3:1 large-text floor). This token carries timestamps, reuse counts, per-site "Not visited yet" status, and the "N prompts · safe on this device" subtitle — i.e., it's load-bearing metadata on every screen with content, not decorative.
- **Fix**: Darken `--dj-text-faint` (or reserve it for genuinely decorative use and promote metadata to `--dj-text-soft`, which measures ≈5.2:1 and passes).
- **Suggested command**: `$impeccable audit`

**[P2] Library header shows full filter apparatus on the empty state**
- **Why it matters**: `02-library-empty.png` shows a search bar, 6 platform pills, a favorites toggle, a sort dropdown, and "Select several" — 9+ controls — stacked above a library with 0 prompts and nothing to filter, sort, or select. This runs against DESIGN.md's own test ("would this make sense to someone who's never opened a terminal? If not, move it behind More options") and adds pure extraneous cognitive load at the exact moment a first-time user needs the least friction.
- **Fix**: Hide or fade filter/sort/select controls until at least one prompt exists; let the empty state and starter prompts own the screen.
- **Suggested command**: `$impeccable onboard`

**[P2] Two native browser controls break the bespoke visual system**
- **Why it matters**: The "Newest first" `<select>` (`02-library-empty.png`) and the "Choose a backup file" native file-picker button (`10-settings-more-open.png`) are the only two controls on any captured screen that don't use the `.dj-btn` / `.dj-pill` / `.dj-chip` component vocabulary — they render as plain OS chrome next to hand-styled pills and cards, and they're the one place the product's specificity lapses (see Design Specificity Verdict).
- **Fix**: Replace the native select with a styled dropdown/menu component; wrap the file input in a `.dj-btn-ghost`-styled label (the JSON-import file input already does this per `Settings.tsx:788` — apply the same treatment to the restore-backup input).
- **Suggested command**: `$impeccable polish`

**[P3] PII-kind chip labels lowercase their acronyms**
- **Why it matters**: `PII_LABEL` (`src/lib/pii.ts:24-30`) renders "api keys & tokens," "ibans," and "ip addresses" — API, IBAN, and IP are acronyms, not ordinary words, and DESIGN.md's own voice rule says to "keep proper nouns and acronyms correct everywhere." Sitting next to correctly-cased "credit-card numbers" and "social-security numbers," the lowercase acronyms read as unpolished rather than intentionally casual.
- **Fix**: Capitalize the acronyms — "API keys & tokens," "IBANs," "IP addresses" — while keeping the rest sentence-case.
- **Suggested command**: `$impeccable clarify`

## Persona Red Flags

**Jordan (Confused First-Timer — the actual target audience per DESIGN.md)**: The empty Library (`02-library-empty.png`) front-loads 9+ filter/sort/select controls before any content — Jordan has to visually parse and dismiss all of it before reaching "Nothing here yet — take your time 🌱," which is the only thing relevant to her at that moment. The "Fill in & copy" vs. plain "Copy" button label change (`06-library-populated.png`) is self-explanatory enough to probably not stump her, but there's no tooltip or first-encounter hint explaining why the button differs card to card — low risk, but worth a glance.

**Sam (Accessibility-Dependent User)**: The `text-ink-faint` contrast failure above directly hits Sam — every timestamp, reuse count, and site-status line in the product is set in a color that fails WCAG AA. This is the single highest-reach accessibility issue found, since `.dj-meta` is used on every screen with data.

**Riley (Deliberate Stress Tester)**: Not directly testable from static screenshots, but two edge cases are worth checking live: (1) how a card with 4+ tags wraps inside the fixed-width popup (360px) or a library card, and (2) whether the two-step "Delete everything" confirm resets correctly if the user navigates away mid-confirm (`confirmClear` is component state, not persisted — a tab switch or view change likely resets it silently, which is probably the right behavior but wasn't visually confirmed).

## Minor Observations

- The "Select several" bulk-select entry point is a bare text link with no icon or button chrome, sitting in open whitespace below the filter row (`02-library-empty.png`, `06-library-populated.png`) — it's easy to miss on first pass.
- Popup screenshots in this review were captured by serving `dist/` statically with a `chrome.*` API shim (see Run Notes) at a 1280px viewport; the popup itself is hard-fixed to `w-[360px]` via `src/popup/index.html`, so the visible whitespace to the right of the popup content in `03-popup-empty.png`/`08-popup-populated.png`/`09-popup-search.png` is a capture artifact, not a real layout issue — the actual extension popup window trims to content width.
- Settings' "Download as a document" / "Download a backup" buttons and "Delete everything" share the same ghost-button styling (border-only, no fill) even though one pair is safe/frequent and the other is destructive/rare — visually they don't signal different risk levels, though the "Sure?" label swap on click does the real safety work.

## Questions to Consider

- What does "Select several" actually enable once clicked — checkboxes on every card, a persistent selection toolbar? It wasn't exercised in this pass; worth a quick live click-through.
- Does the Library filter/sort row need to exist at all below, say, 3 saved prompts — or does hiding it entirely (not just visually deferring it) better serve Jordan than a permanently-present-but-empty control row?
- Is there a reason "Erase deleted prompts" skipped the confirm pattern "Delete everything" already has — was it deliberate (because the prior soft-delete step is the real safety net) or an oversight?
