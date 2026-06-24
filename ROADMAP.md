# PromptShelf — Roadmap

A phased plan. Each phase is a usable product. Don't start phase N+1 until phase N feels finished.

The principle: **ship something good, then make it great, then make it powerful.** Not all at once.

**What changed (June 2026 reframe).** After a hard look at the concept, we moved the resurface moment — "You've Been Here Before" — out of "later" and into the core of v1. The library is plumbing; the in-context moment is the product, and you can't polish a moment you've never watched a human react to. We also promoted capture *reliability* (not capture *polish*) to the very first thing we build, because a silently-broken selector means a beautiful empty shelf and we'd never know. UI/UX is a first-class deliverable throughout, not a final coat of paint.

---

## Phase 0 — Scaffold ✅ *(done)*

Project compiles, extension loads, capture writes to IndexedDB, popup and library render.

- Vite + React + TypeScript + Tailwind + Dexie + MiniSearch
- Content scripts for ChatGPT, Claude, Gemini, DeepSeek, Grok
- Manifest V3 background worker
- Popup (search + recent 5) and full library page
- JSON export
- Unit tests on similarity module

**Exit criteria:** `npm run build`, load `dist/` in Chrome, send a prompt on each platform, see it in the popup.

---

## Phase 1 — Trustworthy capture + the first real moment ✅ *(built; awaiting real-user verification)*

The point of this phase is to prove the thing works *and* that the magic moment lands — both, before any cosmetic polish gets the final pass. Two workstreams run together: make capture impossible to silently break, and put a real (if rough) resurface moment in front of humans.

**Capture reliability — build this first**
- A self-check that runs on each supported page load: locate the input element, and if the selector misses, record a local-only "capture health" signal (never a network call). A broken selector should be visible to *us* in seconds, invisible to the user always.
- Per-site selector fallbacks (a small ordered list per platform, not one brittle query)
- Health surfaced quietly in the library/settings ("Capture is working on ChatGPT ✓ Claude ✓ Gemini ✓ DeepSeek ✓ Grok ✓") so a user can tell at a glance the shelf is actually listening
- Handle edit-resubmit gracefully (don't double-save the same prompt)
- Multi-line prompts and code blocks preserve formatting
- Latency from Enter to stored: under 100 ms, measured

**The resurface moment — rough version, in real hands this phase**
- Content-script behavior: as the user types, debounced ~400 ms, query `findSimilar` against the local library
- Floating tooltip anchored above the input: `"You've asked something like this before →"` with one match preview
- Click → copy old prompt to clipboard (do **not** auto-fill the textarea; respect the user)
- Dismissible per-session; never nags
- Threshold starts at 0.4 and gets tuned **from watching real reactions**, not from a guessed number
- Ship it deliberately rough to ~5 users early in the phase; the goal is to learn whether the moment lands at all before we sink days into pixels

**Library + capture polish (UI/UX is a deliverable, not a coat of paint)**
- Dismissible toast on save with 5 s **Undo** ("Saved to your shelf · Undo")
- Empty state that teaches, not shames ("Send your first prompt on ChatGPT to start your shelf")
- Keyboard shortcuts: `⌘K` focus search, `↑/↓` navigate, `Enter` copy, `⌫` delete
- Loading skeletons (currently flashes empty before list renders)
- Sort: newest / most-used / longest unseen

**Visual identity**
- Real icon set (16/48/128 PNG)
- A logo lockup for the popup header
- Consistent type scale, settle on Inter + JetBrains Mono
- Dark mode matches each host site when overlaid

**Trust, pulled forward**
- Write the privacy paragraph now (Chrome Web Store copy + an in-extension line): exactly what is and isn't collected (nothing leaves the machine). It's 30 minutes and it's the highest-leverage trust asset we have.

**Exit criteria:** Send the build to ~5 people. They use it for a few days without help, capture never silently fails, and **the resurface moment surfaces during normal use and is helpful at least half the times it appears.** At least one of them keeps it installed without being asked to.

---

## Phase 2 — Make the moment great *(needs real-user reactions before tuning)*

The moment exists and we've watched people use it. Now sharpen it from what we learned.

- Tune the similarity threshold and short-prompt behavior from real Phase 1 reactions (trigram Jaccard misfires on very short or near-paraphrased prompts — handle those cases explicitly)
- Polish the tooltip's look, timing, and placement so it feels like part of the host page, not an intrusion
- Smarter match preview: show *why* it matched, and let the user step through more than one candidate
- Decide the auto-fill question from evidence: still copy-only, or offer an opt-in one-tap insert?

**Exit criteria:** During a normal week of AI use, the tooltip surfaces 3–10 times and is genuinely helpful in a clear majority of them — enough that users would notice and miss it if it were gone.

---

## Phase 3 — Light organization ✅ *(built)*

Once users have 50+ prompts, flat list isn't enough.

- Manual tags (user-added, no LLM): tag input in the library, multi-tag filter
- Pin a prompt to the top of the popup
- "Favorites" view (pinned only)
- Bulk select + bulk delete in the library
- Smarter sort: a "Most useful" view weighting `usageCount` × recency

No auto-categorization yet. We see if manual tags are enough before adding a model.

**Exit criteria:** A user with 100+ prompts can find any one of them in under 5 seconds.

---

## Phase 4 — Trust & portability ✅ *(built)*

Make it impossible to feel locked in.

- Import from JSON (round-trip with export)
- Markdown export (one file per prompt or one big file)
- Settings page: clear all data, blocklist domains, blocklist regex patterns (don't capture password-shaped strings)
- Expand the Phase 1 privacy paragraph into a full privacy page in the extension, stating exactly what is and isn't collected (nothing)
- Surface the capture-health view from Phase 1 here too, alongside the data controls

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

- **Selectors will break.** Every supported site (ChatGPT, Claude, Gemini, DeepSeek, Grok) changes its DOM every few weeks. Build a habit of testing capture on all of them after every release, lean on the capture-health view to catch silent breakage, and keep selector code in one file per site for fast fixes.
- **Latency budget.** From Enter keypress to toast: under 100 ms. From popup open to first result: under 50 ms. If we miss either, fix it before adding the next feature.
- **Cost budget.** $0/month to operate v1. The moment we add a hosted feature, we have a different product with different risks; weigh that carefully.
- **Listening, not asking.** Don't run feature surveys. Watch how people use it, what they wish was faster, and what causes uninstalls.

---

## What "done" looks like for v1

A friend installs the extension. Closes the tab where they did the install. Forgets about it for two weeks. Then one day, mid-prompt on ChatGPT, they hit ⌘⇧K, find an old prompt in three keystrokes, copy it, and ship their work 5 minutes faster than they otherwise would have.

That moment is the whole product. Build until that moment is real, then keep that moment alive forever.
