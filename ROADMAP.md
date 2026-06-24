# PromptShelf — Roadmap

A phased plan. Each phase is a usable product. Don't start phase N+1 until phase N feels finished.

The principle: **ship something good, then make it great, then make it powerful.** Not all at once.

---

## Phase 0 — Scaffold ✅ *(done)*

Project compiles, extension loads, capture writes to IndexedDB, popup and library render.

- Vite + React + TypeScript + Tailwind + Dexie + MiniSearch
- Content scripts for ChatGPT, Claude, Gemini
- Manifest V3 background worker
- Popup (search + recent 5) and full library page
- JSON export
- Unit tests on similarity module

**Exit criteria:** `npm run build`, load `dist/` in Chrome, send a prompt on each platform, see it in the popup.

---

## Phase 1 — Make it feel good *(target: 1–2 weeks)*

The features exist. Now make them *feel* like a finished product. This is the longest phase per feature added, and the most important. Skip it and the product feels like a hackathon project.

**Capture polish**
- Verify selectors on all three platforms; add fallbacks
- Dismissible toast notification on save with 5 s **Undo** ("Saved to your shelf · Undo")
- Handle edit-resubmit gracefully (don't double-save the same prompt)
- Multi-line prompts and code blocks preserve formatting

**Library polish**
- Empty state that teaches, not shames ("Send your first prompt on ChatGPT to start your shelf")
- Keyboard shortcuts: `⌘K` focus search, `↑/↓` navigate, `Enter` copy, `⌫` delete
- Loading skeletons (currently flashes empty before list renders)
- Sort: newest / most-used / longest unseen

**Visual identity**
- Real icon set (16/48/128 PNG)
- A logo lockup for the popup header
- Consistent type scale, settle on Inter + JetBrains Mono
- Dark mode matches each host site when overlaid

**Exit criteria:** Send the build to 3 friends. They install it, use it for a day without help, and nothing breaks. At least one of them keeps it installed.

---

## Phase 2 — The killer feature *(target: 1 week)*

Wire up "You've Been Here Before."

- New content script behavior: as the user types in the input box, debounced 400 ms, query `findSimilar` against the local library
- Floating tooltip anchored above the input: `"You've asked something like this before →"` with one match preview
- Click → copy old prompt into clipboard (do **not** auto-fill the textarea; respects the user)
- Dismissible per-session; never nags
- Threshold tuned so it appears only on genuine matches (start at 0.4, adjust from real use)

**Exit criteria:** During a normal week of AI use, the tooltip surfaces 3–10 times and is helpful at least half of those times.

---

## Phase 3 — Light organization *(target: 1 week)*

Once users have 50+ prompts, flat list isn't enough.

- Manual tags (user-added, no LLM): tag input in the library, multi-tag filter
- Pin a prompt to the top of the popup
- "Favorites" view (pinned only)
- Bulk select + bulk delete in the library
- Smarter sort: a "Most useful" view weighting `usageCount` × recency

No auto-categorization yet. We see if manual tags are enough before adding a model.

**Exit criteria:** A user with 100+ prompts can find any one of them in under 5 seconds.

---

## Phase 4 — Trust & portability *(target: 3–5 days)*

Make it impossible to feel locked in.

- Import from JSON (round-trip with export)
- Markdown export (one file per prompt or one big file)
- Settings page: clear all data, blocklist domains, blocklist regex patterns (don't capture password-shaped strings)
- Privacy page in the extension itself, stating exactly what is and isn't collected (nothing)

**Exit criteria:** A privacy-cautious user reads the settings/privacy page and feels comfortable leaving the extension on.

---

## Phase 5 — Ship it *(target: 1 week)*

- Chrome Web Store listing (screenshots, demo video, copy)
- Landing page (one page, no signup, link to install)
- Open the repo (or don't — decide based on team size)
- Optional: write one blog post about the "prompt graveyard" idea — the framing sells the product
- Invite the first ~50 users from communities you're already in (no broad launch yet)

**Exit criteria:** 50 weekly-active users with no support emails. Then broaden.

---

## Phase 6+ — Decide from data, not from this document

After ~50 users have used the v1 for a few weeks, look at what they actually do and pick the next feature. Likely candidates, in rough order of value:

1. **Optional LLM features** (bring-your-own-key)
   - "Improve this prompt" button on a card (on-demand, not automatic)
   - Auto-tag suggestion (one-tap accept, never silent)
2. **Activity heatmap** — pure visualization on existing data, low risk
3. **Prompt chaining** — link prompts into named sequences for repeatable workflows
4. **Encrypted cloud sync** — E2EE only; never plaintext on a server
5. **Team / shared vaults** — likely a paid tier; only after individual product is great
6. **Mobile companion** — read-only browse + copy on the go

Explicitly **not** on the roadmap unless someone shows a clear reason:

- Scoring prompts on a 0–100 scale (concept-doc feature; cut on principle)
- Streaks and gamification points (the heatmap covers the same need without the anxiety)
- AI-generated "prompt of the day" suggestions
- Any feature that requires us to read prompt content on a server

---

## Operating notes

- **Selectors will break.** ChatGPT/Claude/Gemini change their DOM every few weeks. Build a habit of testing capture on all three after every release, and keep selector code in one file per site for fast fixes.
- **Latency budget.** From Enter keypress to toast: under 100 ms. From popup open to first result: under 50 ms. If we miss either, fix it before adding the next feature.
- **Cost budget.** $0/month to operate v1. The moment we add a hosted feature, we have a different product with different risks; weigh that carefully.
- **Listening, not asking.** Don't run feature surveys. Watch how people use it, what they wish was faster, and what causes uninstalls.

---

## What "done" looks like for v1

A friend installs the extension. Closes the tab where they did the install. Forgets about it for two weeks. Then one day, mid-prompt on ChatGPT, they hit ⌘⇧K, find an old prompt in three keystrokes, copy it, and ship their work 5 minutes faster than they otherwise would have.

That moment is the whole product. Build until that moment is real, then keep that moment alive forever.
