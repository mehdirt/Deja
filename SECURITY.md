# Deja — Security & Privacy Framework

Deja reads what you type on AI sites. That is an inherently sensitive
capability, and the trust it requires is the whole product. This document is the
standing framework for keeping that trust: what we promise, what we defend
against, the rules capture must obey, and the checklist every release runs
against. It is not aspirational — it describes the protections in the code today
and the gates that keep them there.

---

## 1. Promises

1. **We never knowingly store a secret.** Passwords, OTPs, API keys, and payment
   fields are out of scope for capture by default — not as an opt-in, but as a
   baseline that ships on and cannot be turned off.
2. **Nothing leaves your machine.** No network calls, no telemetry, no accounts.
   All data lives in local IndexedDB; the only egress is *you* exporting a file.
3. **Capture is scoped to the prompt box.** We capture the AI prompt composer,
   not "any text field on the page."
4. **The host page is never broken.** A bug in Deja must fail silently and
   never disturb ChatGPT/Claude/Gemini/DeepSeek/Grok.
5. **You can always get out.** Export to JSON/Markdown from day one; true erase
   (not just hide) for anything captured.

---

## 2. Threat model

What we actively defend against:

| Threat | Defense |
| --- | --- |
| Capturing credentials on a login page on a matched domain (e.g. `chat.deepseek.com/sign_in`) | Capture-eligibility gate (§3): inputs are never capturable; credential/OTP/payment fields are refused |
| Capturing unrelated text fields (site search, comment boxes) | Composer scoping (§3.3) + input exclusion |
| A captured secret lingering after "delete" | Soft-delete is a tombstone; **purge** (Settings → *purge deleted prompts*) hard-erases (§5) |
| Personal info (emails, cards, keys) sitting in the library or a shared export | Default-on PII redaction before storage (§3.7 / `src/lib/pii.ts`) |
| A broken selector silently capturing the wrong thing | Capture-health self-check (`src/lib/health.ts`) surfaces breakage |
| Prompt text leaking off-device | No network code anywhere; reviewed every release (§6 checklist) |
| Host-page console noise / info leak | Debug logging ships **off** (`DEBUG = false`) |

Out of scope (documented non-goals): defending against a malicious *host site*
that actively tries to feed us a secret through the composer itself; and
content-based detection of **names / free-form addresses** (needs on-device NER —
deferred). We *do* redact high-precision PII shapes in prompt text before
storage (§3.7), gate on the *field* for credentials (§3.1–3.2), and offer a
user regex blocklist for the rare remaining case.

---

## 3. The capture-eligibility framework

Every capture must pass **all** of these, in order. This is the rule set that the
password incident violated, and the regression tests in
`src/lib/sensitive.test.ts` lock it in.

### 3.1 Element type — inputs are never capturable
The prompt composer on every supported site is a `<textarea>` or a
`contenteditable` element. It is **never** a plain `<input>`. So we only ever
capture from textarea/contenteditable. Excluding `<input>` removes password,
email, search, tel, number, and url fields in a single structural move.
→ `isCapturableField` in `src/lib/sensitive.ts`.

### 3.2 Sensitive-field refusal (defense in depth)
Even for textarea/contenteditable, refuse if the field — or the `<form>` it lives
in — looks like a credential/OTP/payment context: `type="password"`, a
sensitive `autocomplete` token (`current-password`, `new-password`,
`one-time-code`, `cc-number`, …), a name/id/label/placeholder matching
secret-ish words, or simply *being inside a form that contains a password
input*. Over-matching here is the safe direction: the worst case is we decline a
field, and the composer never carries these tokens.
→ `isSensitiveField` in `src/lib/sensitive.ts`.

### 3.3 Composer scoping
Only capture an editable that belongs to the site's known composer
(`getInput()`/its subtree). If the composer can't be located — selector drift, or
we're on a non-chat page like a login screen — we fall back to §3.1/§3.2 alone,
which already capture nothing on a login form. As an extra guard, if the
composer can't be found AND the URL path looks like auth
(`/login`, `/sign_in`, `/oauth`, …), we capture nothing at all.
→ `withinComposer` + `looksLikeAuthPath` in `src/lib/sensitive.ts`, applied in `src/content/shared/capture.ts`.

