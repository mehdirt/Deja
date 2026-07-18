# Deja — One-Month Go-to-Market Plan

Created: 2026-07-03

**Budget:** $5 (Chrome Web Store dev fee) + ~$11/yr optional domain · **Time:** ~5h/week (~21h total) · **Solo:** mehdirt, with Claude drafting everything draftable · **Starting state:** v0.4.1 store-ready (screenshots in `store/`), 5 testers lined up, 1k+ own audience, **repo going public (MIT)** — store listing stays Unlisted until the Week 2 go/no-go.

---

## 1. Objective & operating principles

**Objective:** In 4 weeks, take Deja from store-ready to publicly launched with its first ~100 users and validated positioning — without breaking the no-telemetry principle or the ~5h/week budget.

- **You are the bottleneck, so you only do what only you can do:** record, screenshot, post, reply, judge. Claude drafts every word (blog, posts, PH copy, DM templates, reply suggestions).
- **The soft-launch gate is real:** no loud launch until the resurface moment demonstrably lands (Week 2 go/no-go).
- **One asset, reused everywhere:** a single 30–45s screen demo becomes the LinkedIn video, X video, PH gallery clip, and blog GIF.

---

## 2. Positioning & messaging

**One-liner:** *Your prompts, every AI, one library.*

**Elevator:** You perfect a prompt, get a great answer — and it's gone in the scroll. Deja quietly saves every prompt you send across ChatGPT, Claude, Gemini, DeepSeek, and Grok, and resurfaces your old, better version the moment you start re-asking. Local-only: no account, no cloud, not even a network call.

**Audience segments (priority order):**

| Segment | Pain | Lead message |
|---|---|---|
| AI power users (devs, writers, PMs) | Re-crafting prompts they already perfected | The resurface moment — "you've been here before" |
| Multi-model hoppers | History trapped per vendor | One library across every AI — portable craft |
| Privacy-conscious users | Tools that phone home | Can't leak what it never sends — auditable on GitHub |

**Proof points (all true, all verifiable):** zero network calls (open source — auditable) · PII redacted before storage · credential fields never read · pause/per-site controls · JSON/Markdown export, no lock-in · $0, no account.

**Objection prep (doubles as the reply playbook):**

- *"ChatGPT already has history."* — Per-vendor, unsearchable-in-practice, and it never comes to you mid-typing. Deja is cross-AI and appears at the moment of re-asking, like a password manager at the login box.
- *"How do I know it's not harvesting prompts?"* — No network permissions beyond the 5 sites, no remote calls in the source (public repo), data-safety declaration matches. Audit it.
- *"Another extension reading my pages?"* — It reads only the prompt composer on 5 named sites; password/OTP/payment fields are structurally unreadable; PII is redacted before it ever hits disk.
- *"Why not embeddings/AI search?"* — Deliberate v1: instant, local, $0. Semantic matching is on the roadmap once lexical proves insufficient. (HN will respect the restraint.)

---

## 3. Asset list (owner · est. time)

| Asset | Owner | Time | When |
|---|---|---|---|
| `privacy.html` (policy page for the listing) | Claude | — | ✅ done (`site/privacy.html`) |
| Site hosted (Netlify Drop — drag & drop) | mehdirt | 0.5h | Wk 1 |
| 5 store screenshots (shot list in `store/assets.md`) | mehdirt | 1.5h | ✅ done (`store/screenshot-*-1280x800.png`) |
| 30–45s demo video (script in `store/assets.md`, captions, no voiceover) + GIF cut | mehdirt | 1h | Wk 2 |
| Blog post: "The prompt graveyard" (Dev.to) | Claude drafts / mehdirt edits | 1h | Wk 2→3 |
| LinkedIn: PDF-carousel post (top-performing format) + native-video variant | Claude drafts | 0.5h | Wk 2→3 |
| X thread (6–8 posts, native video, store link in **first reply** — link posts are reach-suppressed) | Claude drafts | 0.5h | Wk 2→3 |
| PH kit: tagline, description, gallery (reuse screenshots), maker's first comment | Claude drafts | 0.5h | Wk 3 |
| Show HN: title + explanatory first comment | Claude drafts | — | Wk 3 |
| Warm-DM template (~20 closest contacts, PH day) | Claude drafts | — | Wk 3 |
| MIT LICENSE + uncomment site source links + feedback → GitHub Issues | Claude | — | ✅ done (human flips GitHub → Public) |

