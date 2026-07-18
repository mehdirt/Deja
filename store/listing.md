# Chrome Web Store listing — Deja

Copy-paste source for the listing fields. Keep this in sync with the actual
shipped feature set; reviewers compare the listing against behavior.

---

## Basics

- **Name:** Deja
- **Summary (max 132 chars):**
  `Your prompts are work. Deja saves every prompt you send to ChatGPT, Claude, Gemini, DeepSeek & Grok locally, and resurfaces them.`
  _(131 chars — verify after any edit.)_
- **Category:** Productivity
- **Language:** English

---

## Detailed description

> Your prompts are work — and most of them vanish into a scrolled-away chat the
> moment you hit Enter. Deja keeps them.
>
> Deja is a local-first prompt library. It quietly saves every prompt you send to
> ChatGPT, Claude, Gemini, DeepSeek, and Grok, makes them instantly searchable,
> and resurfaces the right one while you're typing the next.
>
> ▸ AUTOMATIC CAPTURE
> No copy-paste, no buttons. Every prompt you send is saved the moment you submit
> it — across all five tools. Multi-line prompts and code blocks keep their
> formatting. Exact and near-duplicate submits collapse into one entry.
>
> ▸ "YOU'VE BEEN HERE BEFORE"
> As you type, Deja floats a gentle reminder when you've asked something similar
> before, shows why it matched, and lets you step through past versions. Click to
> copy it to your clipboard — it never types into the box unless you opt in.
>
> ▸ A LIBRARY THAT ORGANIZES ITSELF
> Fuzzy search, tags, pins, and a favorites view. Sort by newest, most useful,
> most-used, or longest-unseen. Bulk-select and clean up in seconds. Short
> throwaway prompts ("yes", "continue") are filtered out of the way —
> recoverable, never lost.
>
> ▸ YOURS TO CONTROL
> Pause capture with one click, switch off any site, or auto-pause in incognito.
> Detected personal info (emails, phone numbers, cards, keys) is redacted to
> labels like [email] before saving — locally, on by default, tunable.
>
> ▸ YOURS TO KEEP
> Export and import your library as JSON, export as Markdown, blocklist sites or
> patterns you never want captured, and wipe everything in one click.
>
> ▸ PRIVATE BY DESIGN
> Deja makes no network calls. No telemetry, no analytics, no accounts, no cloud.
> Everything lives locally in your browser (IndexedDB). It saves only the prompt
> text you type — never the AI's replies — and never reads password, one-time-code,
> or payment fields.
>
> Open the popup any time with ⌘⇧K (Ctrl+Shift+K).

---

## Permission justifications

The store requires a short justification per permission. Deja requests the
**minimum** — two small API permissions and host access only on the five
supported AI sites.

- **`storage`** — Save your prompt library and settings locally in the browser.
  No remote storage is used.
- **`alarms`** — Clear the "capture paused" timer when it elapses, so the
  toolbar badge stops showing paused. Local only; no network use.
- **Host access** (`chatgpt.com`, `chat.openai.com`, `claude.ai`,
  `gemini.google.com`, `chat.deepseek.com`, `grok.com`) — Read the prompt you
  type into these sites' composer so it can be saved to your local library, and
  show the in-page "you've been here before" reminder. Deja runs only on these
  sites and reads only the prompt composer.
- **Remote code:** None. All code is bundled in the package.
- **`activeTab`, `tabs`, broad host permissions, etc.:** Not requested.

---

## Single purpose (required field)

> Deja captures the prompts a user sends to supported AI chat sites and stores
> them in a local, searchable library so the user can find and reuse them.

---

## Data usage / privacy disclosures (Data safety form)

Answer the certification form as follows — all must match real behavior:

- **Does this item collect or use user data?** Yes — prompt text the user types
  on supported sites, stored **locally only**.
- **Data sold to third parties?** No.
- **Data used for purposes unrelated to core functionality?** No.
- **Data used for creditworthiness / lending?** No.
- **Data transmitted off the device?** **No** — no network transmission of any
  user data. The prompt text is stored in **IndexedDB**; settings, blocklist, and
  capture-health live in `chrome.storage` — both on the user's machine.
- **Data types collected:** "Personal communications" (the prompt text). Stored
  locally in IndexedDB, never transmitted. By default, detected personal info
  (emails, phone numbers, cards, keys) is **redacted locally before storage**, so
  raw values aren't kept even on-device.

Link the privacy policy (the in-extension privacy page mirrors it; host a copy
at `site/privacy.html` via Netlify Drop and paste the URL here).

---

## Assets needed (see ./assets.md)

- Store icon 128×128 (have it: `src/assets/icon-128.png`)
- Screenshots ✅ — five `1280×800` PNGs in this folder (`screenshot-*-1280x800.png`)
- Small promo tile 440×280 (optional but recommended)
- Marquee 1400×560 (optional)
- Demo video (script in `assets.md` — still to record)

---

## Pre-submission checklist

- [ ] `npm run build`, load `dist/`, smoke-test capture + resurface on all 5 sites
- [ ] Confirm `dist/manifest.json` requests only `storage`, `alarms` + the 5 content-script hosts
- [ ] Version in `package.json` bumped (manifest version is injected from it)
- [ ] Privacy policy URL is live and reachable
- [x] Screenshots captured at the required resolution (`store/screenshot-*-1280x800.png`)
- [ ] Summary ≤ 132 chars; description proofread
- [ ] Zip `dist/` (not the repo root) for upload — `deja-0.4.1.zip` when current