### 3.5 Same gate for the resurface reader
The "you've been here before" feature reads the in-progress prompt as you type
and sends it to the background worker for a local similarity check. It is a
*second reader* of the composer, so it applies the **same** §3.1/§3.2 gate
(`isCapturableField`) before reading or transmitting anything, and never reads
an `<input>` value. A credential field can't leak through resurface any more
than through capture.
→ `src/content/shared/resurface.ts`.

### 3.6 URL minimization
Captured URLs are reduced to `origin + pathname` before storage. Query strings
and fragments are dropped because OAuth/magic-link/SSO callbacks carry tokens
there (`?token=`, `#access_token=`, `?code=`), and stored URLs travel inside the
JSON export a user may share.
→ `safeCaptureUrl` in `src/lib/sensitive.ts`.

### 3.4 User blocklist (opt-in, on top)
A user can additionally block whole domains or add regexes that drop
secret-shaped prompt text. This is *extra* protection layered on the default-on
guarantees above, never a replacement for them.
→ `src/lib/blocklist.ts`, configured in Settings.

### 3.7 PII redaction (default on, before storage)
Independently of the field gate, detected personal info *in* the prompt text —
emails, phones, Luhn-checked cards, SSN, IBAN, IPs, and known API-key/token
shapes — is replaced with labels (`[email]`, `[card]`, `[secret]`, …) **before**
the row is written. On by default; per-category toggles in settings. Names and
street addresses are not covered (NER deferred). The same redaction runs on the
resurface query so matches stay consistent.
→ `src/lib/pii.ts`, applied first in the background `PROMPT_CAPTURED` handler.

---

## 4. Data lifecycle

- **Capture** → PII redaction (if enabled) → selective-capture classify →
  near-dup collapse → background service worker is the only writer → IndexedDB
  (Dexie).
- **Storage** → local only. We store prompt text (already redacted), platform,
  URL, timestamps, usage count, optional tags/pin. No responses, no credentials,
  no raw emails/cards/keys when redaction is on (the default).
- **Delete** → soft-delete (tombstone) by default so undo works.
- **Purge** → Settings → *purge deleted prompts* hard-erases all tombstoned rows;
  *clear all data* wipes everything. Both are explicit and user-initiated.
- **Export/Import** → JSON/Markdown, round-trippable; tombstones are preserved on
  import so a deleted prompt can't be resurrected.

---

## 5. Incident log & remediation

**2026-06-24 — password captured on DeepSeek login.**
Root cause: `isEditable()` accepted every `HTMLInputElement`, including
`<input type="password">`. On a matched domain, pressing Enter on the login form
read the password field's value and stored it.
Fix: the §3 framework — input exclusion + sensitive-field refusal + composer
scoping — plus regression tests and `DEBUG` defaulted off. A follow-up security
audit closed three related gaps the original fix missed: the resurface reader
now applies the same gate (§3.5), captured URLs are minimized (§3.6), the
sensitive-field check covers form-less SPA login widgets and modal dialogs, and
an auth-path guard backs up composer scoping (§3.3).
Remediation for anyone affected: (1) open the library and delete the captured
secret; (2) Settings → *purge deleted prompts* to erase it from disk; (3) rotate
the affected credential as a precaution (it was stored in plaintext locally even
though it never left the machine).

---

## 6. Pre-release security checklist

Run before every build that ships:

- [ ] `npm run test` green, including `src/lib/sensitive.test.ts`.
- [ ] No new network calls: `grep -rnE "fetch\(|XMLHttpRequest|navigator.sendBeacon|new WebSocket" src/` returns nothing in capture/storage paths.
- [ ] `DEBUG` is `false` in all content-script modules.
- [ ] Capture verified by hand on each supported site **and** confirmed to
      capture nothing on each site's login/auth page.
- [ ] Manifest `matches`/`permissions` reviewed — no broader host access than needed.
- [ ] New capturable surfaces (a new platform, a new field path) re-checked
      against §3 — including the resurface reader, not just capture.
- [ ] `npm audit` reviewed for known-vulnerable dependencies.

---

## 7. Reporting

Found a way Deja captures or leaks something it shouldn't? That's a
security bug, not a feature request — treat it as the highest priority. Until a
formal channel exists, file it as a private issue with reproduction steps and the
site/field involved.
