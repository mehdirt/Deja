# Contributing to Deja

Thanks for being here. Deja is a small, deliberately narrow extension, and the
constraints below are most of what makes it work — they're the first thing to
read, not the fine print.

**Not a developer?** You don't need this file. Use the buttons inside Deja
(Settings → *Tell me what you think*), or
[open a report](https://github.com/mehdirt/Deja/issues/new/choose) — the forms
are written in plain language and ask only what's needed.

---

## The five rules that override everything else

A change that breaks one of these won't be merged, however good it is otherwise.
They're not style preferences; each one is load-bearing for the product.

1. **Nothing leaves the machine.** No network calls, no telemetry, no analytics,
   no third-party services, no "anonymous" pings. There is no `fetch` in the
   capture or storage path and there should never be one. A feature that needs
   the network needs an explicit, user-facing opt-in and a product decision
   first.
2. **Only the prompt composer, only the prompt text.** Not responses, not
   arbitrary text fields, not page content. `SECURITY.md` §3 is the eligibility
   framework every capture path must pass; `src/lib/sensitive.test.ts` locks it
   in. This rule exists because it was violated once — see the incident log.
3. **Never break the host page.** Content scripts run inside someone else's
   site. Fail silently, catch everything, and never let a Deja bug disturb
   ChatGPT or Claude. `sendCapture` swallowing runtime errors is intentional.
4. **Plain language is a feature.** Deja is for people who don't write code —
   someone drafting an awkward email, not an engineer running agents. "Save",
   not "capture". "Never save from…", not "blocklist". The voice table in
   `DESIGN.md` is the reference, and it applies to every string a user can see.
5. **Local, pure, and testable where it can be.** The classifier, search,
   similarity, redaction, and formatting are pure modules with unit tests beside
   them. Keep new logic in that shape rather than tangled into a React component
   or a message handler.

If a change seems to require breaking one of these, that's worth an issue before
it's worth a pull request.

---

## Getting set up

```bash
npm install
npm run dev          # Vite dev build with HMR
```

Then load the extension:

1. Open `chrome://extensions` and turn on **Developer mode**
2. **Load unpacked** → select the `dist/` directory
3. Visit chatgpt.com, claude.ai, gemini.google.com, chat.deepseek.com, or
   grok.com and send a prompt — it should appear in the popup

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev build with HMR |
| `npm run build` | Production build to `dist/` (runs `tsc --noEmit` first) |
| `npm run typecheck` | Types only |
| `npm run lint` | ESLint over `src` |
| `npm run test` | Vitest, one-shot |
| `npm run test:watch` | Vitest in watch mode |

A single file: `npx vitest run src/lib/similarity.test.ts`

---

## Where things live

`CLAUDE.md` has the full architecture tour. The short version: four execution
contexts (content scripts, background service worker, popup, options page) with
shared logic in `src/lib/`. Two things are worth knowing before your first
change:

- **Site selectors live in `src/content/<platform>/index.ts` and nowhere else.**
  These sites change their DOM regularly, so keeping selectors in one obvious
  place per platform is what makes the inevitable fix a two-line patch. Resist
  scattering them.
- **MV3 service workers die constantly.** Don't keep state in module scope in
  `src/background/`. Anything whose loss would change behaviour belongs in
  Dexie. (`src/background/pool.ts` is the one sanctioned exception, and only
  because losing it costs a re-read and nothing else.)

---

## The easiest useful contribution

**A site stopped saving.** It's the most common real failure and usually a small
fix: the site changed its composer markup and the selector no longer matches.

1. Reproduce it — send a prompt on the site, confirm nothing is saved
2. Find the composer element in devtools
3. Update the selector in `src/content/<platform>/index.ts`
4. Add or adjust a test if the shape of the fix allows one
5. Say in the PR which site and how you confirmed it

These get reviewed fastest, because they're unblocking real people.

---

## Making a change

**Branch from `main`.** One logical change per branch and per commit — a
selector fix and a copy tweak are two pull requests, not one.

**`main` is protected.** Merging needs a passing CI run and one approving
review — direct pushes aren't accepted from anyone but the repo owner. This is
enforced by GitHub, not just written down here.

**Commit messages** follow Conventional Commits, since the release notes are
derived from them:

```
fix(capture): keep the Grok composer selector working after the Jan redesign
feat(library): sort by longest-unseen
docs: explain why resurface reads through the same gate as capture
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`.
Write the body for someone reading it in six months who wasn't here: what broke,
why this fixes it, what you decided not to do.

**Before you open the PR**, run what CI runs:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

**Tests.** New logic in `src/lib/` needs a test beside it. For a bug fix, the
most valuable thing you can write is the test that fails before your change —
it's what stops the bug coming back. Tests use Vitest with happy-dom.

Two things worth testing that are easy to miss:

- The **negative** case. For anything that filters, hides, or skips, assert what
  must *survive*. A rule that quietly discards a real prompt is worse than one
  that keeps too much, and it's invisible without that test.
- Anything **user-facing that can fail silently** — a link that stops carrying
  its payload, a message the page never shows.

**Docs.** If you change architecture, an API, storage, config, or a user-facing
string, update the matching doc in the same PR: `README.md` for behaviour,
`DESIGN.md` for voice and visual rules, `SECURITY.md` for anything touching
capture eligibility, `CLAUDE.md` for architecture. A dated entry in
`MEMORY/LOG.md` is the minimum.

---

## What gets merged, and what doesn't

Deja v1 is intentionally lean. These are **out of scope** — not bad ideas,
just a different product, and `ROADMAP.md` records why each was deferred:

LLM-based scoring · auto-categorization · streaks · "prompt of the day" · score
trends · cloud sync · accounts · team vaults · prompt chaining · a mobile
companion · capturing AI responses.

Semantic (embedding-based) search is **deferred, not rejected** — it's a real
decision about bundle size rather than a tweak. Talk about it in an issue first.

**Likely to be merged quickly:** selector fixes, a failing test for a real bug,
accessibility fixes, plain-language copy improvements that match the voice
table, performance work with a measurement attached.

**Needs discussion first:** new dependencies (the bundle ships to every user and
every dependency is a supply-chain surface), new permissions in the manifest,
anything that changes what's captured, new UI in the first screen of settings,
anything touching the security framework.

---

## Review

You'll get a real review, not a rubber stamp. Expect questions about edge cases
and about wording — copy is reviewed as carefully as logic here, because the
vocabulary is what tells a non-technical person whether the product is for them.

What review looks for, roughly in order: does it break one of the five rules;
is it correct at the edges; does a user-visible failure mode exist that isn't
covered by a test; does the copy match the voice table; is the change scoped to
one thing.

Disagreement is fine and useful — if you think a review comment is wrong, say
so with your reasoning. Decisions and their rationale end up in `MEMORY/LOG.md`
so the next person doesn't have to re-litigate them.

---

## Security

**Don't open a public issue for a capture leak.** If Deja stored something it
shouldn't have — a password, a field outside the composer, text from a
blocklisted site — report it through
[private advisories](https://github.com/mehdirt/Deja/security/advisories/new).
A public issue tells everyone how to reproduce it before there's a fix.

`SECURITY.md` has the threat model, the capture-eligibility rules, and the
pre-release checklist. Read §3 before touching anything on a capture path.

---

## Reporting anything else

Use [the issue forms](https://github.com/mehdirt/Deja/issues/new/choose). Blank
issues are turned off on purpose — the forms ask the two or three things that
turn "it doesn't work" into something fixable.

Whatever you're filing: **no real prompt text, no personal information.** Issues
are public, prompts contain people's lives, and the whole product is a promise
that they stay on the machine. Describe it instead, or use synthetic examples.

---

## Code of conduct

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). It's
short: be decent, assume good faith, and remember that most people filing an
issue here aren't developers.
