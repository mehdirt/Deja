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
- Opt-in one-tap insert ✅ — settings toggle (`prefs.resurfaceClick`: insert by default, copy available). Still tune from real reactions whether insert-by-default stays right.

**Exit criteria:** During a normal week of AI use, the tooltip surfaces 3–10 times and is genuinely helpful in a clear majority of them — enough that users would notice and miss it if it were gone.

---

## Phase 3 — Light organization ✅ *(built)*

Once users have 50+ prompts, flat list isn't enough.

- Manual tags (user-added, no LLM): tag input in the library, multi-tag filter
- Favorite a prompt (heart) — filterable via Favorites only
- "Favorites" view (favorites only)
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
- Store screenshots ✅ — six `1280×800` PNGs in `store/screenshot-*-1280x800.png` (picker, resurface, library, popup, settings, search+sort). Dot-panel shot waiting on `PRESENCE_ENABLED`.
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
- **Redaction, not hashing/encryption** — hashing low-entropy PII is brute-forceable and unusable; encryption breaks search and adds key management for little gain (IndexedDB is origin-isolated). Redaction is deterministic, local, and turns prompts into safe *reusable templates* (`[email_1]`, `[card_1]`, `[secret_1]`).
- **High-precision regex + checksums** — email, Luhn-checked cards, structurally valid SSN, mod-97 IBAN, IPv4/6, phone, and known secret/token shapes (OpenAI/Anthropic/Stripe/AWS/GitHub/GitLab/npm/Shopify/Slack/Google/JWT/PEM). Tuned to under-detect rather than mangle. Same value → same number; optional private vault remembers originals for Fill-in only (never in backups). Names / street addresses via on-device NER are postponed.
- **On by default**, per-category toggles, remember-for-fill-in toggle, a live test box, and a "scan library & redact" action to retro-clean prompts captured before it was on. Redaction runs first in the background capture handler and on the resurface query so both sides match. Surfaced honestly ("remembered · N redacted").

**Capture deduplication — built (v0.4.1).** Exact matches and near-duplicates (≥75% similar) collapse into one row with usage bumped, so edit-resubmits and retries no longer flood the library past the 2 s debounce window.

**Query-scoped resurface dismissal — built (v0.4.1).** Dismissing the tooltip (× / Esc) suppresses that normalized query only — not the whole session — so a different prompt can still resurface.

---

## Phase 6 — Pick an audience and build for it ✅ *(built; July 2026)*

**What happened.** The extension shipped to the Chrome Web Store and went out to five testers. The most useful reaction came from a programmer who works mostly through coding agents: broadly positive, but he said he'd probably never use it — his tools already carry their own memory, rules, and skill files — and that Deja looked like it was really for ordinary question-and-answer users. That reframed the product. See `CONCEPT.md` → *Who it's for*.

**The finding that made it concrete.** `globals.css` named Inter and JetBrains Mono without shipping either file, so the fonts only resolved on machines that happened to have them installed — which in practice meant developers'. Everyone else saw an OS fallback. The product literally looked its best for the audience it was least useful to.

**Identity — done.**

- Fonts are **bundled** (`src/assets/fonts/*.woff2`, still zero network calls). Figtree for everything readable; Literata for the `deja` wordmark; JetBrains Mono confined to key hints, `[email]` placeholders, hostnames, and pattern rules.
- Prompt bodies moved from monospace to sans (`.dj-prompt`); metadata to `.dj-meta` with tabular numerals.
- **Sentence case everywhere.** The all-lowercase control convention was part of the terminal costume and is gone.
- **Plain-English vocabulary** across every surface — "save" not "capture", "never save from…" not "blocklist", "download a backup" not "export JSON". Full mapping in `DESIGN.md`.
- The in-page toast and resurface tooltip now use the **system UI font** on purpose, so they read as part of the host page.

**Onboarding — done.** A welcome view (`src/options/Welcome.tsx`, opened once on install) explains what will happen, in the order it happens, plus how to pin the extension. For a passive tool the failure mode was never a confusing setup screen — it was nothing visible happening and the extension being forgotten.

