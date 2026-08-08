# Deja — Design Identity

The fixed visual identity for Deja. **Use this everywhere; don't invent new tokens per surface.** All values live as CSS variables in `src/styles/globals.css` and are wired into Tailwind in `tailwind.config.js` — change them there, not inline.

## Who this is for

Deja is for **people who use AI chat every day and don't write code**: someone drafting an awkward email, planning a trip, learning something, getting help with a letter to their landlord. They are not intimidated by computers, but nothing in Deja should require them to know what a regular expression, a JSON file, or IndexedDB is.

This is the single most useful test when you're unsure about a label, a control, or a screen: **would this make sense to someone who has never opened a terminal?** If it wouldn't, change it — or move it behind *More options*.

## Direction: a warm notebook

Warm paper, ink, and a single indigo accent. Calm and personal — the library should feel like index cards on a shelf, not a SaaS dashboard and not a developer console.

Deja used to be *"notebook meets terminal"*, and the terminal half did too much of the talking: monospace prompt bodies, lowercase controls, keyboard-first everything. That reads as "tool for engineers" to everyone else, so the terminal styling is now confined to the few things that genuinely are code or keys (see Typography). The notebook stayed; the terminal became a detail.

## Color tokens

Reference via Tailwind classes (`bg-bg`, `text-ink`, `text-ink-soft`, `bg-surface`, `border-line`, `text-accent`, `bg-accent`, etc.). Never hard-code hex in components.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--dj-bg` | `#faf8f3` | `#16151a` | page background (warm paper) |
| `--dj-surface` | `#ffffff` | `#201f27` | raised cards |
| `--dj-sunk` | `#ebe6db` | `#1b1a21` | wells, hover, skeletons |
| `--dj-text` | `#1c1b19` | `#f3f1ea` | primary ink |
| `--dj-text-soft` | `#534f49` | `#a8a49b` | secondary |
| `--dj-text-faint` | `#655f56` | `#8f8a80` | meta / tertiary |
| `--dj-accent` | `#5b54f0` | `#8983f5` | primary action, focus, brand |
| `--dj-accent-soft` | `#ecebfe` | `#272534` | accent fills (chips) |
| `--dj-line` | `#d0caba` | `#2e2c36` | hairline borders (always distinct from surface) |
| `--dj-danger` | `#c0392b` | `#e06c5d` | destructive only |

Dark mode is driven by `prefers-color-scheme` — one set of variables, no class toggling.

Per-platform accent dots (chips only, subtle): ChatGPT `#ffffff` (white — its current brand mark; rendered with a hairline ring so it shows on the light surface), Claude `#d97757`, Gemini `#4285f4`, DeepSeek `#4d6bfe`, Grok `#71767b` — see `PLATFORM_COLOR` in `src/lib/types.ts`.

## Typography

Fonts are **bundled, not fetched** — the `.woff2` files live in `src/assets/fonts/` and are declared with `@font-face` in `globals.css`. No network request is ever made, which keeps the local-first promise intact while making the typography identical on every machine.

> This matters more than it sounds. Deja previously *named* Inter and JetBrains Mono without shipping either, so anyone who didn't already have them installed silently got their OS default. The design only ever looked right on developers' machines. **If you add a family, add the file.**

- **Sans** (`font-sans`, Figtree Variable → system-ui): everything a person reads or clicks. Prompt bodies, headings, buttons, labels, search boxes, timestamps.
- **Brand** (`font-brand`, Literata → Georgia): the lowercase `deja` wordmark only. Soft reading serif — ink on paper, remembered words, a little déjà vu. Keeps the name warm and personal instead of dressing it as code.
- **Mono** (`font-mono`, JetBrains Mono Variable → ui-monospace): only for things that are literally code — `[email]` placeholders, hostnames, and pattern rules. **Don't reach for it otherwise.** Monospace reads as "code" to a non-technical person, and most of what Deja stores is ordinary prose.

Two primitives carry most of the type:

- `.dj-prompt` — the prompt text itself. Sans, 15px, generous leading; this is something a person reads.
- `.dj-wordmark` — the lowercase `deja` brand name. Literata semibold; `de` in ink, `.ja` in accent.
- `.dj-meta` — timestamps, counts, quiet status lines. Small, faint, and `tabular-nums` so numbers don't jitter as they change.

