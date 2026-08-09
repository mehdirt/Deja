# Memory log

Append-only log of decisions and context from nontrivial work sessions. Read before starting nontrivial work; append an entry after.

## 2026-08-09

**NER download owned by us (stall/retry).** Root cause of stuck 0% / hung “downloading”: Transformers hub `readResponse` has no idle timeout — a stalled ~100MB HF stream never fails. Fix: offscreen `fetchWithProgress` (20s stall, 3 attempts, Range resume) + `prefetchNerModel` into `env.customCache`, then `pipeline()`. Live `NER_DOWNLOAD_PROGRESS` messages + Settings stall note (“Still working…” / Start over). Browser Cache API still off for big blobs.

**NER ring flicker (0% spinner ↔ solid %).** Concurrent `void writeNerStatus` RMW let older ticks overwrite newer storage; Settings also applied storage/poll blindly. Fix: serialize writes (like prefs); `mergeNerStatusUi` keeps peak while downloading; ring latches out of indeterminate spin once bytes seen.

**NER `[deja-ner] network network error`.** Chromium resets long ~100MB streams (`TypeError: network error`); `console.error` also badged chrome://extensions Errors. Fix: resolve HF→CDN once, download ONNX in 8MB Range chunks with retries; handled failures log via `console.debug` (no Errors badge); drop useless bare “network error” detail in Settings.

**NER download ring + restore UX.** Progress tracker handles missing Content-Length (HF chunked CDN) via byte asymptote + HF `progress` field; SVG ring uses `<g rotate>`; Settings polls status while downloading (storage onChanged missed rapid ticks → stuck 0%); percent always shown beside ring; `force` reload clears hung `loadPromise`. `writeNerStatus` keeps in-process peak progress. Restore shows green check on success; empty Library offers “Restore from a backup”. Save-strength choice borders use accent intensity tiers. Offscreen swallows content-length `console.warn`; `env.useBrowserCache=false` (Cache API + ~100MB HF blob failed as bare `network error`).

**NER PII (opt-in).** Regex + vault first; optional on-device `Xenova/bert-base-NER` (q8) via Transformers.js in an offscreen document for names + street-like places (confidence ≥ 0.8). Extra Settings toggle for cities/countries (`[city_N]`, default off). Prefs `nerNamesPlaces` (default off); download on demand; no per-capture review. Fail-open if model not ready. Prompt text never uploaded.

**NER CSP lock.** Transformers/ORT still tried jsDelivr for `ort-wasm-….mjs` (esp. Vite dev dep cache + wasmPaths overwrites). Fix: lock `env.backends.onnx.wasm.wasmPaths` to `chrome.runtime.getURL('onnx/')` via defineProperty (reject CDN / incomplete overwrites); exclude transformers from `optimizeDeps`; keep local `public/onnx/` assets. “Unable to determine content-length” from HF downloads is harmless.

**Android app (near-future intent).** Owner plans a mobile Deja so people who live on phones can keep a prompt library — mobile users rarely install browser extensions. Inspiration reference: Grammarly (ubiquitous writing help across surfaces). Implications for current work: keep local-first / no-account; prefer small opt-in downloads (NER) over fat default bundles; don’t couple capture logic to Chrome-only APIs harder than needed; treat extension as one client, shared core (redact/search/classify) as portable. Capture approach on Android TBD (share sheet / paste / etc.). Not fully scoped to build yet.

PII harden (1+2): numbered placeholders (`[email_1]`), Luhn/SSN/IBAN validators, more secret shapes; private `piiVault` for fill-in remember (prefs `rememberHiddenDetails`, never in backups); TemplateFill prefills + “Email 1” labels; Settings remember toggle + forget.

Bulk select UX: sticky bar above the list (count, Select all / Clear selection, × dismiss, Delete N); entry copy “Select a few”; no longer forces Filter & sort open or counts as a filter chip. Card click toggles check; per-card delete/favorite hidden while selecting.

Options/popup responsive harden: narrow options header stacks (logo above nav) so `justify-between` wrap no longer pins Privacy to the viewport edge; shell `px-4 sm:px-6` + `overflow-x: clip`; prompt/md `overflow-wrap: anywhere`; starter cards / blocklist inputs / undo banners / pause row wrap cleanly; code fences still scroll inside the card.

Landing hero brand: dropped duplicate mark under the header logo. Winner from A/B lab — **name in H1**: “Your prompts are work. *deja* keeps them.” Lead no longer repeats “Deja”. Lab harness (`?lab=1`) removed after pick.

## 2026-08-08