**Settings — done.** Everyday choices first (suggestions, what gets saved, where it works, hide personal info, your prompts); regex rules, per-category redaction, file restore, and permanent erase behind one collapsed *More options* drawer. Nothing was removed.

**Features for this audience — done.**

- **Fill-in-the-blank templates** (`src/lib/template.ts`). Finds `{topic}` blanks *and* the `[email]` placeholders PII redaction already leaves behind, then fills them in one pass. The reuse pattern for everyday users is "same shape, different details", so this is the highest-leverage feature we could add — and it costs nothing, because redaction was already creating the templates.
- **Everyday examples on an empty library** (`src/lib/starter.ts`). Ten hand-written prompts, each with blanks, shown only while there's nothing real to show. Fixed, never generated, never written to the DB — a worked example on a blank page, which is a different thing from the "prompt of the day" this roadmap rules out.
- **Forgiving search** (`src/lib/search.ts`). Plurals and British/American spellings fold together at index and query time; everyday synonyms run as a second pass appended after literal hits, so recall improves and precision doesn't move.
- **"Open chat"** on a saved prompt, using the URL already stored — but only when it points at a real conversation (`conversationUrl()`).
- **Throwaway filter retuned.** `hasSubstance()` used to recognise value as code, URLs, and file paths. A specified tone, audience, format, length, or a genuine question now counts too.

**Still open from this phase:** README, Chrome Web Store listing, and landing-page copy still describe the old positioning. Screenshots need retaking against the new UI.

**Exit criteria:** a non-technical person installs Deja, understands within a minute what it will do for them, and reuses a saved prompt in their first week without being shown how.

---

## Phase 8 — In-page mechanisms ✅ *(built; August 2026)*

Grammarly's actual mechanism was never grammar — it was **placement**: it lives in the box you're typing in. Deja was the opposite shape, a library you visit plus one tooltip that only fired above a similarity threshold, so on an ordinary day a user saw nothing at all. That is the Phase 6 failure mode restated.

Seven additions, all in-page, all individually switchable, and all additive — the popup stays the quick glance, the library stays home, and turning every one of them off leaves Deja behaving exactly as it did before.

- **A quiet dot** anchored to the chat box (`src/content/shared/presence.ts`), with a panel for search-and-insert. Its badge costs nothing: the resurface layer was already running one debounced `SIMILAR_QUERY`, and the count rides along on that response.
- **`//` to reach anything saved** (`picker.ts`) — word-boundary trigger so `https://` never opens it, 120 ms debounce, arrow keys / Enter / Tab, and blanks filled in place. Replaces only the `//query` token, because it can fire mid-sentence.
- **Turn it off from the dot** — never save from this site, or pause for an hour, both with undo. The controls already existed in settings; this is them at the moment of annoyance.
- **Suggestions follow what you reuse** (`suggestionRank` in `ranking.ts`) — a saturating normalisation keeps standing a tie-breaker rather than the main event, and dismissals damp rather than punish. No score is ever shown; a visible standing number is prompt scoring wearing a different hat.
- **Hand-save when a selector breaks** — the health probe already knew; now it tells the dot, and silent data loss becomes one click.
- **Welcome intent chips** filtering `starter.ts`, and **a welcome demo** that plays the resurface moment instead of describing it.

Two decisions worth keeping: shadow roots are now **closed** (an open root is readable by any page script, which stops being a narrow leak once a surface renders library rows), and **saving off is not reading off** — pause and per-site off dim the dot but leave the library reachable, while incognito and blocklisted domains remove the surfaces entirely.

**Still open:** the presentation surfaces. See `docs/plans/2026-08-10-in-context-mechanisms.md` → Phase H.

---

## Phase 7+ — Decide from data, not from this document

After ~50 users have used the v1 for a few weeks, look at what they actually do and pick the next feature.

**Two improvement tracks to revisit with data (named June 2026):**

