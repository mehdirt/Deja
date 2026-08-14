# Community runbook — issues, triage, and contributions

How reports arrive, what happens to them, and the one-time GitHub setup the
flow depends on. Written 2026-08-13, when the contribution flow was first set
up; update it as the process meets reality rather than guessing ahead.

The public-facing halves live in `CONTRIBUTING.md` (for contributors) and the
issue forms (for everyone). This file is the maintainer side.

---

## 1. One-time GitHub setup

The files in the repo only work if these are switched on. Nothing here is
automatic — do them in the repo's **Settings** tab. Status below checked
directly against the live repo on 2026-08-14, not assumed from the docs.

| Setting | Where | Status | Why it matters |
| --- | --- | --- | --- |
| **Branch protection on `main`** | Settings → Branches | ✅ **Done** (2026-08-14) | PR + 1 approval + passing `check` (CI) required to merge; no force-push, no deletion, linear history. Admins exempt so the owner's direct-commit workflow still works. |
| **Private vulnerability reporting** | Settings → Code security | ❌ **Not enabled** | `SECURITY.md`, the issue chooser, and `CODE_OF_CONDUCT.md` all link to `/security/advisories/new`. Without it those links 404 — and a capture leak has nowhere private to go, so it lands in a public issue instead. **Do this one first**, before announcing the repo anywhere. |
| **Discussions** | Settings → General → Features | ❌ **Not enabled** | The issue chooser offers Discussions for questions. Same problem if it's off: a dead link on the page people see first. |
| **Labels** | Issues → Labels | ❌ **Not created** | Only GitHub's stock defaults exist (`bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`). The forms apply `needs triage`, `capture-health`, `idea`, and `dev` on submission — none of those four exist yet, so every form submission is silently missing its label. Create them before announcing anywhere. |

Suggested labels beyond the four the forms need:

`selector-drift` · `privacy` · `voice` (copy/wording) · `needs repro` ·
`blocked` — `good first issue`, `help wanted`, and `wontfix` already exist as
GitHub defaults.

---

## 2. Where reports come from

Three doors, on purpose:

1. **Inside the extension** — Settings → *Tell me what you think* opens a
   prefilled issue form. Also the capture-health warning ("Deja may not be
   saving on X"), which opens the site-specific form with the site preselected.
   This is the main door for everyday users, and the only one they'll find.
2. **The issue chooser** — `/issues/new/choose`, for anyone arriving from the
   repo or the store listing.
3. **Private advisories** — for capture leaks only.

`src/lib/feedback.ts` builds the in-app links, and `feedbackFormFields.test.ts`
fails the build if a link stops matching a form. That test exists because the
failure is otherwise **silent**: GitHub ignores a query param that doesn't match
a field `id`, so a renamed field just quietly loses the prefill. If you rename a
field in a form, run the tests.

**The known gap:** filing an issue needs a GitHub account, and most of the
people Deja is built for don't have one. `FEEDBACK_URL` in `feedback.ts` is the
escape hatch — set it to a hosted form (Tally, Google Forms) and every in-app
button routes there instead, no code change beyond the constant. Worth doing
before any push to non-technical users.

---

## 3. Triage

Aim to touch every new issue once within a few days, even if the answer is "not
yet". An unacknowledged report from a non-technical user is a user lost.

**Order of attention:**

1. **Private advisories** — above everything. Follow `SECURITY.md` §7, then add
   an entry to the incident log in §5 once fixed.
2. **`capture-health` / selector drift** — someone's prompts are silently not
   being saved right now. Usually a small fix in
   `src/content/<platform>/index.ts`. Confirm on the live site first; these
   reports are often correct about the symptom and wrong about the cause.
3. **Data loss** — anything about prompts disappearing, failing to save, or an
   export that won't restore.
4. Everything else.

**On each new issue:** reproduce or ask for the one missing detail (not five);
replace `needs triage` with a real label; close duplicates with a link and a
thank-you.

**Answering a non-technical reporter** is part of the product. Match the voice
table in `DESIGN.md` — no jargon, no "works as designed", no asking them to open
devtools. If you need something technical, explain where to click. Never ask
anyone to paste prompt text.

**Closing something out of scope:** name the reason and point at `ROADMAP.md`
or the v1 non-goals list. "Not now, and here's why" is a fine answer; silence
isn't.

---

## 4. Reviewing a pull request

The PR template's checklist is the floor. Beyond it, in order:

1. **Does it break one of the five rules in `CONTRIBUTING.md`?** Network calls,
   capture scope, host-page safety, plain language, testability. Nothing else
   matters if one of these is broken.
2. **Capture paths get a second read** against `SECURITY.md` §3 — content
   scripts, `sensitive.ts`, `pii.ts`, `blocklist.ts`, the `PROMPT_CAPTURED`
   handler. Check the login page behaviour yourself; don't take it on trust.
3. **Does a test cover the negative case** — what must survive a filter, not
   just what it catches?
4. **Read the user-facing strings as a stranger would.** Copy is reviewed as
   carefully as logic here.
5. **Scope** — one logical change. Ask for a split rather than merging two
   things at once.

Squash-merge with a Conventional Commit subject; the body should survive being
read in six months. Anything with a non-obvious rationale gets a dated entry in
`MEMORY/LOG.md` in the same PR.

---

## 5. What good looks like

- Every new issue gets a human response before it gets a fix.
- No report from a non-technical user ever gets an answer they can't act on.
- No public issue ever contains someone's real prompt text. If one arrives,
  edit it out, then explain why in a reply — gently, since they were trying to
  help.
- Selector-drift reports are closed in days, not weeks. They're the ones where
  the product is actively failing.
