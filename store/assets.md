# Store & launch assets — production guide

These need a real browser running the built extension, so they can't be
generated from the repo. This is the shot list, specs, and scripts to produce
them quickly and consistently.

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

Required: at least one at **1280×800** (preferred) or 640×400. Provide 4–5.

**Status (Jul 2026):** five store-ready PNGs are in this folder —
`screenshot-{1..5}-1280x800.png`. Re-capture only if the UI drifts.

1. **The resurface moment** ✅ `screenshot-1-resurface-1280x800.png` — on a real
   chat site, mid-prompt, with the "You've been here before →" tooltip. Hero shot.
2. **Search + sort** ✅ `screenshot-2-search-sort-1280x800.png` — query in the
   search box with the sort dropdown open (newest / most useful / most used /
   longest unseen).
3. **The library** ✅ `screenshot-3-library-1280x800.png` — healthy list, platform
   filter row, tags visible.
4. **The popup** ✅ `screenshot-4-popup-1280x800.png` — toolbar popup with
   capturing/pause and recent prompts.
5. **Capture controls (settings)** ✅ `screenshot-5-settings-1280x800.png` —
   per-site switches + health dots, filter strength, PII redaction.

Optional 6th (if you want to show it): **selective capture** — the library with
the `filtered (n)` view revealing a "minor" prompt and its `keep` action.

Caption each with one short line (the store overlays them).

## Promo tiles (optional but recommended)

- **Small tile:** 440×280 — logo mark + wordmark + one line ("your personal
  prompt library"). Reuse the palette in `site/index.html`.
- **Marquee:** 1400×560 — the resurface tooltip motif on the warm-paper bg.

## Demo video (~45–60s) — script

Short, no voiceover needed (captions instead).

1. (0–8s) A chat site. Type a prompt, hit Enter. Toast: "remembered."
2. (8–20s) Days later, start a *similar* prompt. The tooltip appears — "you've
   been here before". Step to `2/3`, click (it's copied to the clipboard), then
   manually paste with ⌘V — Deja never auto-fills. Card: reusing past work in
   seconds.
3. (20–35s) Open the library (⌘⇧K → "open full library"): search, filter by
   platform, tag a prompt, pin one.
4. (35–50s) Settings: show "capture is working ✓" across all five, the blocklist,
   and export. End on the privacy line: "no network calls. nothing leaves your
   machine."
5. (50–60s) Logo + "Deja — your prompts, every AI, one library." + install CTA.

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
