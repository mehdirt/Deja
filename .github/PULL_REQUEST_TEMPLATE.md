<!--
Thanks for the pull request. The checklist is short on purpose — every line is
something that has actually gone wrong here before, not ceremony.
-->

## What this changes

<!-- One or two sentences. Lead with the behaviour, not the implementation. -->

## Why

<!-- What breaks without it, or what it makes possible. Link the issue if there
     is one: "Fixes #12". -->

## How you confirmed it

<!-- Which sites/browsers you tried by hand, or which test now covers it. For a
     selector fix, say which site and that you sent a real prompt through it. -->

---

- [ ] `npm run typecheck && npm run lint && npm run test && npm run build` all pass
- [ ] Tests cover the change — including what must *survive* it, if it filters, hides, or skips anything
- [ ] No new network calls, no telemetry, nothing sent off the machine
- [ ] Captures only the prompt composer and only prompt text
- [ ] Fails silently in the page — no way for this to break the host site
- [ ] User-facing strings follow the voice table in `DESIGN.md` (plain language, sentence case)
- [ ] Docs updated if this touches architecture, storage, config, capture, or a visible string — or a dated entry in `MEMORY/LOG.md`
- [ ] No real prompt text or personal information in the diff, tests, or screenshots

**If this touches a capture path** (content scripts, `sensitive.ts`, `pii.ts`,
`blocklist.ts`, the `PROMPT_CAPTURED` handler):

- [ ] Re-read `SECURITY.md` §3 and confirmed each rule still holds
- [ ] Verified by hand that the site's **login page** still captures nothing

**If this adds a dependency or a manifest permission**, say why it's worth it —
the bundle ships to every user, and each dependency is a supply-chain surface.

## Anything you're unsure about

<!-- Genuinely useful. Say where you'd like the reviewer to look hardest, or
     what you decided not to do. -->
