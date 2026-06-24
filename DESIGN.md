# Deja — Design Identity

The fixed visual identity for Deja. **Use this everywhere; don't invent new tokens per surface.** All values live as CSS variables in `src/styles/globals.css` and are wired into Tailwind in `tailwind.config.js` — change them there, not inline.

## Direction: notebook meets terminal

Warm paper everywhere (the notebook); monospace for anything that is itself an artifact — prompt bodies, timestamps, counts, the wordmark, keyboard hints (the terminal). Calm, lowercase, personal. The library should feel like index cards on a shelf, not a SaaS dashboard.

## Color tokens

Reference via Tailwind classes (`bg-bg`, `text-ink`, `text-ink-soft`, `bg-surface`, `border-line`, `text-accent`, `bg-accent`, etc.). Never hard-code hex in components.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--dj-bg` | `#faf8f3` | `#16151a` | page background (warm paper) |
| `--dj-surface` | `#ffffff` | `#201f27` | raised cards |
| `--dj-sunk` | `#f1ede4` | `#1b1a21` | wells, hover, skeletons |
| `--dj-text` | `#1c1b19` | `#f3f1ea` | primary ink |
| `--dj-text-soft` | `#6b6862` | `#a8a49b` | secondary |
| `--dj-text-faint` | `#9a968d` | `#6e6a62` | meta / tertiary |
| `--dj-accent` | `#5b54f0` | `#8983f5` | primary action, focus, brand |
| `--dj-accent-soft` | `#ecebfe` | `#272534` | accent fills (chips) |
| `--dj-line` | `#e7e2d8` | `#2e2c36` | hairline borders (always distinct from surface) |
| `--dj-danger` | `#c0392b` | `#e06c5d` | destructive only |

Dark mode is driven by `prefers-color-scheme` — one set of variables, no class toggling.

Per-platform accent dots (chips only, subtle): ChatGPT `#10a37f`, Claude `#d97757`, Gemini `#4285f4`, DeepSeek `#4d6bfe`, Grok `#71767b` — see `PLATFORM_COLOR` in `src/lib/types.ts`.

## Typography

No web fonts (offline + local-first). Locally installed faces with system fallbacks.

- **Sans** (`font-sans`, Inter → system-ui): headings, buttons, UI chrome.
- **Mono** (`font-mono`, JetBrains Mono → ui-monospace): prompt bodies, metadata, wordmark, `⌘K` hints, search inputs. This is the "terminal" signal — lean on it.

Scale: `text-xs` 12 · `text-sm` 13–14 · `text-base` 15 · `text-lg` 18 · `text-2xl` 28.

## Shape & depth

- Radius: `rounded-card` (10px) for cards, `rounded-btn` (8px) for buttons/inputs, `rounded-full` for pills.
- Borders: `1px` `border-line`, always visible against `surface` (including dark mode).
- Shadow: `shadow-card` (resting), `shadow-pop` (overlays/toast). Keep depth subtle.
- Motion: `animate-fade-in` (140ms). Respect `prefers-reduced-motion`.

## Component primitives

Defined in `globals.css` `@layer components` — compose these instead of re-styling:

`.dj-card` · `.dj-chip` · `.dj-input` · `.dj-btn` / `.dj-btn-primary` / `.dj-btn-ghost` · `.dj-pill` / `.dj-pill-active` · `.dj-tag` / `.dj-tag-active` / `.dj-tag-label`

## Logo

`src/ui/Logo.tsx` — `<Logo />` (mark + wordmark) or `<LogoMark />` (mark only). The mark is a card and its echo — the "I've seen this before" double image of déjà vu — with a terminal-cursor tick on the front card, white on an accent tile. Wordmark is lowercase mono: `de` (ink) + `ja` (accent). Toolbar icons (`src/assets/icon-*.png`) are generated from `src/assets/icon.svg`, which mirrors the same mark.

## Voice

Lowercase, calm, no hype. "saved to your library", "your library is empty — that's fine", "nothing to set up". Never grade or nag the user.
