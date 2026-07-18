# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Deja is a Manifest V3 Chrome extension that **passively captures prompts** sent on ChatGPT, Claude, Gemini, DeepSeek, and Grok and stores them in a local, searchable library. v1 is intentionally lean: no LLM calls, no backend, no accounts. Everything lives in IndexedDB on the user's machine.

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
- **Popup** (`src/popup/`) — small React app: pause control, search box + recent/pinned. Opens the options page for the full library.
- **Options / Library page** (`src/options/`) — full-page React app: search, platform filter, tags, pins, favorites, soft-delete, JSON/Markdown export+import, settings (capture controls, PII, blocklist, feedback), and privacy.

Shared core lives under `src/lib/`:

- `db.ts` — Dexie schema (single `prompts` table) and all CRUD. Default delete is soft (`deletedAt` tombstone, undoable); hard-delete is reserved for undo-capture and the explicit "purge deleted" / "clear all" actions.
- `search.ts` — MiniSearch fuzzy index, rebuilt in-memory from the current list of prompts.
- `similarity.ts` — IDF-weighted trigram similarity with a length-aware threshold, powering the "You've Been Here Before" resurface tooltip (wired via the background worker's `SIMILAR_QUERY` handler → `src/content/shared/resurface.ts`).
- `ranking.ts` — usefulness score (usage × recency) for the library's "most useful" sort.
- `classify.ts` — selective-capture classifier: skips storing throwaway "minor" prompts by strength (`off`/`balanced`/`strict`). Pure; runs at capture time in the background worker.
- `pii.ts` — local PII detection + redaction (regex + Luhn-checked cards, known secret shapes). Replaces detected personal info with labels (`[email]`, `[card]`, …) BEFORE storage. On by default (per-category togglable in prefs). Pure; runs first in the background `PROMPT_CAPTURED` handler and also on the resurface query so both sides match.
- `prefs.ts` — user preferences in `chrome.storage.local`: resurface click (copy/insert), filter strength, pause state (`pauseUntil`), per-site capture switches, incognito auto-pause, PII on/off + per-category `piiKinds`. `writePrefs` merges partial updates.
- `feedback.ts` — user-initiated feedback links (prefilled GitHub Issues, or optional hosted form via `FEEDBACK_URL`). Not telemetry; nothing is sent automatically.
- `health.ts` — per-platform capture-health storage/signals (the content-side probe lives in `src/content/shared/health.ts`).
- `sensitive.ts` — capture-eligibility: rejects password/OTP/credential and non-composer fields, and minimizes captured URLs.
- `blocklist.ts` — user blocklist (domains + regex) storage/matching (the content-side sync cache lives in `src/content/shared/blocklist.ts`).
- `markdown.ts` — Markdown export. `import.ts` — JSON import. `format.ts` — text/relative-time formatting helpers.
- `types.ts` — `Prompt`, `Platform`, the runtime message/response shapes, and `PLATFORM_LABEL` / `PLATFORM_COLOR`.

The path alias `@/` resolves to `src/` (configured in `tsconfig.json` and `vite.config.ts` — keep them in sync).

## Things to keep in mind when editing

- **Site selectors break.** Every supported site (ChatGPT, Claude, Gemini, DeepSeek, Grok) changes its DOM regularly. Selectors live in `src/content/<platform>/index.ts` so they're easy to update; resist scattering them elsewhere. A per-platform capture-health signal (`src/lib/health.ts`) flags silent breakage in the library.
- **Never block the host page.** The content scripts must fail silently. `sendCapture` already swallows runtime errors; preserve that.
- **Local-first is a feature, not an oversight.** Do not add network calls, telemetry, or third-party services without an explicit user-facing opt-in. Cloud sync, LLM scoring, and auto-categorization were intentionally deferred from v1 — see the concept doc for the deferred roadmap.
- **Capture only the prompt text.** v1 does not record AI responses; don't add that without a product decision.
- **MV3 service workers are short-lived.** Don't keep state in module scope in `src/background/`; persist through Dexie.

## What is intentionally NOT in v1

LLM-based scoring, auto-categorization, streaks, "prompt of the day", score trends, cloud sync, accounts, team vaults, prompt chaining, mobile companion. If asked to add any of these, push back or scope it as a separate v2 ticket.