Dark Structure pass (mirror light): sunk `#0c0b12` below bg `#12111a`, surface `#1e1d28`, stronger line `#3f3c4a`, clearer soft/faint ink. Synced `globals.css`, site landing/privacy, resurface + toast overlays.

Library cards render markdown when `looksLikeMarkdown` says so (`react-markdown` + `rehype-sanitize`; no syntax highlighter). Storage stays raw strings; popup / templates / starters stay plain. Copy, search, and export unchanged.

Template blanks ignore fenced/inline code and code-looking lines (f-strings, `def`/`return`, …) so `{name}` in snippets no longer opens “Fill in & copy”. Fill-in CTA stays in the card action row; height/padding aligned with icon buttons.

Popup width pin (360px, no document scrollbar) kept after whitespace fix. Subtle hairline under popup search tools. Library find-tools: search + Filter fuse as one **surface** well (not sunk — large sunk on cream read muddy post-Structure); open tray uses sunk; focus = accent border only. Settings More-options filter stays raised.

Soft library size cap (`libraryCap`, default **5000**; choices Off / 2k / 5k / 10k). “Keep at most…” hard-deletes least-used (oldest on ties); favorites never touched. Manual delete: soft for ~6s Undo, then hard-delete; background/options sweep clears leftover tombstones after 60s. Removed “Erase deleted prompts for good” — users had no trash UI and wouldn’t find a second erase step.

Kept warm cream paper; sharpened structure after A/B (Current / Cool / Structure / Hybrid). Winner **Structure**: deeper sunk `#ebe6db`, stronger line `#d0caba`, darker soft/faint ink for secondary + meta on cream. Trial switcher removed. Landing `site/` tokens synced.

Subtle Operate-mode motion across the extension: view enter on nav, capped list stagger, filter/More-options open, card/panel hover lift, button press, copy check pop, pause menu fade. Reduced-motion still collapses animations.

Synced extension chrome with the landing page: 16px cards / 11px controls, indigo page glow, CTA shadow on primary buttons, larger section titles, site-like nav, Welcome steps styled like “how it works” flow cards, popup search matches Library.

Settings + Privacy UI polish: sections in raised panels; suggestion/save-strength as choice cards with hints; site rows with status chips + larger switches; More options matches Library filter disclosure; Privacy gets lock intro + check/never lists + platform rows. Favorites no longer float to the top of Library/popup — only appear when Favorites filter is on.

Library header gets a compact capture-health badge (glowing green “Saving On” / red “Not Saving”) instead of the old per-site strip; click opens Settings. Paused or any broken platform → Not Saving.

Prompt card actions are icon-only: heart Favorite, trash Delete, copy (check after success). Filter & sort Favorites toggle uses the same heart (not pin). `PinIcon` replaced by `ActionIcons.tsx`.

Removed product keyboard shortcuts everywhere: Library ⌘K/`/`/arrows/Enter/Backspace/Esc handler + search `<kbd>` hint, chrome.commands global open binding, PromptCard keyboard-selection highlight. Docs/store/landing copy updated (toolbar icon only). Kept host Enter capture, form Enter-to-commit, PauseControl ARIA menu keys, and resurface Escape-to-dismiss.

Capture health lives only in Settings (“Where Deja works”) now — removed Library’s “Saving on” strip and deleted `CaptureStatus.tsx` so My prompts stays search + list. Settings status copy aligned (“Saving” / “Not yet” / “Needs attention”), broken sites get a danger callout + aria-labels; per-site toggles unchanged. Filter & sort disclosure kept (owner preferred the tucked Library chrome).

## 2026-08-07

