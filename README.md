<p align="center">
  <img src="src/assets/icon-128.png" alt="Deja" width="72">
</p>

<h1 align="center">deja</h1>

<p align="center">
  <strong>Every prompt you write is work. Deja makes sure none of it goes missing.</strong>
</p>

<p align="center">
  <a href="https://github.com/mehdirt/Deja/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/mehdirt/Deja/ci.yml?branch=main&label=CI" alt="CI status"></a>
  <a href="https://github.com/mehdirt/Deja/blob/main/LICENSE"><img src="https://img.shields.io/github/license/mehdirt/Deja?color=blue" alt="License"></a>
  <a href="https://github.com/mehdirt/Deja/commits/main"><img src="https://img.shields.io/github/last-commit/mehdirt/Deja" alt="Last commit"></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/contributions-welcome-brightgreen" alt="Contributions welcome"></a>
</p>

<p align="center">
  <a href="#why-deja">Why</a> ·
  <a href="#a-quick-tour">Tour</a> ·
  <a href="#install-load-unpacked">Install</a> ·
  <a href="#contributing">Contributing</a> ·
  <a href="#say-hello">Contact</a>
</p>

---

Deja is a small Chrome extension for anyone who talks to ChatGPT, Claude, Gemini, DeepSeek, or Grok. It **quietly saves every prompt you send**, keeps it searchable, and taps you on the shoulder with your own earlier version right as you start typing it again. No copy‑paste, no account to make, no cloud — everything stays on your machine, in your browser's own local storage.

If you've ever written the perfect prompt, gotten a great answer, and then lost it forever in a scrolled‑away chat — that's the exact problem this solves.

> **Status: v0.5.0.** Saving you can trust, the resurface moment, and a full set of in‑page tools: a quiet button in the chat box, `//` to search without leaving the page, per‑site controls, on‑device PII redaction, and a hand‑save for when a site's layout changes. Full phased plan in [ROADMAP.md](ROADMAP.md).

---

## Contents