Scale: `text-xs` 12 · `text-sm` 13–14 · `text-base` 15 · `text-lg` 18 · `text-2xl` 28.

## Shape & depth

- Radius: `rounded-card` (**16px**, shared with the landing page) for cards/panels, `rounded-btn` (**11px**) for buttons/inputs, `rounded-full` for pills.
- Borders: `1px` `border-line`, always visible against `surface` (including dark mode). Soft accent mix on card hover (same as site flow-steps).
- Shadow: `shadow-card` (resting), `shadow-pop` (overlays), `shadow-cta` (primary actions — indigo glow, like the site CTA).
- Atmosphere: a faint indigo radial wash (`--dj-glow`) behind options/popup chrome — same gesture as `site/index.html`.
- Motion: view enter (`dj-enter`), capped list stagger (`dj-stagger` / `dj-stagger-auto`), disclosure open, button press scale, card hover lift (fine pointer only), copy check pop. Timing uses `cubic-bezier(0.16, 1, 0.3, 1)`. Respect `prefers-reduced-motion`.

Keep the extension and the marketing site on one visual system: same tokens, radii, type faces, and card language. Extension density stays higher (Operate mode); the site can breathe more (Persuade).

## Component primitives

Defined in `globals.css` `@layer components` — compose these instead of re-styling:

`.dj-card` · `.dj-chip` · `.dj-input` · `.dj-btn` / `.dj-btn-primary` / `.dj-btn-ghost` · `.dj-pill` / `.dj-pill-active` · `.dj-tag` / `.dj-tag-active` / `.dj-tag-label` · `.dj-prompt` · `.dj-wordmark` · `.dj-meta`

The in-page overlays (the save toast and the resurface tooltip) live in a Shadow DOM on the host site and can't use any of this — they re-declare the palette inline. They also deliberately use the **system UI font**, not Figtree: an overlay sitting on chatgpt.com should read as part of that page, not as a foreign widget.

## Logo

`src/ui/Logo.tsx` — `<Logo />` (mark + wordmark) or `<LogoMark />` (mark only). The mark is a card and its echo — the "I've seen this before" double image of déjà vu — with a cursor tick on the front card, white on an accent tile. Wordmark is lowercase Literata: `de` (ink) + `ja` (accent). Toolbar icons (`src/assets/icon-*.png`) are generated from `src/assets/icon.svg`, which mirrors the same mark.

## Voice

Warm, cozy, and plain — like a kind friend showing you around, not a product pitch. Everyday users should feel comfortable the whole time: never rushed, never graded, never spoken to like engineers.

**Guiding over configuring.** Lead with what will happen next, in ordinary words, one step at a time. Prefer reassurance over precision on the first screen ("You're all set — make yourself at home") and put the technical detail under *More options*. Empty states should feel welcoming, not blank — tell someone what to do next, gently.

**Sentence case everywhere** — headings, buttons, labels, pills, empty states, status messages. ("Copy", "Download a backup", "Nothing saved yet — that's normal.") The old all-lowercase convention for controls is gone: it was part of the terminal costume, and it made the interface feel like a config file.

**Emojis, where they earn their place.** A warm greeting (🤗) on first install is the clearest yes. A single emoji can also soften an empty state, a tip heading, a starter category, or a feedback prompt — moments that feel human. Don't decorate buttons, settings pills, status chrome, or every sentence; if it starts to feel like a sticker sheet, take them back out.

**Say the plain thing.** The vocabulary is the largest single signal of who a product is for, so prefer the everyday word:

| Don't say | Say |
| --- | --- |
| capture | save |
| blocklist / blocked patterns | never save from… |
| export JSON / import | download a backup / restore from a backup |
| PII redaction | hide personal info |
| filter strength | what Deja saves |
| minor prompt | short one-off |
| capture health | whether Deja is working on a site |
| soft-delete | delete (short Undo, then gone for real) |
| library cap / LRU / eviction | keep at most… |

Technical words are allowed where they're unavoidable and correct — a regular expression really is a regular expression — but they belong under **More options**, with a plain-language note next to them.

Keep proper nouns and acronyms correct everywhere (ChatGPT, Claude, Markdown, Deja); the brand wordmark stays lowercase (`deja`). Never grade the user's prompts, never nag, and never imply they should be using Deja more.
