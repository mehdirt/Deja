# Store & launch assets — production guide

These need a real browser running the built extension, so they can't be
generated from the repo. This is the shot list, specs, and scripts to produce
them quickly and consistently.

## Setup for clean captures

1. `npm run build`, load `dist/` unpacked.
2. Seed a believable library: send ~15–20 varied prompts across ChatGPT, Claude,
   Gemini, DeepSeek, Grok (mix of short and long, a couple with code blocks, a
   few obviously related so resurface and "most used" look real). Avoid anything
   personal — these screenshots are public.
3. Use a clean browser profile, default zoom 100%, system light theme for the
   primary set (optionally capture a dark-mode alt set — Deja follows the OS).

## Screenshots (Chrome Web Store)

Required: at least one at **1280×800** (preferred) or 640×400. Provide 4–5.

1. **The resurface moment** — on a real chat site, mid-prompt, with the "You've
   been here before →" tooltip showing the `1/3` counter and "matched on …".
   This is the hero shot; lead with it.
2. **The library** — options page with a healthy list, the platform filter row,
   and a couple of tags visible.
3. **Search + sort** — search box with a query and the sort dropdown open
   (showing newest / most useful / most used / longest unseen).
4. **Capture health + settings** — the settings page showing the per-platform
   "capture is working ✓" row and the blocklist controls.
5. **The popup** — toolbar popup with recent + pinned prompts.

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

- Host the single file anywhere static (GitHub Pages, Netlify, Cloudflare Pages).
- Replace the placeholders before going live:
  - `REPLACE_EXTENSION_ID` → the Web Store listing URL (after first submission).
  - `REPLACE_OWNER` → the GitHub org/user (or remove the Source links if the
    repo stays private — see the open-source decision below).

## Open the repo? (ROADMAP Phase 5 decision)

Still undecided in the roadmap. If opening:

- Add a `LICENSE` (MIT is the low-friction default for a client-side tool; choose
  deliberately) and flip the README "License" line.
- Keep the "load from source" path in the README and landing page.

If staying private: remove the "Source" / "load from source" links from
`site/index.html` and soften the README install section to the packaged build.
Either way, this is a product call — left for you, not assumed here.

## What only you can do (not automatable from the repo)

- Capture the screenshots and record the demo video (need a live browser).
- Write/host the privacy policy URL and paste it into the listing.
- Create the Chrome Web Store developer account, pay the one-time fee, upload the
  zipped `dist/`, and submit for review.
- Invite the first ~50 users from communities you're already in (no broad launch
  yet — per the roadmap exit criteria).
