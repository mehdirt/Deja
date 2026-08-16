# Deja — Launch Plan v2

Created: 2026-08-16 · Supersedes [`2026-07-03-deja-gtm-launch-plan.md`](2026-07-03-deja-gtm-launch-plan.md) (kept for history; channel mechanics notes in §8 there still apply where not repeated here).

**Budget:** $5 (Chrome Web Store dev fee) · **Time:** ~6h/week (video + 7 channels now, up from 5h/week) · **Solo:** mehdirt, Claude drafts everything draftable · **Starting state:** v0.6.0, repo public since inception (MIT), CWS **nothing done** (no dev account, no listing, site not actually deployed yet despite `dejaprompts.netlify.app` already wired into `site/index.html`'s meta tags) — store listing stays **Unlisted** until the resurface moment is confirmed landing with real testers.

---

## 0. What changed since the July plan

The July plan was written against v0.4.1. Since then, shipped and load-bearing for the pitch:

- **The in-page surfaces (M1–M7)** — the ambient dot + panel, the `//` picker with fill-in blanks, per-site off from the panel footer, hand-save when a selector breaks, learned suggestion ranking, welcome intent chips, welcome demo. This is the single biggest change to *what Deja is* since the last plan — the July demo script (passive-save-then-wait) undersells the product. Lead the new pitch with `//`, not with the tooltip.
- **Selective capture got honest.** `balanced` strength now actually skips throwaways (`isTopicless`), and every skip except pure filler offers a *Keep it* button back. Worth a line in the privacy/control pitch: nothing you send is silently gone without a way to reclaim it.
- **Feedback has a door for non-technical users.** Hosted Tally form, no GitHub account needed — matters for HN/PH threads where "I'd love to try it but don't want a GitHub account" used to be a real objection.
- **Community infrastructure exists but is half-wired.** `CONTRIBUTING.md`, issue forms, PR template, branch protection on `main` (✅ 2026-08-14) are live. **Private vulnerability reporting, Discussions, and the 4 custom labels the issue forms apply (`needs triage`, `capture-health`, `idea`, `dev`) are still OFF** as of this writing (`gh label list` confirms only GitHub's stock defaults exist). This blocks the "developers can contribute" half of this launch — see §1.5.
- **Store assets are stale, not just incomplete.** The 5 screenshots in `store/` are dated 2026-07-10 — before fonts were bundled, before the in-page surfaces existed at all. They need a full recapture, not a touch-up, and there are two new surfaces (`//` picker, the dot's panel) with no shot yet.
- **Version is 0.6.0**, correctly tagged in `package.json` and README.

---

## 1. Objective & operating principles

**Objective:** publish Deja publicly (Chrome Web Store + landing page), produce a real demo video and screenshot set, and run a coordinated content push across LinkedIn, X, Hacker News, Medium, Telegram, Product Hunt, and Reddit — while opening the repo up for actual outside contributions, not just visibility.

- **Two audiences, two asks.** Everyday users get "try it, it just works" — the resurface moment, the plain language, the privacy story. Developers (HN, the repo itself, PH's more technical fringe) get "audit it, and here's a good first issue" — the second ask only works if §1.5 is actually done.
- **One video, cut three ways.** A single 60–120s narrated walkthrough is the master asset: full cut for YouTube, 15–30s clips for LinkedIn/X native video and the PH gallery.
- **The soft-launch gate is still real.** No loud push (HN/PH/broad social) until the resurface moment demonstrably lands with real testers — same gate as July, unmoved.
- **Contribution readiness is a launch blocker, not a nice-to-have.** Announcing "open source, come contribute" into HN while the repo's own issue forms silently mislabel every submission is worse than not asking.

### 1.5 Contribution-readiness checklist (do before any public push)

Straight from `docs/ops/community-runbook.md` §1, still open:

- [ ] **Private vulnerability reporting** (Settings → Code security) — `SECURITY.md` and the issue chooser link to `/security/advisories/new`; it 404s today.
- [ ] **Discussions** (Settings → General → Features) — the issue chooser offers it for questions; dead link today.
- [ ] **4 custom labels** (`needs triage`, `capture-health`, `idea`, `dev`) — issue forms apply these on submission; none exist, so every submission today is silently unlabeled.
- [ ] Seed 3–5 **`good first issue`**-labeled tickets before the HN/PH push — an empty issue tracker with a "contributions welcome" badge reads as decoration.

All four are pure GitHub Settings clicks or issue creation — no code, ~20 minutes total.

---

## 2. Positioning & messaging

**One-liner:** *Your prompts, every AI, one library.*

**Elevator (updated for the in-page surfaces):** You perfect a prompt, get a great answer — and it's gone in the scroll. Deja quietly saves every prompt you send across ChatGPT, Claude, Gemini, DeepSeek, and Grok, lets you pull any of them back into the box with `//` without leaving the page, and taps you on the shoulder with your old, better version the moment you start re-asking. Local-only: no account, no cloud, not even a network call.

**Audience segments (priority order):**

| Segment | Pain | Lead message |
|---|---|---|
| AI power users (devs, writers, PMs) | Re-crafting prompts they already perfected | `//` to pull it straight back into the box — no library trip |
| Multi-model hoppers | History trapped per vendor | One library across every AI — portable craft |
| Privacy-conscious users | Tools that phone home | Can't leak what it never sends — auditable on GitHub |
| **Developers (new emphasis)** | Want to fix/extend a tool they actually use | MIT, ~15 files of shared core (`src/lib/`), site-selector fixes are a great first PR |

**Proof points (all true, all verifiable):** zero network calls (open source — auditable) · PII redacted before storage, on-device optional NER for names/places · credential fields structurally unreadable · pause/per-site controls, saving-off ≠ reading-off · JSON/Markdown export, no lock-in · $0, no account · every selective-capture skip except pure filler offers a one-click *Keep it* back.

**Objection prep (unchanged from July, still holds):** see the July plan §2 — "ChatGPT already has history", "how do I know it's not harvesting", "another extension reading my pages", "why not embeddings" are all still the right four to pre-empt.

---

## 3. Asset list

| Asset | Owner | Status |
|---|---|---|
| Landing page (`site/`) | done, **not deployed** | deploy to Netlify this cycle — URLs already point at `dejaprompts.netlify.app`, so this is a drag-and-drop, not a rewrite |
| `privacy.html` | done | redeploys with the site |
| 7 store screenshots (5 retaken + 2 new: `//` picker, dot panel) | mehdirt | **all pending** — current set is pre-font-bundle, pre-in-page-surfaces |
| 60–120s narrated walkthrough video | mehdirt (voice) + Claude (script) | pending — script below |
| YouTube upload + description + chapters | mehdirt | pending |
| 15–30s cut-downs (LinkedIn, X, PH gallery) | mehdirt (edit) | pending, sourced from the master video |
| Medium post: "The prompt graveyard" (replaces the July plan's Dev.to slot) | Claude drafts | pending |
| LinkedIn: native-video post + PDF-carousel variant | Claude drafts | pending |
| X thread (6–8 posts, native video, link in first reply) | Claude drafts | pending |
| Show HN: title + first comment | Claude drafts | pending |
| Telegram: announcement post for relevant AI-tools / open-source groups the account already has standing in | Claude drafts, mehdirt posts | pending — needs mehdirt to name which groups/channels (no cold-posting into groups without standing) |
| PH kit: tagline, gallery, maker's first comment | Claude drafts | pending |
| Reddit: r/SideProject context-rich post | Claude drafts | pending |
| Contribution readiness (§1.5) | mehdirt (Settings clicks) + Claude (seed issues) | pending |

---

## 4. Video script (master asset, 60–120s, narrated)

Longer than July's silent 30s cut because a YouTube upload needs to earn a click on its own, not just caption a screen recording. Structure: hook → the three moments → privacy → CTA.

1. **(0–8s) Hook.** Cold open on a half-remembered prompt: someone typing "write a firm but friendly email about..." and trailing off, reaching for a browser history search that comes up empty. VO: *"You've written this before. You just can't find it."*
2. **(8–25s) Save, invisibly.** Send a prompt on ChatGPT. Toast: "Saved for you ✔ · Undo". VO: no buttons, no folders — every prompt across five AI tools, saved the second you hit send.
3. **(25–45s) `//` — pull it back.** New chat, type `//land`, picker opens, pick the landlord email, blanks step fills "the broken heating", prompt lands in the box, send. VO: *your own words, back in two keystrokes, without leaving the page.*
4. **(45–60s) The resurface moment.** Start retyping something similar from scratch; tooltip surfaces the old version; one click swaps it in. VO: *and when you forget you've already written it — it remembers for you.*
5. **(60–80s) The dot + privacy.** Click the quiet corner dot, show the panel, show turning saving off for one site from the footer. VO: local-only, no account, no cloud — the source is public, go read it.
6. **(80–95s) Close.** Logo, one-liner, install CTA, GitHub star CTA for the developer cut. *"Deja — your prompts, every AI, one library. Open source, MIT."*

Cut-downs: 8–45s → LinkedIn/X (the `//` moment is the hook, resurface is the payoff); 25–60s → PH gallery clip.

---

## 5. Week-by-week calendar

### Week 1 — Deploy, seed contribution readiness, submit · ~6h

1. **Contribution readiness (§1.5)** — GitHub Settings clicks + seed 3–5 `good first issue` tickets (0.5h)
2. **Deploy `site/`** to Netlify (drag-and-drop, matches wired `dejaprompts.netlify.app` URLs already in the HTML) (0.5h)
3. **Dev account:** $5, 2FA, non-trader declaration (0.5h) — do first, verification can lag
4. **Recapture all 7 screenshots** (5 retakes + `//` picker + dot panel) on a fresh seeded library, fonts bundled, current UI (2h)
5. **Zip `dist/` → submit listing, Unlisted**, paste `store/listing.md` copy, link the now-live privacy URL (1h)
6. Send unlisted link to testers — same 3-line brief as July: *install it, use AI normally, I'll ask you 4 questions in a week* (0.5h)
7. Buffer (1h)

### Week 2 — Watch, fix, produce the video · ~6h

1. Mid-week ping + end-week debrief with testers: did the tooltip appear, was it right, did they use `//`, still installed? (1h)
2. Fixes / threshold tuning from feedback (2h)
3. **Record + edit the master video** (script above), export cut-downs (2h)
4. Draft: Medium post, LinkedIn, X thread, HN post, Telegram post, PH kit, Reddit post — all from Claude, mehdirt edits (1h)
5. **🚦 GO/NO-GO:** resurface or `//` demonstrably helped ≥ half the time it came up; ≥1 tester keeps it unprompted. No-go → slip Weeks 3–4 by one week, iterate. Same gate as July.

### Week 3 — Go public, own-feed channels · ~6h

1. Confirm listing → **Public** once the gate passes; swap `REPLACE_EXTENSION_ID` anywhere it still appears; redeploy site (1h)
2. **Publish YouTube video** — full narrated cut, description with timestamps + GitHub link (0.5h)
3. Publish Medium post (0.5h)
4. **Tue 8–10 AM:** LinkedIn video post; carousel variant Thu (1h)
5. **Wed:** X thread, native video cut-down, link in first reply (0.5h)
6. **Telegram:** post in the groups/channels mehdirt already has standing in — name them before this step, don't cold-post (0.5h)
7. Warm DMs to ~20 contacts for the PH day ask (never "please upvote") (1h)
8. Schedule PH launch for Tuesday of Week 4 (0.5h)

### Week 4 — Launch week · ~7h

1. **Mon:** pre-flight — capture health green on all 5 sites, hotfix path tested (`npm run release`) (0.5h)
2. **Tue — Product Hunt:** live 12:01 AM PT, maker comment immediately, engage through the evening window (US morning peak) (2.5h)
3. **Thu — Show HN**, posted in the evening (US morning). Title: `Show HN: Deja – Local-only prompt library across ChatGPT, Claude, Gemini (no network calls)`. First comment covers local-first rationale, the trigram-not-embeddings tradeoff, and **explicitly invites PRs** — this is the thread where the contribution-readiness work in §1.5 earns its keep. Concede valid criticism; never argue. (1.5h)
4. **Fri:** r/SideProject post — context-rich, no bare link, check karma/age minimums (1h)
5. **Sat/Sun:** triage anything landing in the now-live issue forms per `docs/ops/community-runbook.md` §3 — this week is the first real test of that process (1h)
6. **Sun:** retro — metrics snapshot, reply backlog, decide next cycle (0.5h)

---

## 6. Launch-day runbooks (condensed)

**Product Hunt (Tue):** self-hunt · schedule in advance · gallery = 7 screenshots + video cut-down first · maker comment = story in 5 lines + one honest limitation + a question to the community · reply <10 min during the evening window · targets: front-page top-10 stretch, 20+ genuine comments realistic.

**Show HN (Thu):** no signup barrier ✓ public repo ✓ — lead with the auditable claim. Expected pushback: selector fragility → capture-health self-detection; "regex PII incomplete" → agreed, NER is opt-in and documented; "why not Firefox" → MV3 Chrome first, port plausible. **New this cycle:** mention the `good first issue` labels directly — HN responds better to "here's exactly where to start" than a bare "PRs welcome".

**Telegram:** no universal playbook — mechanics are per-group. Post where mehdirt already participates (AI tools, open-source, indie-hacker groups); a cold announcement in a group with zero prior presence reads as spam and often gets removed. Confirm the group list before drafting copy — tone differs by community.

**Medium:** longer-form than the July Dev.to slot — "The prompt graveyard" story, screenshots inline, closes with both install CTA and GitHub CTA (two audiences, two asks — see §1).

---

## 7. Metrics without telemetry (weekly snapshot, Sundays)

Same table shape as July §6, updated targets for the wider push:

| Metric | Source | Wk 2 | Wk 4 target |
|---|---|---|---|
| Installs / weekly users | CWS dashboard | 5 testers | 150 / 80 |
| Tester retention (still installed, unprompted) | Ask them | ≥3 of 5 | — |
| Resurface / `//` "it helped" reports | Conversations | ≥ half of appearances | recurring |
| YouTube views / retention past 30s | YouTube Studio | — | baseline set |
| PH result | PH page | — | top-10 day stretch |
| HN result | thread | — | ≥20 points good |
| **Issues opened by outside contributors** (new) | GitHub | — | ≥1 real PR from someone who isn't mehdirt |
| Feedback form submissions | Tally | any | ≥5 substantive |

The single metric that still matters most: **do people who install it still have it two weeks later.** The new one worth watching alongside it: **does anyone outside mehdirt open a PR** — that's the actual test of whether "open source, contribute" was more than a badge.

---

## 8. Risks & contingencies

| Risk | Mitigation |
|---|---|
| Store review slow / rejected | Submit Wk 1 for a Wk 3 flip — 2-week buffer, justifications pre-written in `store/listing.md` |
| Resurface / `//` doesn't land with testers | Wk 2 gate exists for exactly this — slip the loud launch, tune, retest |
| **Contribution readiness slips and HN/PH push goes out anyway** | §1.5 is a hard blocker in this plan, not a parallel task — do it Week 1, verify with `gh label list` before Week 4 |
| Video production runs long (new risk vs. July's silent 30s cut) | Cut scope to the 45s core (steps 1–3 of the script) rather than slipping the whole calendar |
| PH flops (<20 votes) | Acceptable — HN + store search + Medium are the compounding channels |
| HN hostility | Public repo + modest claims + conceding valid points converts skeptics |
| A site changes its DOM during launch week | Mon pre-flight + capture-health + `npm run release` hotfix path (~30 min) |
| Telegram post reads as spam in an unfamiliar group | Only post where standing already exists; confirm the group list before drafting |
| Time overrun (7 channels + video is more than July's 5h/week) | Cut order: Reddit → LinkedIn carousel variant → Medium polish. Never cut: tester debrief, PH maker presence, HN replies, §1.5 |

---

## 9. Channel-mechanics notes carried over unchanged

Product Hunt, LinkedIn, X, Show HN, and Reddit mechanics researched 2026-07 in the July plan §8 still apply verbatim — not re-verified this cycle, re-check before Week 3 if more than a few weeks have passed since 07-03.
