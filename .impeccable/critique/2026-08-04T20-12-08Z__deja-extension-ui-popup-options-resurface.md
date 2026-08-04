---
target: Deja extension UI (popup, options, resurface)
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-04T20-12-08Z
slug: deja-extension-ui-popup-options-resurface
---
Method: dual-agent (A: design-review sub-agent · B: detector-evidence sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Pause state (popup banner) and capture-health (Settings dot list) live apart, one-way link between them |
| 2 | Match System / Real World | 3 | Tag filter is AND-only, contradicts typical checkbox-filter mental model, never stated in UI |
| 3 | User Control and Freedom | 4 | Undo everywhere it matters, two-step confirm on destructive bulk actions |
| 4 | Consistency and Standards | 3 | Two ARIA patterns for one concept: `aria-current` nav vs `role="tablist"` platform filter |
| 5 | Error Prevention | 4 | Inline regex validation, disabled export on empty library, confirm-before-destroy |
| 6 | Recognition Rather Than Recall | 4 | Live PII-test preview, live blocklist dry-run, hint text under every pill group |
| 7 | Flexibility and Efficiency | 3 | Real keyboard model (arrows/Enter/Backspace/⌘K) exists but under-taught in Welcome |
| 8 | Aesthetic and Minimalist Design | 3 | Drawer progressive-disclosure works; top-level Settings still front-loads 5 sections |
| 9 | Error Recovery | 3 | Good inline errors for regex/import; `listPrompts()` has no `.catch`, fails silently to empty |
| 10 | Help and Documentation | 2 | Welcome is one-time only, no re-entry point anywhere in the app |
| **Total** | | **32/40** | **Good** |

Both heuristics 7 and 10 were scored (not n/a) — this is an Operate-mode surface used repeatedly, both fully apply.

## Design Specificity Verdict

**LLM assessment**: Reads as authored for Deja, not a reskinned template. Voice-table mapping applied near-verbatim on real strings ("What Deja saves," "Never save from…," "Download a backup," "Erase deleted prompts for good" — `Settings.tsx:425,638,509-521,809`). Structural choices are product-specific: native `<details>` drawer gating regex/import/purge, non-generated `starter.ts`, resurface tooltip's rotating lead phrases with a frozen candidate set. Copy explains *why* actions are safe ("Deleting a prompt hides it but keeps the text around so you can undo," `Settings.tsx:810`) — a generic settings page wouldn't bother. Slips toward generic-SaaS are narrow: an unexplained AND-filter, a stray "backup" → ".json" leak, one clinical drawer subtitle.

**Deterministic scan**: `detect.mjs --json src/popup src/options src/content/shared` → exit 0, **zero findings** across 16 scanned files. Detector integrity confirmed live (fired 4 known findings on a deliberately-bad throwaway file outside the repo, exit 2). Class/token cross-reference against `globals.css`: every `.dj-*` class referenced in the three scanned dirs (`dj-btn`, `dj-btn-ghost`, `dj-btn-primary`, `dj-card`, `dj-input`, `dj-meta`, `dj-pill`, `dj-pill-active`, `dj-tag`, `dj-tag-active`, `dj-tag-label`) exists in `globals.css` — no dead/typo'd classes. No hardcoded hex/inline styles in `src/popup/*.tsx` or `src/options/*.tsx`. `toast.ts`/`resurface.ts` hand-roll an isolated stylesheet (Shadow DOM can't see `globals.css`), with hex values that match the token values exactly — intentional per DESIGN.md, but a manual-sync maintainability risk if tokens ever change without updating these two files.

**Visual overlays**: unavailable this session — no browser automation tool exposed (verified by search, not assumed). No live-server/injection was attempted per protocol; no user-visible overlay to point to. Fallback signal: CLI-only scan, source-level design review.

## Overall Impression

Strong, coherent system — mechanically clean (zero detector findings, no dead classes, no hardcoded colors in the reviewed dirs), and the two hallmark product decisions (progressive disclosure via the drawer, real undo everywhere) are executed exactly as CLAUDE.md/DESIGN.md prescribe, not just claimed. The gaps are all about what happens *after* the warm first impression: onboarding has no re-entry, one filter behavior is silently non-obvious, and one DB-read path fails silently — three small trust cracks in a product whose entire pitch rests on feeling safe and legible to a non-technical user.

## What's Working

1. **Progressive disclosure is real, not decorative.** Every technical control (regex, per-category PII toggles, JSON import, permanent erase) lives inside one native, keyboard-operable `<details>` (`Settings.tsx:555-841`); the non-drawer surface stays plain-language-only.
2. **Undo is everywhere it needs to be, with specific reassuring copy** instead of a generic "Undo" — "that was a slip" (`Library.tsx:499`), one-time explanation on first skipped throwaway (`capture.ts:64-68`), two-step in-place confirm on account-wide destructive actions.
3. **Zero mechanical drift.** Every `.dj-*` class used resolves to a real definition, no hardcoded colors leaking into the React surfaces, the Shadow DOM overlay's inline palette matches the token values exactly rather than drifting.

## Priority Issues

**[P1] No way back into Welcome/onboarding**
Why it matters: Welcome (`Welcome.tsx`) opens once on install (`?welcome=1`) and nothing in `App.tsx` or `Settings.tsx` re-opens it. The target persona (non-technical, may not absorb everything first time) has no in-app path to re-orient later — reinstall is the only route back to the warmest surface in the product.
Fix: add a small "Show me how this works again" link in Settings that sets the view state to `'welcome'`.
Suggested command: `$impeccable onboard`

