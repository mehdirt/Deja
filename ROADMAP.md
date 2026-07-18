# Deja — Roadmap

A phased plan. Each phase is a usable product. Don't start phase N+1 until phase N feels finished.

The principle: **ship something good, then make it great, then make it powerful.** Not all at once.

**What changed (June 2026 reframe).** After a hard look at the concept, we moved the resurface moment — "You've Been Here Before" — out of "later" and into the core of v1. The library is plumbing; the in-context moment is the product, and you can't polish a moment you've never watched a human react to. We also promoted capture *reliability* (not capture *polish*) to the very first thing we build, because a silently-broken selector means a beautiful empty library and we'd never know. UI/UX is a first-class deliverable throughout, not a final coat of paint.

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
- Health surfaced quietly in the library/settings ("Capture is working on ChatGPT ✓ Claude ✓ Gemini ✓ DeepSeek ✓ Grok ✓") so a user can tell at a glance the library is actually listening
- Handle edit-resubmit gracefully (don't double-save the same prompt)
- Multi-line prompts and code blocks preserve formatting
- Latency from Enter to stored: under 100 ms, measured

**The resurface moment — rough version, in real hands this phase**
- Content-script behavior: as the user types, debounced ~400 ms, query `findSimilar` against the local library
- Floating tooltip anchored above the input: `"You've asked something like this before →"` with one match preview
- Click → copy old prompt to clipboard (do **not** auto-fill the textarea; respect the user). Opt-in insert-at-cursor later landed in settings.
- Dismissible per query (× / Esc suppresses that normalized query only); never nags
- Threshold starts at 0.4 and gets tuned **from watching real reactions**, not from a guessed number
- Ship it deliberately rough to ~5 users early in the phase; the goal is to learn whether the moment lands at all before we sink days into pixels

**Library + capture polish (UI/UX is a deliverable, not a coat of paint)**
- Dismissible toast on save with 5 s **Undo** ("Saved to your library · Undo")
- Empty state that teaches, not shames ("Send your first prompt on ChatGPT to start your library")
- Keyboard shortcuts: `⌘K` focus search, `↑/↓` navigate, `Enter` copy, `⌫` delete
- Loading skeletons (currently flashes empty before list renders)
- Sort: newest / most-used / longest unseen

**Visual identity**
- Real icon set (16/48/128 PNG)
- A logo lockup for the popup header
- Consistent type scale — Inter + JetBrains Mono ✅
- Dark mode matches each host site when overlaid

**Trust, pulled forward**
- Write the privacy paragraph now (Chrome Web Store copy + an in-extension line): exactly what is and isn't collected (nothing leaves the machine). It's 30 minutes and it's the highest-leverage trust asset we have.

**Exit criteria:** Send the build to ~5 people. They use it for a few days without help, capture never silently fails, and **the resurface moment surfaces during normal use and is helpful at least half the times it appears.** At least one of them keeps it installed without being asked to.

---

## Phase 2 — Make the moment great *(partly built; tuning still needs real-user reactions)*

The moment exists and we've watched people use it. Now sharpen it from what we learned. The two items that don't need user data are built; the two that do are still held.

- Short-prompt behavior handled explicitly ✅ — `similarity()` blends symmetric Jaccard with the overlap coefficient so a brief query that's nearly a substring of a longer stored prompt still scores (plain trigram Jaccard tanked these). Trigrams are also IDF-weighted (distinctive terms outweigh boilerplate, damped so the score scale stays stable as the library grows), and the threshold scales up for short queries. The tuning *constants* are centralized and provisional — they still wait on real Phase 1 reactions.
- Smarter match preview ✅ — resurface returns the top candidates; the tooltip shows *why* each matched ("matched on …" shared terms) and lets the user step through them (`1/3` + `›`).
- Polish the tooltip's look, timing, and placement so it feels like part of the host page, not an intrusion — *needs real reactions*
- Opt-in one-tap insert ✅ — settings toggle (`prefs.resurfaceClick`: copy by default, insert-at-cursor opt-in). Still tune from real reactions whether copy-only should stay the default.

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

## Phase 5 — Ship it *(in progress — artifacts prepared, submission pending)*

Prepared in-repo (the parts that can be authored from code):
- Chrome Web Store listing **copy** ✅ — `store/listing.md` (summary, description, permission justifications, single-purpose + data-safety answers, pre-submission checklist).
- Landing page ✅ — `site/index.html` (one self-contained file, no signup, no third-party requests; install CTA + load-from-source). Has `REPLACE_*` placeholders for the store URL; GitHub source links are live (MIT-licensed public repo).
- Asset & launch plan ✅ — `store/assets.md` (screenshot shot list, promo-tile specs, demo-video script).
- Store screenshots ✅ — five `1280×800` PNGs in `store/screenshot-*-1280x800.png` (resurface, search+sort, library, popup, settings).
- Ship-readiness fix ✅ — dropped the unused `activeTab` permission; the extension requests `storage`, `alarms` (pause-badge expiry), and the five content-script hosts.
- Open source ✅ — `LICENSE` (MIT); feedback goes to GitHub Issues (no personal email in tree).

Still requires a live browser / human (can't be done from the repo):
- Record the demo video (script in `store/assets.md`).
- Host the privacy-policy URL (Netlify Drop of `site/` — see GTM plan); create the Web Store dev account and submit zipped `dist/` as **Unlisted**.
- **Repo visibility** — flip GitHub to **Public** (prep is in-repo; the human flips the switch). Domain deferred until traction (≥100 installs).
- Optional: the "prompt graveyard" blog post.
- Invite the first ~50 users from communities you're already in (no broad launch yet).

**Exit criteria:** 50 weekly-active users with no support emails. Then broaden.

---

## Post-0.2.0 — capture quality & resurface correctness ✅ *(built)*

Two issues found in real use, both addressed before the wider invite.

**Resurface echo bug — fixed.** Right after submitting a prompt, the tooltip could pop up suggesting the prompt you'd *just sent*. Root cause: the debounced similarity query was scheduled at keystroke time and never cancelled on submit, so it fired ~400 ms later against the just-sent (now-saved, identical) text. Fixes: cancel the pending debounce in `hide()`; re-read the composer's *live* text when the timer fires (covers Send-button submits that bypass the Enter handler); and a background backstop that never returns a prompt identical to the query.

**Selective capture (soft filter) — built.** We no longer treat every keystroke-sized prompt as library-worthy. A local, zero-LLM classifier (`src/lib/classify.ts`) flags "minor" prompts — bare follow-ups ("yes", "continue", "thanks") and tiny fragments with no code/URL/structure. Design decisions:
- **Soft capture, never a silent drop.** Minor prompts are still *stored* (flagged `minor`), just hidden from the library and resurface by default. This mirrors soft-delete, keeps the "remembers everything" promise intact, and — crucially — lets us *tune the threshold from real data* instead of guessing (same philosophy as the resurface threshold).
- **Conservative bar.** Only obvious throwaways are flagged; a short prompt with code, a URL, a file path, list structure, or ≥6 words is kept. Constants are centralized and provisional.
- **Informed, never naggy.** No "remembered" toast for a filtered prompt; a *one-time* explanation toast the first time it happens. The library shows `filtered (N)` to reveal/keep them, each with a `keep` action. Filter strength is a three-stop control (`off` / `balanced` / `strict`) in settings — `off` keeps every prompt.

**Capture controls — built.** A small, principle-aligned set of "what gets captured" controls, organized in settings by intent (*don't capture* vs *keep but hide*):
- **Pause capture** (`src/ui/PauseControl.tsx`) — a one-click off switch in the popup: pause for 1 hour or until you resume, with a live countdown and a toolbar badge (`||`, alarm-cleared on expiry). Capture resumes on its own — the content gate checks the pause time live, so the alarm is cosmetic only. The biggest trust affordance we have.
- **Per-site switches** — fold into the capture-health view in settings: each site shows its health dot *and* an on/off switch. Auto-pause in incognito by default.
- **Filter strength** — the minor classifier is now a three-stop segmented control (`off` / `balanced` / `strict`), replacing the earlier `keepMinor` boolean (migrated in `prefs.ts`).
- **Blocklist made approachable** — a live "test a prompt against your rules" box and a "preview impact on saved prompts" dry-run, so a too-broad regex is visible before you trust it.

The content hot path reads all of this through a synchronous, fail-open cache (`src/content/shared/captureGate.ts`, mirroring the blocklist cache); incognito auto-pause is the one deliberate fail-*closed* case. New permission: `alarms` (badge expiry only).

**PII redaction — built.** Detected personal info is stripped from a prompt *before* it's stored, so the local library and any shared JSON export never accumulate raw emails/cards/secrets (`src/lib/pii.ts`).
- **Redaction, not hashing/encryption** — hashing low-entropy PII is brute-forceable and unusable; encryption breaks search and adds key management for little gain (IndexedDB is origin-isolated). Redaction is deterministic, local, and turns prompts into safe *reusable templates* (`[email]`, `[card]`, `[secret]`).
- **High-precision regex** — email, Luhn-checked cards, SSN, IPv4/6, IBAN, phone, and known secret/token shapes (OpenAI/AWS/GitHub/Slack/Google/JWT). Tuned to under-detect rather than mangle. Names/addresses need on-device NER — deferred with embeddings.
- **On by default**, per-category toggles, a live test box, and a "scan library & redact" action to retro-clean prompts captured before it was on. Redaction runs first in the background capture handler and on the resurface query so both sides match. Surfaced honestly ("remembered · N redacted").

**Capture deduplication — built (v0.4.1).** Exact matches and near-duplicates (≥75% similar) collapse into one row with usage bumped, so edit-resubmits and retries no longer flood the library past the 2 s debounce window.

**Query-scoped resurface dismissal — built (v0.4.1).** Dismissing the tooltip (× / Esc) suppresses that normalized query only — not the whole session — so a different prompt can still resurface.

These two tracks below — named for the next round of work — build directly on this.

## Phase 6+ — Decide from data, not from this document

After ~50 users have used the v1 for a few weeks, look at what they actually do and pick the next feature.

**Two improvement tracks to revisit with data (named June 2026):**

*The suggestion / "You've Been Here" system.* Now that it never echoes the just-sent prompt, the pool excludes throwaways, dismiss is query-scoped, and near-dup captures collapse, the next gains are in *recall and ranking*: rank matches by reuse/recency (a prompt you've copied before should beat a lexically-closer one you never touched), tune the similarity threshold from watched reactions, and — the big one — semantic recall via on-device embeddings to catch paraphrases trigrams miss (see #2 below).

*The storing system.* Selective capture and near-dup collapsing shipped. Next: precompute and cache trigram sets + an inverted index in the worker for scale (already flagged in operating notes); store an embedding per prompt at capture to power semantic search; and consider auto-archival of stale minor prompts.

Likely feature candidates, in rough order of value:

1. **Optional LLM features** (bring-your-own-key)
   - "Improve this prompt" button on a card (on-demand, not automatic)
   - Auto-tag suggestion (one-tap accept, never silent)
2. **Semantic resurface via local embeddings** — the real fix for the one thing trigram similarity can't do: catch paraphrases ("write a poem about cats" ↔ "compose verse about felines"). Run a small quantized embedding model fully on-device (e.g. transformers.js / ONNX-WASM), embed each prompt once at capture, cosine-match at query time. This is a genuine architectural decision, not a tweak: ~20–30 MB model bundle, a first-load init cost, and the "is the extension allowed to get that heavy" tradeoff. The clean design is a **hybrid** — keep the instant lexical path as-is and fall back to embeddings only when lexical finds nothing — so we keep today's speed and gain paraphrase recall, all still local ($0, no network). Deferred until Phase 1/2 reactions show lexical-only is actually leaving good matches on the table.
3. **Activity heatmap** — pure visualization on existing data, low risk
4. **Prompt chaining** — link prompts into named sequences for repeatable workflows
5. **Encrypted cloud sync** — E2EE only; never plaintext on a server
6. **Team / shared vaults** — likely a paid tier; only after individual product is great
7. **Mobile companion** — read-only browse + copy on the go

Explicitly **not** on the roadmap unless someone shows a clear reason:

- Scoring prompts on a 0–100 scale (concept-doc feature; cut on principle)
- Streaks and gamification points (the heatmap covers the same need without the anxiety)
- AI-generated "prompt of the day" suggestions
- Any feature that requires us to read prompt content on a server

---

## Operating notes

- **Selectors will break.** Every supported site (ChatGPT, Claude, Gemini, DeepSeek, Grok) changes its DOM every few weeks. Build a habit of testing capture on all of them after every release, lean on the capture-health view to catch silent breakage, and keep selector code in one file per site for fast fixes.
- **Latency budget.** From Enter keypress to toast: under 100 ms. From popup open to first result: under 50 ms. If we miss either, fix it before adding the next feature.
- **Resurface scaling (deferred until it bites).** Each debounced keystroke re-reads the whole prompt table and trigram-scans every row to find similar prompts. That's fine for hundreds of prompts; at thousands it'll start to drag — exactly when a power user's library is most valuable. The fix when (and only when) real libraries feel slow: a worker-scope cache of precomputed trigram sets plus an inverted index (trigram → prompts), so a query only scores candidates that share a rare trigram instead of the whole table. Premature now; building it before the data shows the slowdown is speculative. Flagged in `src/background/index.ts`.
- **Cost budget.** $0/month to operate v1. The moment we add a hosted feature, we have a different product with different risks; weigh that carefully.
- **Listening, not asking.** Don't run feature surveys. Watch how people use it, what they wish was faster, and what causes uninstalls.

---

## What "done" looks like for v1

A friend installs the extension. Closes the tab where they did the install. Forgets about it for two weeks. Then one day, mid-prompt on ChatGPT, they hit ⌘⇧K, find an old prompt in three keystrokes, copy it, and ship their work 5 minutes faster than they otherwise would have.

That moment is the whole product. Build until that moment is real, then keep that moment alive forever.