- [Why Deja](#why-deja)
- [A quick tour](#a-quick-tour)
- [Supported sites](#supported-sites)
- [Features](#features)
- [Install (load unpacked)](#install-load-unpacked)
- [Using Deja](#using-deja)
- [Architecture & how it works](#architecture--how-it-works)
- [Privacy & security](#privacy--security)
- [Development](#development)
- [Extending Deja](#extending-deja)
- [Roadmap & future landscape](#roadmap--future-landscape)
- [Deploying & launching](#deploying--launching)
- [Tech stack](#tech-stack)
- [Contributing](#contributing)
- [Say hello](#say-hello)
- [Project documents](#project-documents)
- [License](#license)

---

## Why Deja

Every frequent AI user hits the **prompt graveyard**: you craft a perfect prompt, get a great result, and then it's gone — buried in a history you'll never scroll back through. Deja fixes that with two ideas:

1. **The library is plumbing.** Capture happens automatically, on every supported site, with zero effort. You never click "save."
2. **The resurface moment is the product.** The instant you start re‑asking something, your older, better version floats up in‑context — like a password manager appearing at the login box, not a notebook you have to remember to open.

**Why it's defensible:** any single lab could ship a "save prompt" button tomorrow — but none will let your prompt history follow you *out* of its walled garden into a competitor's. Deja is the prompt layer that rides *above* whichever model wins: your accumulated craft, portable, private, and yours. The one‑liner: **your prompts, every AI, one library.**

---

## A quick tour

Here's what actually happens, in order, the first time you use it.

1. **You install it, and forget it's there.** No sign‑up, no setup wizard. Load the extension and go back to whatever you were doing on ChatGPT or Claude.
2. **You send a prompt, as normal.** A small "Saved for you ✔" toast appears for a second, then gets out of the way. That's the whole interaction — Deja never asks you to click "save."
3. **A week later, you start typing something similar.** Before you finish the sentence, a quiet tooltip floats above the box: *you've asked something like this before.* Click it, and your older, better‑worded version drops in — like a password manager recognizing a login page, not a notebook you had to remember to open.
4. **You want something specific, right now.** Type `//` in any chat box. Your whole library opens right there, searchable, without a tab switch. Arrow keys to browse, Enter to use one.
5. **Something felt off — maybe a site redesigned its layout.** The little Deja dot in the corner of the box turns amber and offers to save that one prompt by hand, so nothing falls through the cracks silently.
6. **Eventually, you want to look around properly.** Click the toolbar icon → **library** for the full page: search, tags, favorites, sort by what you actually reuse, export, or clean house.

That's the whole tour. Everything past this point is detail on how each step works and how to build on it.

---

## Supported sites

| Platform | Host(s) |
| --- | --- |
| ChatGPT | `chatgpt.com`, `chat.openai.com` |
| Claude | `claude.ai` |
| Gemini | `gemini.google.com` |
| DeepSeek | `chat.deepseek.com` |
| Grok | `grok.com` |

Site DOMs change often, so each platform uses an **ordered list of selector fallbacks**, and a per‑site **capture‑health** signal under Settings → **Where Deja works** flags silent breakage before you'd ever notice missing prompts.

---

## Features

### Saving you can trust
- Passive capture on **Enter** and on **send‑button** clicks; duplicate submits within ~2 s are de‑duplicated.
- **Never captures credentials** — password / OTP / payment / non‑composer fields are refused, and stored URLs are minimized to origin + path.
- **Capture‑health** per platform, surfaced in the library and settings, so a broken selector is visible to *you* and never leaks to the host page.
- **PII redaction (on by default)** — detected personal info (emails, phones, cards, SSNs, IBANs, IPs, API keys/secrets) is replaced with numbered labels like `[email_1]` *before* the prompt is stored, so raw values never sit in your library or backups. Optional “Remember for fill-in” keeps those details in a private list on this computer only. Per‑category toggles, a live test box, and a scan‑and‑redact for already‑captured prompts live in settings.
- Multi‑line prompts and code blocks keep their formatting. In the **Library**, prompts that look like markdown (fences, lists, headings, etc.) render as structured prose with sunk mono code blocks; the popup stays plain truncated text. Storage, copy, search, and export still use the raw string.

### Reach for a prompt without leaving the page

- Type **`//`** in any supported chat box to search everything you've saved. Arrow keys to move, Enter to take one, Escape to forget it. It never opens inside a URL.
- A small **Deja button** sits in the corner of the box. Faint when there's nothing to say, lit when something you saved looks like what you're writing. Click it for the same search — plus "never save from this site" and "pause for an hour", right where you'd want them.
- If a site changes its layout and Deja loses the box, the button turns amber and offers to **save that one by hand** rather than losing it silently.
- Prompts with `{blanks}` route through a fill‑in step first, so a saved shape becomes a finished prompt in one pass.

### The resurface moment — "you've been here before"
- As you type (debounced ~400 ms), a gentle tooltip floats **above the input** when you've asked something similar before.
- Powered by **IDF‑weighted trigram similarity** with a length‑aware threshold — distinctive words count more than boilerplate, and short queries are held to a higher bar.
- Shows *why* it matched ("matched on …") and lets you **step through multiple candidates**; offers "see all" in the library when there are more.
- Click to **copy** by default — or opt into **insert‑at‑cursor** in settings. It never silently auto‑fills, and never overwrites what you've typed. Dismissible per query (× / Esc suppresses that prompt only); it never nags.

### What gets saved — keep the keepers
- A local, zero‑LLM classifier spots **throwaway** prompts two ways: a list of fixed sayings ("makes sense", "try again") and a rule that catches the combinations no list can hold — a message whose every word is filler ("ok thanks", "thank you so much"), plus reactions like "👍". At `strict` it also skips prompts that are brief and unstructured.
- **Skipped, not hidden:** a minor prompt is never written to disk. The strength you choose is a gate on what enters the library, not a flag on rows that still take up space. (Prompts saved by older versions, which *did* hide instead of skip, are still there under **`filtered (N)`** with a one‑click **keep**.)
- **Never a silent drop:** the first skip of each kind explains itself, and because a skip leaves no row to go back for, the strength that makes a judgment call offers it back — a `strict` skip comes with a **Keep it** button right in the chat box.
- **What Deja saves** is a setting: `off` (keep everything) · `balanced` (default — only obvious glue like "yes" or "ok thanks") · `strict` (only longer / clearly specific requests).

### What gets recorded is yours
- **Pause saving** from the popup or the in‑page Deja button: for **1 hour** or **until you resume**, with a live countdown and a toolbar badge. It resumes on its own.
- **Per‑site switches** in Settings → **Where Deja works**, next to each site's status — or straight from the Deja button in that site's chat box.
- **Auto‑pause in incognito** by default.
- **Blocklist** of **domains** and **regex patterns** that are never captured — with a live **"test a prompt against your rules"** box and a **"preview impact on saved prompts"** dry‑run, so a too‑broad rule is visible before you trust it.

### A library that organizes itself
- Fuzzy search (MiniSearch) in both the popup and the full library page.
- Platform filter, manual **tags** with multi‑tag filtering, a **favorites** filter, and **bulk select / delete**.
- Sorts: newest · most useful (usage × recency) · most used · longest unseen.
- Copy‑to‑clipboard with usage tracking; **delete with a short Undo, then gone for good**.

### Yours to keep
- **Export / import JSON** (round‑trips), plus **Markdown export**.
- Settings: clear all data, optional “keep at most” library ceiling, and the blocklist above.
- An in‑extension **privacy page** stating exactly what is and isn't collected.

---

## Install (load unpacked)

Clone from [github.com/mehdirt/Deja](https://github.com/mehdirt/Deja), then:

```bash
npm install
npm run build      # production build → dist/
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top‑right)
3. Click **Load unpacked** and select the `dist/` directory

Send a prompt on any [supported site](#supported-sites), then click the Deja toolbar icon to see it land.

> For live development use `npm run dev` instead of `npm run build` — Vite rebuilds `dist/` on save (reload the extension at `chrome://extensions` to pick up changes).
>
> Chrome Web Store install will replace this path once the listing is Public; until then the listing stays **Unlisted** for testers.

---

## Using Deja

- **Just work.** Prompt on any supported site as you normally do. Each prompt is saved the moment you hit Enter — a brief "Saved for you ✔ · Undo" toast confirms it.
- **Reuse in‑context.** Start typing something you've asked before; when the tooltip appears, click it to put your earlier version back in the box (or step through `1/3` matches with `›`).
- **Type `//` to reach anything saved.** Two slashes in the chat box open a search over your whole library — arrow keys to move, Enter to take one. If the prompt has `{blanks}`, you fill them in before it lands. It never opens inside a URL.
- **The quiet dot.** A small Deja button sits in the corner of the chat box. It lights up when something you saved looks like what you're typing, and opens the same search-and-insert panel. Its footer is the fastest way to say "not here" — never save from this site, or pause for an hour.
- **When a site changes.** If Deja loses the message box, the dot turns amber and offers to save that prompt by hand rather than letting it vanish.
- **Browse the popup.** The toolbar icon opens a search box + recent prompts. Hit `library →` for the full page.
- **Curate the library.** Search, filter by platform/tag, pin favorites, tag prompts, bulk‑delete, and sort by usefulness. Deleted prompts are undoable.
- **Control what's saved.** Use **⏸ pause** in the popup (or the Deja button in the chat box) before a private session; switch off a site or change what Deja saves in **settings**; add never‑save‑from rules for anything secret.
- **Take your data.** Export JSON or Markdown anytime; import a JSON export back; clear everything from settings.

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

- **Content scripts** — `src/content/<platform>/index.ts`, one per site. Each resolves the prompt composer via its selector fallbacks and wires up the shared helpers in `src/content/shared/`:
  - `capture.ts` — watches Enter / send clicks, debounces duplicates, checks the gate + blocklist, and sends `PROMPT_CAPTURED`.
  - `resurface.ts` — debounced similarity queries, the tooltip, copy / insert.
  - `presence.ts` — the ambient dot and its panel (search, insert, "not here", hand-save).
  - `picker.ts` — the `//` trigger, its list, and the shared `blanks.ts` fill-in step.
  - `captureGate.ts` — a synchronous, fail‑open snapshot of pause / per‑site / incognito state for the hot path.
  - `health.ts` — the capture‑health probe, which also drives the dot's amber state.
  - `overlayTheme.ts` / `anchor.ts` — one palette and one positioning kit for all six in-page surfaces. Shadow roots are **closed**, so nothing on the host page can read what Deja renders.
  They **fail silently and never block the host page.**
- **Background service worker** — `src/background/index.ts`. The only writer to IndexedDB from outside the UI. Handles `PROMPT_CAPTURED` (redact PII → classify → store), `SIMILAR_QUERY` (score the pool → re-rank → top matches), `LIBRARY_SEARCH` (the in-page panel and picker, which can't read IndexedDB themselves), `SAVE_MANUAL`, `PROMPT_USED` / `SUGGESTION_DISMISSED`, `OPEN_LIBRARY`, and `UNDO_CAPTURE`, and paints the pause badge. `pool.ts` caches the prompt list in worker scope so a keystroke doesn't cost a full table read. MV3 workers are short‑lived, so it keeps no state in module scope that matters across wakes — everything persists through Dexie / `chrome.storage`.
- **Popup** — `src/popup/`. Search + recent prompts + pause control.
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
| `npm run test` | Vitest run (one‑shot) — 101 unit tests |
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

Tests run on **Vitest + happy‑dom**. **CI** (`.github/workflows/ci.yml`) runs typecheck + lint + test + build on every push/PR and uploads the built `dist/` as an artifact. Users can send feedback from **settings → Feedback** (opens a prefilled GitHub issue they review and submit — no telemetry); override with a hosted form via `FEEDBACK_URL` in `src/lib/feedback.ts`.

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
- **Smarter ranking & storage** — reuse/recency‑aware resurface ranking, and a worker‑side trigram/inverted‑index cache for very large libraries. (Exact + near‑duplicate capture collapsing already ships in v0.4.1.)
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
5. **Create the listing** and upload the zip. Fill in the description, **permission justifications**, **single‑purpose** statement, and **data‑safety** answers — all drafted in [`store/listing.md`](store/listing.md). Add the `1280×800` screenshots already in [`store/`](store/) (shot list + remaining promo/video notes in [`store/assets.md`](store/assets.md)), and link a hosted **privacy‑policy URL** (`site/privacy.html` via Netlify Drop — see the GTM plan).
6. **Submit for review** as **Unlisted** first. Expect a review wait; ship updates by repeating steps 1–3 and uploading a new zip. The repo is open source (MIT); leave the listing Unlisted until the Week 2 go/no-go.

### 2. Host the landing page (optional)
`site/index.html` (+ `site/privacy.html`) is self‑contained with no build step and no third‑party requests. Host on any static host — **Netlify Drop** is the GTM plan default (drag the `site/` folder); GitHub Pages / Vercel / Cloudflare Pages also work. Before going live, replace `REPLACE_EXTENSION_ID` (store URL). Source links already point at the public GitHub repo.

### 3. Soft launch
Per the roadmap: invite ~50 users from communities you're already in, watch how the resurface moment lands, and tune the thresholds before any broad launch. No analytics by design — listen, don't measure.

> Firefox/Edge are not targeted yet (this is an MV3 Chrome build); both are plausible later with minor manifest work.

---

## Tech stack

Vite · React 18 · TypeScript · Tailwind CSS · Dexie (IndexedDB) · MiniSearch · `@crxjs/vite-plugin` · Vitest + happy‑dom. No web fonts, no runtime third‑party services.

---

## Contributing

Deja has two front doors, because a non‑technical user reporting a broken site
and a developer fixing that same site need opposite things from the process.

**Using Deja and something's off, or you have an idea?**
No account, no code, no jargon required.
- Open **settings → tell me what you think** inside the extension, or
  [pick a report type here](https://github.com/mehdirt/Deja/issues/new/choose) —
  a broken site, something not saving, or just an idea.
- The forms are short, plain‑language, and ask only what makes the report
  actionable. Nothing is ever sent automatically; you review and submit it
  yourself.
- Deja captured something it shouldn't have? That's a security bug — file it
  [privately here](https://github.com/mehdirt/Deja/security/advisories/new),
  never as a public issue. See [SECURITY.md](SECURITY.md) §7.

**Want to send a pull request?**
1. Read [CONTRIBUTING.md](CONTRIBUTING.md) first — five rules that override
   everything else (nothing leaves the machine, composer‑only capture, never
   break the host page, plain language, pure/testable code), then setup and
   review expectations.
2. Fork, branch, and run `npm install && npm run test && npm run typecheck`
   before you open the PR — CI runs the same checks.
3. Keep the change scoped. A selector fix when a site changes its layout is
   the single most common real failure and the easiest way to unblock actual
   people — start there if you're not sure where to start.
4. Open the PR against `main`; the template walks you through what to include.

Whatever you file, either door: **no real prompt text, no personal
information.** Issues are public, and keeping prompts on your machine is the
whole promise Deja makes.

---

## Say hello

Questions, feedback, or just want to talk about the project — email
**[mehdirt25@gmail.com](mailto:mehdirt25@gmail.com)**. For anything that
belongs in the public record (bugs, ideas, contributions), the
[issue forms](https://github.com/mehdirt/Deja/issues/new/choose) above are
still the faster path; email is for everything else.

---

## Project documents

| Doc | What's in it |
| --- | --- |
| [CONCEPT.md](CONCEPT.md) | The product thesis, principles, and what's in/out of v1 |
| [ROADMAP.md](ROADMAP.md) | The phased plan and operating notes |
| [DESIGN.md](DESIGN.md) | Visual identity — tokens, type, components, voice |
| [SECURITY.md](SECURITY.md) | Security & privacy posture and threat model |
| [CLAUDE.md](CLAUDE.md) | Contributor guidance and the full module map |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to set up, what gets merged, and the five rules that override everything |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Be decent; most people filing issues here aren't developers |
| [store/](store/) | Web Store listing copy + asset/launch plan |

---

## License

[MIT](LICENSE) — © 2026 mehdirt.
