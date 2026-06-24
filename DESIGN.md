# PromptShelf — Design Identity

The fixed visual identity for PromptShelf. **Use this everywhere; don't invent new tokens per surface.** All values live as CSS variables in `src/styles/globals.css` and are wired into Tailwind in `tailwind.config.js` — change them there, not inline.

## Direction: notebook meets terminal

Warm paper everywhere (the notebook); monospace for anything that is itself an artifact — prompt bodies, timestamps, counts, the wordmark, keyboard hints (the terminal). Calm, lowercase, personal. The library should feel like index cards on a shelf, not a SaaS dashboard.

## Color tokens

Reference via Tailwind classes (`bg-bg`, `text-ink`, `text-ink-soft`, `bg-surface`, `border-line`, `text-accent`, `bg-accent`, etc.). Never hard-code hex in components.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--ps-bg` | `#faf8f3` | `#16151a` | page background (warm paper) |
| `--ps-surface` | `#ffffff` | `#201f27` | raised cards |
| `--ps-sunk` | `#f1ede4` | `#1b1a21` | wells, hover, skeletons |
| `--ps-text` | `#1c1b19` | `#f3f1ea` | primary ink |
| `--ps-text-soft` | `#6b6862` | `#a8a49b` | secondary |
| `--ps-text-faint` | `#9a968d` | `#6e6a62` | meta / tertiary |
| `--ps-accent` | `#5b54f0` | `#8983f5` | primary action, focus, brand |
| `--ps-accent-soft` | `#ecebfe` | `#272534` | accent fills (chips) |
| `--ps-line` | `#e7e2d8` | `#2e2c36` | hairline borders (always distinct from surface) |
| `--ps-danger` | `#c0392b` | `#e06c5d` | destructive only |

Dark mode is driven by `prefers-color-scheme` — one set of variables, no class toggling.

Per-platform accent dots (chips only, subtle): ChatGPT `#10a37f`, Claude `#d97757`, Gemini `#4285f4` — see `PLATFORM_COLOR` in `src/lib/types.ts`.

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

`.ps-card` · `.ps-chip` · `.ps-input` · `.ps-btn` / `.ps-btn-primary` / `.ps-btn-ghost` · `.ps-pill` / `.ps-pill-active`

## Logo

`src/ui/Logo.tsx` — `<Logo />` (mark + wordmark) or `<LogoMark />` (mark only). The mark is a shelf holding three "books" (saved prompts) with a terminal cursor, accent background. Wordmark is lowercase mono: `prompt` (ink) + `shelf` (accent). Toolbar icons (`src/assets/icon-*.png`) use the same motif.

## Voice

Lowercase, calm, no hype. "saved to your shelf", "your shelf is empty — that's fine", "nothing to set up". Never grade or nag the user.