---

## 4. Week-by-week calendar

### Week 1 (Jul 3–9) — Submit & seed · ~5h

1. Dev account: $5, 2FA, **non-trader** declaration (0.5h) — *do first; verification can lag*
2. ~~Buy a domain~~ **Decided: launch on the free Netlify subdomain; buy a domain only if traction shows.** Revisit trigger: Week 4 retro shows ≥100 installs → buy `dejaprompts.com` (likely available per 2026-07-03 DNS check; `deja.app`/`getdeja.com`/`trydeja.com` taken) at Porkbun or Namecheap (at-cost) and add it to the **same** Netlify site — the old `*.netlify.app` URL keeps working, so no links break.
3. **Host on Netlify Drop** (free account). Chosen over Vercel for pure friction: drag-and-drop in the browser, no git/CLI. Go to `app.netlify.com/drop` → drag the `site/` folder onto the page → **rename the site** in Site settings to something clean (e.g. `dejaprompts` → `dejaprompts.netlify.app`) since this URL goes on the listing and social posts. Note the `https://…/privacy.html` URL for the listing. *(Fallback: if Netlify signup is blocked in your region, Vercel serves the same files identically — no plan changes.)* (0.5h)
   - **Feedback (done in-repo):** settings open prefilled GitHub Issues — no personal Gmail in the tree. Optional later: set `FEEDBACK_URL` to a hosted form, or a `feedback@` alias if you buy a domain.
4. ~~Seed library + capture 5 screenshots~~ ✅ (`store/screenshot-*-1280x800.png`)
5. Zip `dist/` → upload → paste `store/listing.md` copy → **visibility: Unlisted** → submit (1h)
6. On approval: send unlisted link to the 5 testers with a 3-line brief — *"install it, use AI normally, I'll ask you 4 questions in a week"* (0.5h)
7. Buffer / fixes (0.75h)

### Week 2 (Jul 10–16) — Watch, fix, produce · ~5h

1. Mid-week tester ping + end-week structured debrief: Did the tooltip appear? Was it right? Did you copy from it? Is it still installed? (1h)
2. Fixes / threshold tuning from feedback — with Claude (2h)
3. Record demo video + GIF (1h)
4. Edit Claude's drafts: blog, LinkedIn, X, PH kit (1h)
5. **🚦 GO/NO-GO (end of week):** resurface surfaced during normal use and helped ≥ half the time; ≥1 tester keeps it unprompted. **No-go →** Weeks 3–4 shift right one week; iterate. A late launch beats a dead-on-arrival one.

### Week 3 (Jul 17–23) — Go public & own-feed · ~5h

1. Confirm GitHub is **Public**; listing → **Public** when the Week 2 go/no-go passes; swap `REPLACE_EXTENSION_ID`; redeploy site (1h)
2. Publish blog on Dev.to (0.5h)
3. **Tue 8–10 AM (audience TZ):** LinkedIn carousel post; video variant Thu. CTA: "search *Deja* on the Chrome Web Store" (external links are penalized; store search works once the listing is Public) (1h)
4. **Wed:** X thread, native video, link in first reply, #buildinpublic (0.5h)
5. Warm DMs to ~20 contacts: *"launching on PH Tuesday — would love your honest take that day"* (never "please upvote" — penalized) (1h)
6. Schedule the PH launch for Tuesday of Week 4; engage all replies in evening windows (1h)

### Week 4 (Jul 24–31) — Launch week · ~6h

1. **Mon:** pre-flight — capture health green on all 5 sites; hotfix path tested (`npm run release`) (0.5h)
2. **Tue — Product Hunt:** live 12:01 AM PT ≈ **11:31 AM Tehran time**. Post the maker comment immediately (lunch window), engage hard through the evening (= US morning peak, the critical first hours). Respond to every comment. (2.5h)
3. **Thu — Show HN**, posted in the evening (= US morning): title `Show HN: Deja – Local-only prompt library across ChatGPT, Claude, Gemini (no network calls)`. First comment: why local-first, the trigram-not-embeddings tradeoff, what feedback is wanted. Concede valid criticism gracefully; never argue. (1.5h)
4. **Fri:** r/SideProject post (context-rich: what/why/stack/feedback-wanted — no bare links). Skip other subs unless the account has ≥100 karma / 30-day age; check each sidebar first. (1h)
5. **Sun:** retro — metrics snapshot, reply backlog, decide the next cycle (0.5h)

