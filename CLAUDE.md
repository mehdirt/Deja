# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation map

- `README.md` — project overview, install, usage.
- `DESIGN.md` — voice table, UI/copy rules.
- `docs/README.md` — index into the doc suite (`docs/plans/`, `docs/ops/`, `docs/corpus-reference/`).
- `docs/plans/` — dated implementation plans.
- `docs/ops/` — operational runbooks.
- `docs/corpus-reference/` — prompt corpora / fixture reference material.
- `MEMORY/LOG.md` — append-only decision log. **Read before nontrivial work; append an entry after.**

## Workflow rules

1. **Set explicit goal, loop it.** Nontrivial task → state goal, break into tracked steps (TaskCreate), work loop to completion. No partial passes.
2. **Use subagents when it genuinely helps.** Independent research, parallel investigation, batch content generation. Brief with full context — subagent starts cold, no memory of this conversation.
3. **Review subagent output before trusting it.** Check the actual diff/result, not just the summary.
4. **Whole-system review before done.** Run the code-review skill (or `compound-engineering:ce-code-review` for deeper) over the full diff before calling work finished.
5. **Commit atomically at the end.** One commit per logical unit, not one giant bundle. Standing authorization to commit without asking each time — does NOT cover force-push, amending published commits, or other destructive ops.
6. **Keep docs current.** Anything touching architecture/API/DB schema/config/deployment/auth must update the matching `docs/` file (or at minimum a dated `MEMORY/LOG.md` entry) in the same body of work.

Always have an eye on: clean code, best practices, documenting, commenting, logging and error handling, design patterns, optimized algorithms and suitable data structures, system architecture and design.

## What this is

Deja is a Manifest V3 Chrome extension that **passively saves the prompts** sent on ChatGPT, Claude, Gemini, DeepSeek, and Grok into a local, searchable library. v1 is intentionally lean: no LLM calls, no backend, no accounts. Everything lives in IndexedDB on the user's machine.

## Who it's for (read this before touching the UI)

Deja is built for **everyday AI users who don't write code** — someone drafting an awkward email, planning a trip, learning something new. It is explicitly *not* aimed at engineers running coding agents; that audience already has memory files, rules, and skills built into their tools, and early feedback confirmed Deja adds little for them.

Practical consequences, which the code is expected to honor:

- **Warm, cozy, and guiding — not technical.** Everyday users should feel comfortable the whole time, like a kind friend is showing them around. Lead with what happens next in ordinary words; prefer reassurance over precision on the first screen. A welcome greeting (with 🤗) on first install is intentional; light emoji on empty states, tip headings, and starter categories is fine — don't decorate every button or settings control.
- **Plain language beats precise jargon.** "Never save from…" not "blocklist". "Download a backup" not "export JSON". The full mapping is the voice table in `DESIGN.md` — follow it.
- **Sentence case, sans-serif.** The lowercase `deja` wordmark uses bundled Literata (`font-brand`). Monospace is reserved for `[email]` placeholders, hostnames, and pattern rules. Prompt bodies use `.dj-prompt`; metadata uses `.dj-meta`.
- **Technical controls stay, but move down.** Regex rules, per-category redaction, file import, and permanent erase all still exist — inside the collapsed *More options* drawer in settings. Don't delete power; don't lead with it.
- **Fonts are bundled** in `src/assets/fonts/` and declared in `globals.css`. Never reference a family the repo doesn't ship (that bug shipped once already).

## Commands

```bash
npm install         # one-time
npm run dev         # Vite dev build with HMR; load `dist/` as an unpacked extension at chrome://extensions
npm run build       # production build to dist/ (runs tsc --noEmit first)
npm run typecheck   # tsc --noEmit only
npm run lint        # ESLint over src
npm run test        # vitest run (one-shot)
npm run test:watch  # vitest in watch mode
```

Run a single test file: `npx vitest run src/lib/similarity.test.ts`

**CI** (`.github/workflows/ci.yml`) runs typecheck + lint + test + build on every push/PR and uploads `dist/` as an artifact. Tests use Vitest + happy-dom; colocate `*.test.ts` next to `src/lib/` modules.

## Loading the extension locally

1. `npm run build` (or `npm run dev` for HMR)
2. Open `chrome://extensions`, enable Developer mode
3. "Load unpacked" → select the `dist/` directory
4. Visit chatgpt.com, claude.ai, gemini.google.com, chat.deepseek.com, or grok.com and send a prompt; it should appear in the popup

## Architecture

Four execution contexts, all in TypeScript, bundled by Vite via `@crxjs/vite-plugin`:

- **Content scripts** (`src/content/<platform>/index.ts`) — one per supported site. Each one's only job is to locate the prompt input element with a site-specific selector and hand it to `attachSubmitHook` from `src/content/shared/capture.ts`. The shared helper watches for Enter keypresses and clicks on send-like buttons, debounces duplicates within 2 s, and `chrome.runtime.sendMessage`s a `PROMPT_CAPTURED` payload. Capture and resurface also consult `src/content/shared/captureGate.ts` — a synchronous, fail-open snapshot of pause / per-site / incognito state so the hot path adds no latency (incognito auto-pause is the one deliberate fail-*closed* case). Resurface dismissal is query-scoped (`src/content/shared/resurface.ts`).
- **Background service worker** (`src/background/index.ts`) — listens for `PROMPT_CAPTURED`, runs PII redaction → classify → near-dup collapse, then writes to Dexie. The service worker is the *only* writer to the DB from outside the UI.
- **Popup** (`src/popup/`) — small React app: pause control, search box + recent. Opens the options page for the full library.
- **Options page** (`src/options/`) — full-page React app with four views selected by one bit of state (no router): `Library`, `Settings`, `Privacy`, and `Welcome`. The welcome view is the post-install onboarding; the background worker opens `src/options/index.html?welcome=1` once, on `onInstalled` with `reason === 'install'`. It lives here rather than as its own page so there are still only two HTML entry points.

Shared core lives under `src/lib/`:

- `db.ts` — Dexie schema (single `prompts` table) and all CRUD. Library delete is soft for a short Undo window (`deletedAt`), then hard-deleted; a wake/open sweep clears leftover tombstones. Hard-delete also used for undo-capture, library-cap trim, and "clear all".
- `search.ts` — MiniSearch fuzzy index, rebuilt in-memory from the current list of prompts. Two layers on top handle the fact that people half-remember their own wording: `normalizeTerm` folds plurals and British/American spellings at index *and* query time, and `expandQuery` adds everyday synonyms as a **second** search pass whose hits are appended after the literal ones (so precision is untouched). This is not semantic search — paraphrases still need embeddings; see `ROADMAP.md`.
- `template.ts` — fill-in-the-blank prompts. Finds `{topic}`-style blanks plus the `[email]` placeholders PII redaction leaves behind, and fills them in a single pass. Deliberately not a template language: no defaults, conditionals, or escaping. The tight brace pattern exists so JSON and CSS in a prompt don't sprout input boxes.
- `starter.ts` — a fixed, hand-written set of everyday example prompts shown **only** while the library is empty. Not generated, not ranked, never written to the DB. This is a worked example on a blank page, not the "prompt of the day" the roadmap rules out.
- `similarity.ts` — IDF-weighted trigram similarity with a length-aware threshold, powering the "You've Been Here Before" resurface tooltip (wired via the background worker's `SIMILAR_QUERY` handler → `src/content/shared/resurface.ts`).
- `ranking.ts` — usefulness score (usage × recency) for the library's "most useful" sort.
- `classify.ts` — selective-capture classifier: skips storing throwaway prompts by strength (`off`/`balanced`/`strict`). Pure; runs at capture time in the background worker. `hasSubstance()` judges value in **everyday** terms as well as technical ones — a specified tone, audience, format, length, or a real question rescues a short prompt, exactly as a code fence does. Don't let this drift back to code-only signals. Two rules that are load-bearing and easy to undo by accident: a word only belongs in `FILLER` if it is meaningless alone **and** can't be the backbone of a clause (listing the interrogatives there once made "what is this" and "how do i do this" vanish), and the `reason` a prompt was skipped travels out in `CaptureResponse` because the page treats the two differently — `trivial` glue stays quiet, a `strict`-only `short` skip is offered back with a *Keep it* button that hand-saves through `SAVE_MANUAL`. A skip is permanent, so the strength that makes a judgment call has to offer the call back.
- `pii.ts` — local PII detection + redaction (regex + Luhn/SSN/IBAN checks, known secret shapes). Replaces detected personal info with numbered labels (`[email_1]`, `[card_1]`, …) BEFORE storage. Optional `piiVault.ts` remembers originals for Fill-in only. On by default for structured kinds (per-category togglable in prefs). Runs in the background `PROMPT_CAPTURED` handler and also on the resurface query so both sides match. On-device NER for names / streets is postponed.
- `prefs.ts` — user preferences in `chrome.storage.local`: resurface click (copy/insert), filter strength, pause state (`pauseUntil`), per-site capture switches, incognito auto-pause, PII on/off + per-category `piiKinds`. `writePrefs` merges partial updates.
- `feedback.ts` — user-initiated feedback links (prefilled GitHub Issues, or optional hosted form via `FEEDBACK_URL`). Not telemetry; nothing is sent automatically.
- `health.ts` — per-platform capture-health storage/signals (the content-side probe lives in `src/content/shared/health.ts`).
- `sensitive.ts` — capture-eligibility: rejects password/OTP/credential and non-composer fields, and minimizes captured URLs.
- `blocklist.ts` — user blocklist (domains + regex) storage/matching (the content-side sync cache lives in `src/content/shared/blocklist.ts`).
- `markdown.ts` — Markdown export. `restoreBackup.ts` — JSON import/restore. `format.ts` — text/relative-time helpers, plus `conversationUrl()`, which returns a link back to the original chat only when the captured URL actually points at a conversation (a prompt sent as the first message of a new chat is captured before the site assigns one, so the path is bare and the link would just reload the homepage).
- `types.ts` — `Prompt`, `Platform`, the runtime message/response shapes, and `PLATFORM_LABEL` / `PLATFORM_COLOR`.
- `libraryCap.ts` — enforces the library size cap, trimming oldest rows past the limit. `promptFormat.ts` — detects markdown-ish prompt bodies so the library can render them accordingly.

The in-page surfaces (everything Deja renders inside a chat site) share modules under `src/content/shared/`:

- `overlayTheme.ts` — the palette and primitives for every overlay, plus `createOverlayHost()`. Shadow roots are **closed** (an open root is readable by any script on the host page, and these surfaces render library rows). Tokens are declared on `:host`, mirroring `globals.css` — change both in the same commit. See the *In-page surfaces* section of `DESIGN.md`.
- `anchor.ts` — positioning and viewport clamping, shared by the tooltip, dot, panel, and picker.
- `presence.ts` / `picker.ts` / `blanks.ts` — the ambient dot and its panel, the `//` picker, and the shared fill-in step.
- `toast.ts` — the one-time skip-explanation and "Keep it" action toast shown after a capture is filtered.
- `libraryRows.ts` — renders library-row markup shared by the dot's panel and the `//` picker. `editable.ts` — reads/writes text in a site's composer element across contentEditable and `<textarea>` shapes. `message.ts` — typed wrapper over `chrome.runtime.sendMessage` for the content-script side.

Two rules those surfaces follow that aren't obvious from the code:

- **Saving off is not reading off.** Pause and the per-site switch mean "don't record what I type"; they dim the dot but leave the library readable. Incognito auto-pause and a blocklisted domain remove the surfaces entirely — those are the fail-closed cases. A *write* (the hand-save) stays blocked in all of them.
- **`isTrusted` gates the two triggers that open a library-reading surface** (the dot's click, the `//` trigger) — a hostile page script can forge events. It deliberately does **not** gate capture: site frameworks legitimately emit synthetic input, and refusing those would mean silently failing to save someone's prompt.

The path alias `@/` resolves to `src/` (configured in `tsconfig.json` and `vite.config.ts` — keep them in sync).

## Things to keep in mind when editing

- **Site selectors break.** Every supported site (ChatGPT, Claude, Gemini, DeepSeek, Grok) changes its DOM regularly. Selectors live in `src/content/<platform>/index.ts` so they're easy to update; resist scattering them elsewhere. A per-platform capture-health signal (`src/lib/health.ts`) flags silent breakage in the library.
- **Never block the host page.** The content scripts must fail silently. `sendCapture` already swallows runtime errors; preserve that.
- **Local-first is a feature, not an oversight.** Do not add network calls, telemetry, or third-party services without an explicit user-facing opt-in. Cloud sync, LLM scoring, and auto-categorization were intentionally deferred from v1 — see the concept doc for the deferred roadmap.
- **Capture only the prompt text.** v1 does not record AI responses; don't add that without a product decision.
- **MV3 service workers are short-lived.** Don't keep state in module scope in `src/background/`; persist through Dexie. The one sanctioned exception is `src/background/pool.ts`, a cache that is *safe to lose*: losing it on worker death costs one re-read and nothing else. Anything whose loss would change behaviour still belongs in Dexie.

- **Plain language is load-bearing, not cosmetic.** Renaming "capture" to "save" isn't polish — the vocabulary is what tells a non-technical person whether a product is for them. When adding UI, check the voice table in `DESIGN.md` before inventing a label.

## What is intentionally NOT in v1

LLM-based scoring, auto-categorization, streaks, "prompt of the day", score trends, cloud sync, accounts, team vaults, prompt chaining, mobile companion. If asked to add any of these, push back or scope it as a separate v2 ticket.

Semantic (embedding-based) search is deferred rather than rejected — see `ROADMAP.md`. The lexical normalisation and synonym expansion in `search.ts` are the cheap half; the model is a real decision about bundle size, not a tweak.
