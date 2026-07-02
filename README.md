# Deja

**Your personal prompt library — organized automatically, always within reach.**

Deja is a Manifest V3 Chrome extension that **passively captures** every prompt you send to ChatGPT, Claude, Gemini, DeepSeek, and Grok and stores it in a local, searchable library. No copy‑paste, no accounts, no cloud — everything lives in IndexedDB on your machine.

The prompts you write are work. Most of them vanish into a scrolled‑away chat the moment you hit Enter. Deja keeps them, makes them findable, and quietly **resurfaces the right one while you're typing the next**.

> **Status: v0.3.0** — trustworthy capture plus the resurface moment, now with selective capture (short throwaways are filtered but recoverable) and capture controls (one‑click pause, per‑site switches, filter strength, blocklist test + dry‑run, and on‑device PII redaction). Capture is credential‑safe and self‑monitoring, the library is fully featured, and the "you've been here before" in‑context tooltip is live. See [ROADMAP.md](ROADMAP.md) for the phased plan.

---

## Contents

- [Why Deja](#why-deja)
- [Supported sites](#supported-sites)
- [Features](#features)
- [Install (load unpacked)](#install-load-unpacked)
- [Using Deja](#using-deja)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Architecture & how it works](#architecture--how-it-works)
- [Privacy & security](#privacy--security)
- [Development](#development)
- [Extending Deja](#extending-deja)
- [Roadmap & future landscape](#roadmap--future-landscape)
- [Deploying & launching](#deploying--launching)
- [Tech stack](#tech-stack)
- [Project documents](#project-documents)
- [License](#license)

---

## Why Deja

Every frequent AI user hits the **prompt graveyard**: you craft a perfect prompt, get a great result, and then it's gone — buried in a history you'll never scroll back through. Deja fixes that with two ideas:

1. **The library is plumbing.** Capture happens automatically, on every supported site, with zero effort. You never click "save."
2. **The resurface moment is the product.** The instant you start re‑asking something, your older, better version floats up in‑context — like a password manager appearing at the login box, not a notebook you have to remember to open.

**Why it's defensible:** any single lab could ship a "save prompt" button tomorrow — but none will let your prompt history follow you *out* of its walled garden into a competitor's. Deja is the prompt layer that rides *above* whichever model wins: your accumulated craft, portable, private, and yours. The one‑liner: **your prompts, every AI, one library.**

---

## Supported sites

| Platform | Host(s) |
| --- | --- |
| ChatGPT | `chatgpt.com`, `chat.openai.com` |
| Claude | `claude.ai` |
| Gemini | `gemini.google.com` |
| DeepSeek | `chat.deepseek.com` |
| Grok | `grok.com` |

Site DOMs change often, so each platform uses an **ordered list of selector fallbacks**, and a per‑site **capture‑health** signal flags silent breakage in the library before you'd ever notice missing prompts.

---

## Features

### Capture you can trust
- Passive capture on **Enter** and on **send‑button** clicks; duplicate submits within ~2 s are de‑duplicated.
- **Never captures credentials** — password / OTP / payment / non‑composer fields are refused, and stored URLs are minimized to origin + path.
- **Capture‑health** per platform, surfaced in the library and settings, so a broken selector is visible to *you* and never leaks to the host page.
- **PII redaction (on by default)** — detected personal info (emails, phone numbers, credit cards, SSNs, IPs, API keys/secrets) is replaced with labels like `[email]` *before* the prompt is stored, so raw values never touch your library or exports. Per‑category toggles, a live test box, and a scan‑and‑redact for already‑captured prompts live in settings. Redaction is local, deterministic, and turns prompts into reusable templates (names/addresses need on‑device NER — deferred).
- Multi‑line prompts and code blocks keep their formatting.

### The resurface moment — "you've been here before"
- As you type (debounced ~400 ms), a gentle tooltip floats **above the input** when you've asked something similar before.
- Powered by **IDF‑weighted trigram similarity** with a length‑aware threshold — distinctive words count more than boilerplate, and short queries are held to a higher bar.
- Shows *why* it matched ("matched on …") and lets you **step through multiple candidates**; offers "see all" in the library when there are more.
- Click to **copy** by default — or opt into **insert‑at‑cursor** in settings. It never silently auto‑fills, and never overwrites what you've typed. Dismissible per session; it never nags.

### Selective capture — keep the keepers
- A local, zero‑LLM classifier flags **"minor"** prompts (bare follow‑ups like "yes" / "continue", tiny fragments with no code, URL, structure, or length).
- **Soft capture, never a silent drop:** minor prompts are still stored, just hidden from the library and resurface by default — surfaced under **`filtered (N)`** with a one‑click **keep** to promote any back.
- **Filter strength** is a setting: `off` (keep everything) · `balanced` (default — only obvious throwaways) · `strict` (only longer / structured prompts).

### Capture controls — what gets recorded is yours
- **Pause capture** from the popup: for **1 hour** or **until you resume**, with a live countdown and a toolbar badge. Capture resumes on its own.
- **Per‑site switches** folded into the capture‑health view — turn capture off on any site.
- **Auto‑pause in incognito** by default.
- **Blocklist** of **domains** and **regex patterns** that are never captured — with a live **"test a prompt against your rules"** box and a **"preview impact on saved prompts"** dry‑run, so a too‑broad rule is visible before you trust it.

### A library that organizes itself
- Fuzzy search (MiniSearch) in both the popup and the full library page.
- Platform filter, manual **tags** with multi‑tag filtering, **pin** to top, a **favorites** view, and **bulk select / delete**.
- Sorts: newest · most useful (usage × recency) · most used · longest unseen.
- Copy‑to‑clipboard with usage tracking; **soft‑delete with undo**.

### Yours to keep
- **Export / import JSON** (round‑trips), plus **Markdown export**.
- Settings: clear all data, purge soft‑deleted rows, and the blocklist above.
- An in‑extension **privacy page** stating exactly what is and isn't collected.

---

## Install (load unpacked)

Until the Chrome Web Store listing is live, run it locally:

```bash
npm install
npm run build      # production build → dist/
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top‑right)
3. Click **Load unpacked** and select the `dist/` directory

Send a prompt on any [supported site](#supported-sites), then click the Deja toolbar icon (or press **⌘⇧K** / **Ctrl+Shift+K**) to see it land.

> For live development use `npm run dev` instead of `npm run build` — Vite rebuilds `dist/` on save (reload the extension at `chrome://extensions` to pick up changes).

---

## Using Deja

- **Just work.** Prompt on any supported site as you normally do. Each prompt is saved the moment you hit Enter — a brief "remembered · undo" toast confirms it.
- **Reuse in‑context.** Start typing something you've asked before; when the tooltip appears, click it to copy your earlier version (or step through `1/3` matches with `›`).
- **Browse the popup.** The toolbar icon opens a search box + recent prompts (pinned first). Hit `library →` for the full page.
- **Curate the library.** Search, filter by platform/tag, pin favorites, tag prompts, bulk‑delete, and sort by usefulness. Deleted prompts are undoable.
- **Control capture.** Use **⏸ pause** in the popup before a private session; switch off a site or set filter strength in **settings**; add blocklist rules for anything secret.
- **Take your data.** Export JSON or Markdown anytime; import a JSON export back; clear everything from settings.

---

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘⇧K` / `Ctrl+Shift+K` | Open Deja (global) |
| `⌘K` / `Ctrl+K` or `/` | Focus search (library) |
| `↑` / `↓` | Move selection (library) |
| `Enter` | Copy selected prompt |
| `⌫` / `Delete` | Soft‑delete selected |
| `Esc` | Clear search / dismiss tooltip |

> The global `⌘⇧K` is a *suggested* binding; Chrome occasionally leaves it unassigned to avoid conflicts. Confirm or rebind it at `chrome://extensions/shortcuts`.

---

## Architecture & how it works

Deja runs entirely on the client across **four execution contexts**, all TypeScript, bundled by Vite via [`@crxjs/vite-plugin`](https://github.com/crxjs/chrome-extension-tools). There is **no backend**.

```
        ┌──────────────────── host page (chatgpt.com, claude.ai, …) ─────────────────────┐
        │  content scripts (isolated world)                                               │
 you ─► │    capture.ts      ──PROMPT_CAPTURED──►┐    resurface.ts ──SIMILAR_QUERY──►┐     │
 type   │    captureGate.ts · blocklist cache · health probe   (read-only, debounced)│     │
        └────────────────────────────────────────┼────────────────────────────────-─┼────┘
                                                  │ chrome.runtime messaging         │
                                                  ▼                                  ▼
                              background service worker  (src/background/index.ts)
                                • classify + savePrompt ──────────────►  IndexedDB (Dexie)
                                • findSimilar over the prompt pool  ◄────  IndexedDB
                                • pause badge via chrome.action + alarms
                                                  ▲
                                                  │ Dexie (same extension origin)
                       popup & options (React)  ──┘  search · tag · pin · export · settings
```

- **Content scripts** — `src/content/<platform>/index.ts`, one per site. Each resolves the prompt composer via its selector fallbacks and wires up four shared helpers from `src/content/shared/`:
  - `capture.ts` — watches Enter / send clicks, debounces duplicates, checks the gate + blocklist, and sends `PROMPT_CAPTURED`.
  - `resurface.ts` — debounced similarity queries, the Shadow‑DOM tooltip, copy / insert.
  - `captureGate.ts` — a synchronous, fail‑open snapshot of pause / per‑site / incognito state for the hot path.
  - `health.ts` — the capture‑health probe.
  They **fail silently and never block the host page.**
- **Background service worker** — `src/background/index.ts`. The only writer to IndexedDB from outside the UI. Handles `PROMPT_CAPTURED` (redact PII → classify → store), `SIMILAR_QUERY` (score the pool → top matches), `OPEN_LIBRARY`, and `UNDO_CAPTURE`, and paints the pause badge. MV3 workers are short‑lived, so it keeps no state in module scope — everything persists through Dexie / `chrome.storage`.
- **Popup** — `src/popup/`. Search + recent prompts (pinned first) + pause control.
- **Options / Library** — `src/options/`. The full library, settings, and privacy page.

**Shared core** lives in `src/lib/` (pure, unit‑tested):

| Module | Responsibility |
| --- | --- |
| `db.ts` | Dexie schema (single `prompts` table) + all CRUD; soft‑delete, import/export |
| `types.ts` | `Prompt`, `Platform`, runtime message shapes, `PLATFORM_LABEL` / `PLATFORM_COLOR`, `FilterStrength` |
| `search.ts` | MiniSearch fuzzy index, rebuilt in‑memory |
| `similarity.ts` | IDF‑weighted trigram similarity + length‑aware threshold (resurface) |
| `classify.ts` | Selective‑capture classifier (minor vs keep, by strength) |
| `pii.ts` | Local PII detection + redaction (regex + Luhn) applied before storage |
| `ranking.ts` | "Most useful" score (usage × recency) |
| `sensitive.ts` | Capture‑eligibility: refuse credential / OTP / payment / non‑composer fields; URL minimization |
| `blocklist.ts` | User blocklist (domains + regex) storage + matching |
| `health.ts` | Per‑platform capture‑health storage |
| `prefs.ts` | Preferences: resurface click, filter strength, pause, per‑site, incognito, PII redaction |
| `markdown.ts` · `format.ts` | Markdown export · text/time formatting |

Path alias `@/` → `src/` (kept in sync in `tsconfig.json` and `vite.config.ts`).

> Selectors are deliberately confined to `src/content/<platform>/index.ts` so a DOM change is a one‑file fix. See [CLAUDE.md](CLAUDE.md) for the full contributor map and [DESIGN.md](DESIGN.md) for the visual system.

---

## Privacy & security

Local‑first is the product, not a footnote: **no network calls, no telemetry, no accounts, no cloud.** Only the prompt text you type is stored — never the AI's replies, never credentials — and detected **PII is redacted before storage** so raw values never land on disk or in exports. Prompts live in **IndexedDB**; settings/blocklist/health live in `chrome.storage.local`; both stay on your machine. You can export, blocklist, pause, redact, or wipe everything at any time.

**Permissions requested:** `storage` (save your library and settings locally), `alarms` (clear the capture‑pause badge when its timer ends), and host access only on the five supported sites. Details in the in‑extension privacy page and [SECURITY.md](SECURITY.md).

---

## Development

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev build with HMR; load `dist/` as an unpacked extension |
| `npm run build` | Production build to `dist/` (runs `tsc --noEmit` first) |
| `npm run typecheck` | `tsc --noEmit` only |
| `npm run lint` | ESLint over `src` |
| `npm run test` | Vitest run (one‑shot) — 88 unit tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run format` | Prettier over `src` |
| `npm run release -- <version>` | Bump the version, build, and zip `dist/` for the Web Store |

Run a single test file: `npx vitest run src/lib/similarity.test.ts`

**Project layout**

```
src/
  background/      service worker (DB writes, similarity, pause badge)
  content/
    <platform>/    one entry per site — selectors + wiring only
    shared/        capture, resurface, captureGate, health, blocklist cache, toast
  lib/             pure core logic + colocated *.test.ts
  options/         library page (React): Library, Settings, Privacy
  popup/           popup (React)
  ui/              shared React components (PromptCard, PauseControl, …)
  styles/          globals.css (design tokens + component primitives)
  assets/          toolbar icons (generated from icon.svg)
  manifest.json    MV3 manifest (version injected from package.json at build)
site/              the marketing landing page (single self-contained file)
store/             Chrome Web Store listing copy + asset/launch plan
```

Tests run on **Vitest + happy‑dom**. **CI** (`.github/workflows/ci.yml`) runs typecheck + lint + test + build on every push/PR and uploads the built `dist/` as an artifact. Users can send feedback from **settings → Feedback** (a prefilled message they send themselves — no telemetry); configure the destination in `src/lib/feedback.ts`.

---

## Extending Deja

**Add a new site:**
1. Create `src/content/<platform>/index.ts` — define an ordered `SELECTORS` list and a `getInput()`, then wire `startBlocklistSync()`, `startCaptureGate()`, `attachSubmitHook()`, `startHealthProbe()`, and `attachResurface()` (copy an existing entry).
2. Register the content script (matches + js) in `src/manifest.json`.
3. Add the platform to `Platform`, `PLATFORM_LABEL`, and `PLATFORM_COLOR` in `src/lib/types.ts` (per‑site switches and health pick it up automatically).

**Tune behavior** (centralized, provisional constants meant to be set from real usage):
- Resurface matching — `src/lib/similarity.ts` (`MIN_QUERY_LEN`, threshold, IDF strength).
- Selective capture — `src/lib/classify.ts` (`SHORT_CHARS`, `RICH_WORDS`, the trivial‑phrase set).

**Respect the guardrails:** never add network calls/telemetry without an explicit user‑facing opt‑in; never block the host page; capture only prompt text (not responses); keep selectors in the per‑platform file. Follow the design tokens in [DESIGN.md](DESIGN.md) — compose the `.dj-*` primitives, don't hard‑code hex. Add a `*.test.ts` next to any new `lib` module.

---

## Roadmap & future landscape

Deja ships in usable phases (see [ROADMAP.md](ROADMAP.md)). The big upgrades on the horizon — to be decided from real usage, not guessed:

- **Semantic resurface** via on‑device embeddings — catch paraphrases trigram similarity can't ("write a poem about cats" ↔ "compose verse about felines"), as a hybrid that keeps today's instant lexical path and falls back to embeddings only when it finds nothing. Still fully local.
- **Optional, bring‑your‑own‑key LLM helpers** — an on‑demand "improve this prompt" and one‑tap tag suggestions, gated behind a settings toggle, never in the capture path.
- **Smarter ranking & storage** — reuse/recency‑aware resurface ranking, near‑duplicate collapsing, and a worker‑side trigram/inverted‑index cache for very large libraries.
- **Activity heatmap**, **prompt chaining**, **encrypted (E2EE) cloud sync**, and **team/shared vaults** — in rough order of value.

**Deliberately excluded, on principle:** 0–100 prompt "scores", streaks/gamification, AI‑generated "prompt of the day", and anything that requires reading your prompts on a server. See [CONCEPT.md](CONCEPT.md) for the reasoning.

---

## Deploying & launching

Deja is local‑first, so there's **nothing server‑side to deploy** — "launching" means two independent things: publishing the extension, and (optionally) hosting the landing page.

### 1. Publish the extension (Chrome Web Store)
1. **Bump the version** in `package.json` (it's injected into the manifest at build).
2. **Build:** `npm run build`.
3. **Zip the build output** — the *contents* of `dist/`, not the folder:
   ```bash
   cd dist && zip -r ../deja-<version>.zip . && cd ..
   ```
4. **Create a developer account** at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one‑time US$5 fee).
5. **Create the listing** and upload the zip. Fill in the description, **permission justifications**, **single‑purpose** statement, and **data‑safety** answers — all drafted in [`store/listing.md`](store/listing.md). Add screenshots / a promo tile per the shot list in [`store/assets.md`](store/assets.md), and link a hosted **privacy‑policy URL**.
6. **Submit for review.** Expect a review wait; ship updates by repeating steps 1–3 and uploading a new zip.

### 2. Host the landing page (optional)
`site/index.html` is a single self‑contained file with no build step and no third‑party requests. Host it on any static host — **GitHub Pages, Netlify, Vercel, or Cloudflare Pages** — by serving that one file. Before going live, replace the `REPLACE_EXTENSION_ID` (store URL) and confirm the `github.com/mehdirt/deja` links. The same file can host the privacy policy section the store listing points at.

### 3. Soft launch
Per the roadmap: invite ~50 users from communities you're already in, watch how the resurface moment lands, and tune the thresholds before any broad launch. No analytics by design — listen, don't measure.

> Firefox/Edge are not targeted yet (this is an MV3 Chrome build); both are plausible later with minor manifest work.

---

## Tech stack

Vite · React 18 · TypeScript · Tailwind CSS · Dexie (IndexedDB) · MiniSearch · `@crxjs/vite-plugin` · Vitest + happy‑dom. No web fonts, no runtime third‑party services.

---

## Project documents

| Doc | What's in it |
| --- | --- |
| [CONCEPT.md](CONCEPT.md) | The product thesis, principles, and what's in/out of v1 |
| [ROADMAP.md](ROADMAP.md) | The phased plan and operating notes |
| [DESIGN.md](DESIGN.md) | Visual identity — tokens, type, components, voice |
| [SECURITY.md](SECURITY.md) | Security & privacy posture and threat model |
| [CLAUDE.md](CLAUDE.md) | Contributor guidance and the full module map |
| [store/](store/) | Web Store listing copy + asset/launch plan |

---

## License

Not yet licensed — private project for now. A license will be added when the repository is made public.