---

## 5. Launch-day runbooks (condensed)

**Product Hunt (Tue):** self-hunt (now the norm — most #1 products are self-hunted) · schedule in advance · gallery = 5 screenshots + GIF first · maker comment = the story in 5 lines + one honest limitation + a question to the community · reply <10 min during the evening window · the warm network engages because they know *the date*, not because they were asked for votes · targets: front-page top-10 stretch; 20+ genuine comments realistic.

**Show HN (Thu):** no signup barrier ✓ public repo ✓ — lead with the auditable claim ("zero network calls — check the source"). Expected pushback and answers:
- selector fragility → capture-health self-detection + one-file-per-site fixes
- "regex PII is incomplete" → agreed; documented as structural-PII-only, NER deferred
- "why not Firefox" → MV3 Chrome first, port planned
Never solicit votes; posting updates/edits in comments is fine.

---

## 6. Metrics without telemetry (weekly snapshot, Sundays)

| Metric | Source | Wk 2 | Wk 4 target |
|---|---|---|---|
| Installs / weekly users | CWS dashboard | 5 testers | 100 / 60 |
| Tester retention (still installed, unprompted) | Ask them | ≥3 of 5 | — |
| Resurface "it helped" reports | Conversations | ≥ half of appearances | recurring |
| PH result | PH page | — | top-10 day stretch; comment quality > votes |
| HN result | thread | — | ≥20 points = good; comment quality is the real prize |
| Feedback emails | inbox | any | ≥5 substantive |
| Listing impressions → installs conversion | CWS dashboard | — | baseline set |

The single metric that matters: **do people who install it still have it two weeks later.** Everything else is reach, not truth.

---

## 7. Risks & contingencies

| Risk | Mitigation |
|---|---|
| Store review slow / rejected | Submitted Wk 1 for a Wk 3 flip — 2 weeks of buffer; rejections are usually listing-fixable in one resubmit (justifications pre-written) |
| Resurface doesn't land with testers | The Wk 2 gate exists precisely for this — slip the loud launch, tune, retest. Do not launch through it |
| PH flops (<20 votes) | Acceptable — PH is one spike; HN + store search + blog are the compounding channels. Never buy/beg votes |
| HN hostility | Public repo + modest claims + conceding valid points converts skeptics; worst case it's free QA |
| A site changes its DOM during launch week | Mon pre-flight + capture-health + `npm run release` hotfix path (~30 min turnaround) |
| Time overrun | Cut order: Reddit → LinkedIn video variant → blog polish. Never cut: tester debrief, PH maker presence, HN replies |

**Deliberately cut at 5h/week** (stretch goals if a week runs light): short-form video (TikTok/Shorts/Reels), Indie Hackers, extra subreddits, promo tiles/marquee.

---

## 8. Channel-mechanics notes (researched 2026-07, sources verified)

- **Product Hunt:** launches go live 12:01 AM PT; Tue–Thu highest traffic; first ~4 hours weighted heavily; self-hunting favored since 2025; explicit upvote solicitation penalized; "Featured" is editorially curated — clear descriptions matter.
- **LinkedIn:** external links in the body cut reach 50–70% and the link-in-first-comment trick is now detected and penalized too; PDF/document carousels are the top-performing format; dwell time is the primary ranking factor; Tue 8–10 AM best.
- **X:** link posts get near-zero reach for non-Premium accounts — put the link in the first reply; native video ~10x text; threads ~3x singles; replies weighted far above likes.
- **Show HN:** must be tryable without signup; personal work; no vote solicitation; local-first/privacy tools have strong recent precedent.
- **Reddit:** r/SideProject welcomes context-rich maker posts; most other subs enforce karma/age minimums and 90/10 self-promo ratios — check each sidebar before posting.
