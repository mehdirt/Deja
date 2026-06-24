# Deja

Your personal prompt library — organized automatically, always within reach.

Deja is a Chrome extension that **passively captures** every prompt you send to ChatGPT, Claude, and Gemini, then stores it locally in a searchable library. No copy-paste. No accounts. No cloud. Your prompts stay on your machine.

## Status

v0.1.0 — scaffold. Working capture + library + fuzzy search + JSON export.

## Develop

```bash
npm install
npm run dev
```

Then in Chrome: `chrome://extensions` → Developer mode → "Load unpacked" → select `dist/`.

Send a prompt on ChatGPT, Claude, or Gemini. Click the Deja toolbar icon to see it.

## What's in v1

- Passive prompt capture from ChatGPT, Claude, Gemini
- Local IndexedDB storage (Dexie)
- Fuzzy search (MiniSearch) in popup and full library page
- Platform filtering
- Copy-to-clipboard with usage tracking
- Soft-delete
- JSON export

## What's deferred to v2

LLM-based scoring, auto-categorization, streaks, "you've been here before" inline tooltip, cloud sync, sharing. See `PromptShelf_Concept.pdf` for the full vision.
