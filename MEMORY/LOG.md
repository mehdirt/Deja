# Memory log

Append-only log of decisions and context from nontrivial work sessions. Read before starting nontrivial work; append an entry after.

## 2026-08-05

Silenced Chrome "modulepreload … not used within a few seconds" on popup/options by setting `build.modulePreload: false` in `vite.config.ts`. Vite was preloading shared chunks (`db`, `prefs`, …) that local extension pages don't benefit from; warn was cosmetic, not a functional bug.

"Type it in for me" resurface click now clears the composer then types the remembered prompt (was insert-at-caret, which left the half-typed draft in place). Settings hint updated to match. Default flipped to insert (was copy); coerce keeps an explicit stored `copy`.

Browser-verified the 2026-08-04 Impeccable critique fixes in headed Chrome for Testing with the unpacked `dist/` extension loaded (`--load-extension`; agent-browser's `--extension` flag did not attach Deja — connected via CDP `:9222` instead). Confirmed live: Welcome install view, Settings "Show me how this works again" re-entry, tag-filter AND copy under multi-tag selection, feedback heading emoji without button emoji, pause menu focus-on-open + ArrowDown/Escape return, CaptureStatus broken-state "Check settings" → Settings. Screenshots under `.tmp/browser-verify/` (gitignored). `listPrompts` error UI left as unit-test coverage only — no live DB-failure injection this pass.

## 2026-08-04

Set up workflow rules in CLAUDE.md (goal-loop discipline, subagent usage, review gates, atomic commits, docs-currency requirement) and stubbed the doc map (`docs/README.md`, `docs/ops/`, `docs/corpus-reference/`, this file). No prior entries — this is the log's first.

Ran a full-surface Impeccable UI/UX critique (popup + options: Library, Settings, Privacy, Welcome), scored 32/40. Fixed the top 3 priority issues (Welcome re-entry, tag-filter AND-semantics copy, silent `listPrompts()` load failures), then ran `ce-code-review` over that fix, which caught and fixed a real race condition in the new shared `useAsyncList` hook plus a render-site bug where a failed background refresh blanked an already-loaded list. Follow-up pass cleared the rest of the critique's backlog: emoji density (Settings feedback section, Privacy heading, Welcome closing line), the `.json`-in-copy leak, a clinical drawer subtitle, the pause-menu's ARIA-menu keyboard contract (roving arrow keys, focus-on-open, focus-return-on-Escape), the bulk-select checkbox's tap-target size, and a one-way link gap between Library's `CaptureStatus` and Settings (added a "Check settings" link that appears only when a platform is actually broken).
