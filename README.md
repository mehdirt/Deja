# Deja

**Your personal prompt library — organized automatically, always within reach.**

Deja is a Manifest V3 Chrome extension that **passively captures** every prompt you send to ChatGPT, Claude, Gemini, DeepSeek, and Grok, and stores it in a local, searchable library. No copy-paste, no accounts, no cloud — everything lives in IndexedDB on your machine.

The prompts you write are work. Most of them vanish into a scrolled-away chat the moment you hit Enter. Deja keeps them, makes them findable, and quietly resurfaces the right one *while you're typing the next.*

> Status: **v0.2.0** — trustworthy capture plus the resurface moment. Capture is credential-safe and self-monitoring, the library is fully featured, and the "you've been here before" in-context tooltip is live. See [ROADMAP.md](ROADMAP.md) for the phased plan.

## Supported sites

| Platform | Host(s) |
| --- | --- |
| ChatGPT | `chatgpt.com`, `chat.openai.com` |
| Claude | `claude.ai` |
| Gemini | `gemini.google.com` |
| DeepSeek | `chat.deepseek.com` |
| Grok | `grok.com` |

Site DOMs change often, so each platform uses an ordered list of selector fallbacks, and a per-site **capture-health** signal flags silent breakage in the library before you'd ever notice missing prompts.

## Features

**Capture you can trust**
- Passive capture on Enter and on send-button clicks; duplicate submits within ~2 s are de-duplicated.
- **Never captures credentials** — password / OTP / payment / non-composer fields are refused, and captured URLs are minimized to origin + path.
- Per-platform capture-health, surfaced in the library and settings, so a broken selector is visible to you (and never leaks to the host page).
- Multi-line prompts and code blocks keep their formatting.

**The resurface moment — "you've been here before"**
- As you type (debounced), a gentle tooltip floats above the input when you've asked something similar before.
- Uses **IDF-weighted trigram similarity** with a length-aware threshold — distinctive words count more than boilerplate, and short queries are held to a higher bar.
- Shows *why* it matched ("matched on …") and lets you **step through multiple candidates**.
- Click to **copy** the old prompt — it never auto-fills your textarea. Dismissible per session; it never nags.

**A library that organizes itself**
- Fuzzy search (MiniSearch) in both the popup and the full library page.
- Platform filter, manual **tags** with multi-tag filtering, **pin** to top, a **favorites** view, and **bulk select/delete**.
- Sorts: newest · most useful (usage × recency) · most used · longest unseen.
- Copy-to-clipboard with usage tracking; **soft-delete with undo**.

**Yours to keep**
- **Export / import JSON** (round-trips), plus **Markdown export**.
- Settings: clear all data, and a blocklist of **domains and regex patterns** to never capture.
- An in-extension **privacy page** stating exactly what is and isn't collected (nothing leaves your machine).

## Install (load unpacked)

```bash
npm install
npm run build
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `dist/` directory.

Send a prompt on any supported site, then click the Deja toolbar icon (or press **⌘⇧K** / **Ctrl+Shift+K**) to see it.

## Develop

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev build with HMR; load `dist/` as an unpacked extension |
| `npm run build` | Production build to `dist/` (runs `tsc --noEmit` first) |
| `npm run typecheck` | `tsc --noEmit` only |
| `npm run lint` | ESLint over `src` |
| `npm run test` | Vitest run (one-shot) — 75 unit tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run format` | Prettier over `src` |

Run a single test file: `npx vitest run src/lib/similarity.test.ts`

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘⇧K` / `Ctrl+Shift+K` | Open Deja (global) |
| `⌘K` / `Ctrl+K` or `/` | Focus search (library) |
| `↑` / `↓` | Move selection |
| `Enter` | Copy selected prompt |
| `⌫` / `Delete` | Soft-delete selected |
| `Esc` | Clear search / exit |

## How it works

Four execution contexts, all TypeScript, bundled by Vite via `@crxjs/vite-plugin`:

- **Content scripts** (`src/content/<platform>/index.ts`) — one per site. Each locates the prompt input via its selector fallbacks and wires up capture, the resurface tooltip, the health probe, and the blocklist sync. They fail silently and never block the host page.
- **Background service worker** (`src/background/index.ts`) — the only writer to IndexedDB from outside the UI; also answers similarity queries for the resurface tooltip.
- **Popup** (`src/popup/`) — search + recent, with pinned prompts on top.
- **Options / Library** (`src/options/`) — the full library, settings, and privacy page.

Shared core lives in `src/lib/` (Dexie schema + CRUD, MiniSearch index, trigram similarity, ranking, capture-eligibility, blocklist, health, export/format). See [CLAUDE.md](CLAUDE.md) for the full module map and contributor guidance, and [DESIGN.md](DESIGN.md) for the visual system.

## Privacy & security

Local-first is the product, not a footnote: **no network calls, no telemetry, no accounts, no cloud.** Only the prompt text you type is stored — never the AI's replies, never credentials. You can export, blocklist, or wipe everything at any time. Details in the in-extension privacy page and [SECURITY.md](SECURITY.md).

## What's not here

**Deferred** — may arrive later, decided from real usage (see [ROADMAP.md](ROADMAP.md) Phase 6+): semantic, embeddings-based paraphrase matching; optional bring-your-own-key LLM helpers (improve-a-prompt, auto-tag suggestions); an activity heatmap; prompt chaining; encrypted cloud sync; and team/shared vaults.

**Deliberately excluded, on principle** — not coming: 0–100 prompt "scores", streaks and gamification, AI-generated "prompt of the day", and anything that requires reading your prompts on a server. See [CONCEPT.md](CONCEPT.md) for the reasoning.

## Tech stack

Vite · React 18 · TypeScript · Tailwind CSS · Dexie (IndexedDB) · MiniSearch · `@crxjs/vite-plugin` · Vitest + happy-dom.

## License

Not yet licensed — private project for now.