**[P1] Tag-filter AND semantics undocumented**
Why it matters: `Library.tsx:117-123` (logic) + `:412` (aria-label only, "Filter by tag (AND)" — jargon a screen reader reads verbatim). Clicking two tag pills narrows results; most people expect it to widen them. Zero in-UI explanation means the likely read is "tags are broken," not "tags work differently than I assumed."
Fix: one `dj-meta` line under the tag row — "Showing prompts with every tag you've picked."
Suggested command: `$impeccable clarify`

**[P2] Silent failure on prompt-list load errors**
Why it matters: `Popup.tsx:16-20` and `Library.tsx:73-81` call `listPrompts()` with no `.catch`. A DB read failure degrades indistinguishably from "genuinely empty" — for a tool whose whole pitch is "your prompts are safe here," that reads as "my prompts disappeared."
Fix: catch and render a short, warm error state distinct from the empty-library state.
Suggested command: `$impeccable harden`

**[P2] Emoji stacking in Settings feedback section**
Why it matters: `Settings.tsx:844-867` decorates the heading ("Tell me what you think 💬") *and* both buttons ("Something's broken 🛠️", "I have an idea 💡") — the one place in the reviewed surfaces that visibly breaks DESIGN.md's own rule ("don't decorate buttons… if it starts to feel like a sticker sheet, take them back out").
Fix: keep the heading emoji, drop both button emoji.
Suggested command: `$impeccable polish`

**[P3] ARIA-menu contract not implemented for pause dropdown**
Why it matters: `PauseControl.tsx:111-131` uses `role="menu"`/`"menuitem"` without arrow-key roving, auto-focus into the menu, or focus return on close — the role promises behavior a screen-reader user won't get.
Fix: implement roving tabindex + arrow keys, or drop the menu/menuitem roles for a plain button list.
Suggested command: `$impeccable audit`

## Persona Red Flags

**Jordan (confused first-timer, the actual target user)**: Install → Welcome → dismiss → try ChatGPT, fine so far. Opens a populated Library: 6 platform tabs, favorites switch, sort dropdown, tag row all appear at once (`Library.tsx:336-435`) — a bigger jump than the gentle Welcome promised, though the empty-library state deliberately hides all of it until there's content. Clicking two tag pills expecting "either" gets a smaller/empty result with no explanation (`Library.tsx:117-123`) — the single most likely "this is broken" moment. Wants to re-read the friendly explanation later: nowhere to go (Welcome has no re-entry).

**Sam (accessibility-dependent, keyboard/screen-reader)**: Strong baseline — every clickable element reviewed is a real `<button>`/`<a>`/`<input>`, `focus-visible` rings used correctly, the drawer is a native disclosure element, Library's keyboard shortcuts cover the full core loop. Specific fails: switching options views moves no focus and announces nothing (`App.tsx:31-66`); pause dropdown's `role="menu"` doesn't behave like one (`PauseControl.tsx:111-131`); per-platform "ok"/"unknown" health status distinguished only by dot color + unreachable `title` tooltip, not visible text (`CaptureStatus.tsx:42-63`); save-toast's Undo has a hard, unpausable 5000ms window with no extend (`toast.ts:76`).

**Casey (privacy-anxious — the audience Deja's own pitch targets)**: Privacy page lands well — specific, reassuring, exact site list (`Privacy.tsx`). Wants to permanently remove something sensitive: 3-step, 2-page flow (delete in Library → find drawer in Settings → "Erase deleted prompts") at exactly the moment an anxious user wants one obvious button; copy at `Settings.tsx:810` mitigates but doesn't remove the friction. Wants fine-grained control over which personal-info categories get hidden: gated behind the same drawer as regex rules (`Settings.tsx:570-634`) even though it's a privacy-first control, not a power-user one — tension with CLAUDE.md's "technical controls stay, but move down" rule, since these toggles aren't actually technical, just detailed.

## Minor Observations

- `Settings.tsx:786,390` — "**.json** backup" leaks a raw file-extension token past the "export JSON" → "backup" rewrite.
- `Settings.tsx:563-565` — drawer subtitle ("Fine-grained privacy rules… permanent erase") reads more clinical than the voice used elsewhere in the same file.
- `Privacy.tsx:18` ("Privacy, plainly 🔒") and `Welcome.tsx:107` (fourth emoji on one onboarding screen) sit at the edge of DESIGN.md's emoji restraint rule — individually defensible, additively closer to sticker-sheet than intended.
- `toast.ts`/`resurface.ts` hardcode hex values that exactly match `globals.css` tokens (Shadow DOM can't see the extension's CSS) — intentional per DESIGN.md, but a silent-drift risk if a token changes without updating both files by hand.
- `CaptureStatus` (Library) and the per-site list (Settings) show overlapping but differently-detailed health info in two places with only a one-way link between them.
- `PromptCard.tsx:91-97` — bulk-select checkbox is 14px (`h-3.5 w-3.5`) with no enlarged hit area or wrapping `<label>`.

## Questions to Consider

- Tag filtering is AND-only by design — should the UI simply say so once, or would an AND/OR toggle violate "≤4 options per decision" and "guiding not configuring" more than the silence does?
- Welcome has no route back — deliberate "onboarding is a one-time ritual," or oversight? What's the intended answer for someone who forgets how resurface/undo work three weeks in?
- `CaptureStatus` and the per-site Settings list show overlapping health info in two places — redundant, or intentionally "quick glance" vs. "full detail," and if the latter, should the quick one point to the detailed one?
- Is "technical vs. not" the right axis for what lives in the drawer, or should it be "how often would a first-week user plausibly want this" — since PII-category toggles and "never save from…" arguably belong on the first screen for the privacy-anxious persona the product is built for?
