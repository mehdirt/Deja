# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PromptShelf is a Manifest V3 Chrome extension that **passively captures prompts** sent on ChatGPT, Claude, and Gemini and stores them in a local, searchable library. v1 is intentionally lean: no LLM calls, no backend, no accounts. Everything lives in IndexedDB on the user's machine.

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

There is no CI yet and no test framework conventions beyond Vitest + happy-dom.

## Loading the extension locally

1. `npm run build` (or `npm run dev` for HMR)
2. Open `chrome://extensions`, enable Developer mode
3. "Load unpacked" → select the `dist/` directory
4. Visit chatgpt.com, claude.ai, or gemini.google.com and send a prompt; it should appear in the popup

## Architecture

Four execution contexts, all in TypeScript, bundled by Vite via `@crxjs/vite-plugin`:

- **Content scripts** (`src/content/<platform>/index.ts`) — one per supported site. Each one's only job is to locate the prompt input element with a site-specific selector and hand it to `attachSubmitHook` from `src/content/shared/capture.ts`. The shared helper watches for Enter keypresses and clicks on send-like buttons, debounces duplicates within 2 s, and `chrome.runtime.sendMessage`s a `PROMPT_CAPTURED` payload.
- **Background service worker** (`src/background/index.ts`) — listens for `PROMPT_CAPTURED` and writes to Dexie. The service worker is the *only* writer to the DB from outside the UI.
- **Popup** (`src/popup/`) — small React app: search box + top 5 recent. Opens the options page for the full library.
- **Options / Library page** (`src/options/`) — full-page React app: search, platform filter, copy, soft-delete, JSON export.

Shared core lives under `src/lib/`:

- `db.ts` — Dexie schema (single `prompts` table) and all CRUD. Soft-delete via `deletedAt`; never hard-delete.
- `search.ts` — MiniSearch fuzzy index, rebuilt in-memory from the current list of prompts.
- `similarity.ts` — trigram Jaccard similarity, used for the "You've Been Here Before" feature (not yet wired into a content-script UI in v1).
- `types.ts` — `Prompt`, `Platform`, and the `CapturedPromptMessage` shape used across contexts.

The path alias `@/` resolves to `src/` (configured in `tsconfig.json` and `vite.config.ts` — keep them in sync).

## Things to keep in mind when editing

- **Site selectors break.** ChatGPT/Claude/Gemini change their DOM regularly. Selectors live in `src/content/<platform>/index.ts` so they're easy to update; resist scattering them elsewhere.
- **Never block the host page.** The content scripts must fail silently. `sendCapture` already swallows runtime errors; preserve that.
- **Local-first is a feature, not an oversight.** Do not add network calls, telemetry, or third-party services without an explicit user-facing opt-in. Cloud sync, LLM scoring, and auto-categorization were intentionally deferred from v1 — see the concept doc for the deferred roadmap.
- **Capture only the prompt text.** v1 does not record AI responses; don't add that without a product decision.
- **MV3 service workers are short-lived.** Don't keep state in module scope in `src/background/`; persist through Dexie.

## What is intentionally NOT in v1

LLM-based scoring, auto-categorization, streaks, "prompt of the day", score trends, cloud sync, accounts, team vaults, prompt chaining, mobile companion. If asked to add any of these, push back or scope it as a separate v2 ticket.
