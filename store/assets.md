# Store & launch assets — production guide

These need a real browser running the built extension. Recapture:

```bash
npm run build
node scripts/capture-store-screenshots.mjs
```

That loads `dist/` in Playwright's Chrome for Testing, seeds a public-safe
library, and writes the PNGs below. In-page shots use a ChatGPT-like fixture
(`scripts/fixtures/chatgpt-mock.html`) so the real overlays attach without a
logged-in chat account.

## Setup for clean captures

1. `npm run build`, load `dist/` unpacked.
2. Seed a believable library: send ~15–20 varied prompts across ChatGPT, Claude,
   Gemini, DeepSeek, Grok (mix of short and long, a couple with code blocks, a
   few obviously related so resurface and "most used" look real). Add a couple of
   tags and pin one. If you want the selective-capture shot, send a throwaway or
   two ("yes", "continue") so `filtered (n)` has something in it. Avoid anything
   personal — these screenshots are public.
3. Use a clean browser profile, default zoom 100%, system light theme for the
   primary set (optionally capture a dark-mode alt set — Deja follows the OS).

## Screenshots (Chrome Web Store)

Required: at least one at **1280×800** (preferred) or 640×400. The store listing
takes **five**; Product Hunt can take the sixth. Upload order: picker first.

**Status (Aug 2026):** six store-ready PNGs in this folder, recaptured against
bundled Figtree/Literata and the in-page surfaces. Shot 7 (dot panel) is skipped
— `PRESENCE_ENABLED` is currently `false` in `src/content/shared/presence.ts`.

Store captions (one short line each):

1. **The picker** — `screenshot-6-picker-1280x800.png` — *Your own words, back in two keystrokes.*
2. **The resurface moment** — `screenshot-1-resurface-1280x800.png` — *It finds you, too.*
3. **The library** — `screenshot-3-library-1280x800.png` — *Every prompt you sent, still yours.*
4. **The popup** — `screenshot-4-popup-1280x800.png` — *Pause, search, or jump to the full library.*
5. **Capture controls (settings)** — `screenshot-5-settings-1280x800.png` — *Per-site saving, throwaways, personal info — all on this computer.*

Extra (PH / listing overflow):

- **Search + sort** — `screenshot-2-search-sort-1280x800.png` — *Find it the way you remember it.*
- **The dot and its panel** — not captured. Flip `PRESENCE_ENABLED` and re-run the script.

## Promo tiles (optional but recommended)

- **Small tile:** 440×280 — logo mark + wordmark + one line ("your personal
  prompt library"). Reuse the palette in `site/index.html`.
- **Marquee:** 1400×560 — the resurface tooltip motif on the warm-paper bg.

## Demo video (~30s) — script

Short, no voiceover needed (captions instead). **Lead with `//`.** The old
script opened on a passive save and then waited for a tooltip that may or may
not appear — a lot of screen time before anything happens. Opening on someone
reaching for their own saved prompt shows a person in control in the first five
seconds, and it's the one thing about Deja nobody can picture from words.

1. (0–10s) A chat site, cursor in the message box. Type `//land` — the picker
   opens with "Write a friendly but firm email to my landlord about {issue}".
   Enter. The blanks step appears; type "the broken heating". The finished
   prompt lands in the box. Send it. Toast: "Saved for you ✔ · Undo".
   Card: *your own words, back in two keystrokes.*
2. (10–18s) Later, start typing something similar from scratch. The tooltip
   appears — "you've been here before" — showing why it matched. One click puts
   the earlier version in the box. Card: *it finds you, too.*
3. (18–26s) The quiet dot in the corner: click it, search the library, and use
   the footer to turn saving off for this site. Card: *always there, never in
   the way.*
4. (26–30s) Logo + "Deja — your prompts, every AI, one library." + install CTA,
   over the privacy line: "no network calls. nothing leaves your machine."

## Landing page

`site/index.html` is self-contained (no build, no external requests). To publish:

- Host the single file anywhere static (**Netlify Drop** is the GTM default —
  drag the `site/` folder; GitHub Pages / Vercel / Cloudflare Pages also work).
- Replace the placeholders before going live:
  - `REPLACE_EXTENSION_ID` → the Web Store listing URL (after first submission).
  - The source links (nav "Source", hero "load from source", footer source rows)
    point at the public GitHub repo. The `mehdirt` profile credit stays.
  - Keep `REPLACE_EXTENSION_ID` until the Web Store listing URL exists.

## Repo visibility (decided — open source)

Ship a **public** GitHub repo (MIT) alongside an **Unlisted** store listing until
the Week 2 go/no-go. When opening (prep already in-repo):

- [x] Add a `LICENSE` (MIT)
- [x] Uncomment / enable the source links in `site/index.html`
- [x] Flip the README License line
- [ ] Human: set GitHub visibility → **Public** and push

## What only you can do (not automatable from the repo)

- Flip the GitHub repo to **Public** and push any pending commits.
- Record the demo video (screenshots are done — see above).
- Host the privacy policy URL (Netlify Drop of `site/`) and paste it into the listing.
- Create the Chrome Web Store developer account, pay the one-time fee, upload the
  zipped `dist/`, and submit for review (**Unlisted** first).
- Invite the first ~50 users from communities you're already in (no broad launch
  yet — per the roadmap exit criteria).
- Repo renamed to `mehdirt/Deja` (links and `REPO_URL` already match).