Whole-codebase `ce-code-review` (9 reviewers: correctness/testing/maintainability/project-standards/security/reliability/adversarial/agent-native/learnings, run against the diff from the repo's root commit to HEAD since there was no PR/branch to scope against). Security and project-standards came back clean. Fixed everything else that was self-contained and mechanical: `touchUsage`'s get-then-update race (now Dexie `modify()`), `writePrefs`' read-modify-write race on `chrome.storage.local` (now serialized through a module-scope promise chain — same-context only; cross-context is a known, smaller remaining gap), the `PROMPT_CAPTURED` handler's duplicate/near-duplicate check-then-write TOCTOU (now one `db.transaction('rw', db.prompts, ...)`), `readText`/`editableFromEvent` duplicated verbatim between `capture.ts` and `resurface.ts` (extracted to `src/content/shared/editable.ts`), capture-health only reflecting DOM-selector drift and not message-pipeline failures (now also writes unhealthy on `!resp.ok` and on a rejected `sendMessage`), and several fire-and-forget `chrome.*`/clipboard promises that a sync `try/catch` couldn't actually catch. Added the test files the testing reviewer found missing: `captureGate.test.ts`, `prefs.test.ts`, `health.test.ts`, `capture.test.ts` (debounce/dedup), and exported+tested `PauseControl`'s `remainingLabel`. Deliberately left as reported-not-applied: `Settings.tsx`'s 877-line/20-`useState` shape and its and `Library.tsx`'s missing error handling on destructive Dexie actions — both need UI-copy judgment against the `DESIGN.md` voice table, not a mechanical fix.

Separately reviewed `src/lib/similarity.ts` (the resurface "you've been here before" scorer) at the user's specific request. Finding: `search.ts` already has `normalizeTerm`/`SYNONYM_GROUPS` for exact search, but `similarity.ts` uses neither — it scores raw lowercased character trigrams only, so simple rewording that exact-search already handles for free (plurals, spelling, synonyms) still scores near-zero in resurface. Recommended (not implemented — this changes live-tuned scoring behavior, presented as a recommendation pending user go-ahead): reuse `normalizeTerm` before trigram-ing, and/or blend in a word-level content-word signal. Also researched current lightweight-similarity options: MinHash/LSH is the standard fix for the *scaling* problem already flagged in the code's own comments (full pool rescan per keystroke), not the paraphrase-accuracy problem, since it's still lexical; local WASM sentence embeddings are now realistically small (~7MB Ternlight, ~23MB MiniLM via transformers.js) if the deferred `ROADMAP.md` semantic-search item is ever revisited.

## 2026-08-05

Silenced Chrome "modulepreload … not used within a few seconds" on popup/options by setting `build.modulePreload: false` in `vite.config.ts`. Vite was preloading shared chunks (`db`, `prefs`, …) that local extension pages don't benefit from; warn was cosmetic, not a functional bug.

"Type it in for me" resurface click now clears the composer then types the remembered prompt (was insert-at-caret, which left the half-typed draft in place). Settings hint updated to match. Default flipped to insert (was copy); coerce keeps an explicit stored `copy`.

Full Impeccable critique (popup + options + resurface): dual-agent, **28/40** (Good, low). Prior Aug-4 P1s (Welcome re-entry, tag-AND copy) closed. New lead issues: insert-default undertaught at Welcome/overlay, Library filter wall once populated, resurface nested-span a11y. Snapshot under `.impeccable/critique/`.

Critique fix pass (all P1+P2): Welcome teaches replace + undo; insert path confirms like copy; Library filters/sort/bulk behind “Filter & sort” disclosure (platform pills only when multi-site); resurface real buttons + AA meta contrast + cut weak lead; CaptureStatus pairs each site with status text; Pin→Favorite, Privacy confirm wording, Never-save labels, sort “Handy lately”.

Browser-verified the 2026-08-04 Impeccable critique fixes in headed Chrome for Testing with the unpacked `dist/` extension loaded (`--load-extension`; agent-browser's `--extension` flag did not attach Deja — connected via CDP `:9222` instead). Confirmed live: Welcome install view, Settings "Show me how this works again" re-entry, tag-filter AND copy under multi-tag selection, feedback heading emoji without button emoji, pause menu focus-on-open + ArrowDown/Escape return, CaptureStatus broken-state "Check settings" → Settings. Screenshots under `.tmp/browser-verify/` (gitignored). `listPrompts` error UI left as unit-test coverage only — no live DB-failure injection this pass.

## 2026-08-04

Set up workflow rules in CLAUDE.md (goal-loop discipline, subagent usage, review gates, atomic commits, docs-currency requirement) and stubbed the doc map (`docs/README.md`, `docs/ops/`, `docs/corpus-reference/`, this file). No prior entries — this is the log's first.

Ran a full-surface Impeccable UI/UX critique (popup + options: Library, Settings, Privacy, Welcome), scored 32/40. Fixed the top 3 priority issues (Welcome re-entry, tag-filter AND-semantics copy, silent `listPrompts()` load failures), then ran `ce-code-review` over that fix, which caught and fixed a real race condition in the new shared `useAsyncList` hook plus a render-site bug where a failed background refresh blanked an already-loaded list. Follow-up pass cleared the rest of the critique's backlog: emoji density (Settings feedback section, Privacy heading, Welcome closing line), the `.json`-in-copy leak, a clinical drawer subtitle, the pause-menu's ARIA-menu keyboard contract (roving arrow keys, focus-on-open, focus-return-on-Escape), the bulk-select checkbox's tap-target size, and a one-way link gap between Library's `CaptureStatus` and Settings (added a "Check settings" link that appears only when a platform is actually broken).