*The suggestion / "You've Been Here" system.* Now that it never echoes the just-sent prompt, the pool excludes throwaways, dismiss is query-scoped, and near-dup captures collapse, the next gains are in *recall and ranking*: rank matches by reuse/recency (a prompt you've copied before should beat a lexically-closer one you never touched), tune the similarity threshold from watched reactions, and — the big one — semantic recall via on-device embeddings to catch paraphrases trigrams miss (see #2 below).

*The storing system.* Selective capture and near-dup collapsing shipped. Next: precompute and cache trigram sets + an inverted index in the worker for scale (already flagged in operating notes); store an embedding per prompt at capture to power semantic search; and consider auto-archival of stale minor prompts.

Likely feature candidates, in rough order of value:

1. **Optional LLM features** (bring-your-own-key)
   - "Improve this prompt" button on a card (on-demand, not automatic)
   - Auto-tag suggestion (one-tap accept, never silent)
2. **On-device NER for names / street addresses** — postponed. Was briefly shipped as an opt-in Transformers.js download; removed from the tree until the download/UX cost is worth revisiting. Structured regex PII stays.
3. **Semantic resurface via local embeddings** — the real fix for the one thing trigram similarity can't do: catch paraphrases ("write a poem about cats" ↔ "compose verse about felines"). Run a small quantized embedding model fully on-device (e.g. transformers.js / ONNX-WASM), embed each prompt once at capture, cosine-match at query time. This is a genuine architectural decision, not a tweak: ~20–30 MB model bundle, a first-load init cost, and the "is the extension allowed to get that heavy" tradeoff. The clean design is a **hybrid** — keep the instant lexical path as-is and fall back to embeddings only when lexical finds nothing — so we keep today's speed and gain paraphrase recall, all still local ($0, no network).

   Phase 6 shipped the cheap half of this instead: spelling/plural folding and everyday synonym expansion in `search.ts`, which costs bytes rather than megabytes and handles the vocabulary drift that shows up in ordinary use. That buys time to find out whether real libraries are actually losing good matches to paraphrase — the only thing that justifies a 20–30 MB model. **Decide with usage, not appetite.** Note the audience change cuts both ways here: everyday users phrase the same request more loosely than engineers do, so the case for embeddings may turn out stronger than it looked in June.
4. **Activity heatmap** — pure visualization on existing data, low risk
5. **Prompt chaining** — link prompts into named sequences for repeatable workflows
6. **Encrypted cloud sync** — E2EE only; never plaintext on a server
7. **Team / shared vaults** — likely a paid tier; only after individual product is great
8. **Mobile companion** — read-only browse + copy on the go

Explicitly **not** on the roadmap unless someone shows a clear reason:

- Scoring prompts on a 0–100 scale (concept-doc feature; cut on principle)
- Streaks and gamification points (the heatmap covers the same need without the anxiety)
- AI-generated "prompt of the day" suggestions
- Any feature that requires us to read prompt content on a server

---

## Operating notes

- **Selectors will break.** Every supported site (ChatGPT, Claude, Gemini, DeepSeek, Grok) changes its DOM every few weeks. Build a habit of testing capture on all of them after every release, lean on the capture-health view to catch silent breakage, and keep selector code in one file per site for fast fixes.
- **Latency budget.** From Enter keypress to toast: under 100 ms. From popup open to first result: under 50 ms. If we miss either, fix it before adding the next feature.
- **Resurface scaling (half done, August 2026).** Each debounced keystroke used to re-read the whole prompt table *and* trigram-scan every row. The `//` picker made the first half bite — it searches on a 120 ms debounce, so a keystroke meant two full-table reads — so `src/background/pool.ts` now caches the row list in worker scope and every write path invalidates it. The second half is still deferred and still speculative: precomputed trigram sets plus an inverted index (trigram → prompts), so a query only scores candidates sharing a rare trigram. Build that when real libraries feel slow *with* the cache in place, not before.
- **Cost budget.** $0/month to operate v1. The moment we add a hosted feature, we have a different product with different risks; weigh that carefully.
- **Listening, not asking.** Don't run feature surveys. Watch how people use it, what they wish was faster, and what causes uninstalls.

---

## What "done" looks like for v1

A friend installs the extension. Closes the tab where they did the install. Forgets about it for two weeks. Then one day, mid-prompt on ChatGPT, they open Deja from the toolbar, find an old prompt in a few seconds, copy it, and ship their work 5 minutes faster than they otherwise would have.

That moment is the whole product. Build until that moment is real, then keep that moment alive forever.
