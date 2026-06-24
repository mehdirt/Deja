# Deja

Your personal prompt library — organized automatically, always within reach.

Deja is a Chrome extension that **passively captures** every prompt you send to ChatGPT, Claude, Gemini, DeepSeek, and Grok, then stores it locally in a searchable library. No copy-paste. No accounts. No cloud. Your prompts stay on your machine.

## Status

v0.2.0 — trustworthy capture plus the resurface moment. Capture is credential-safe and self-monitoring; the library is fully featured; and the "you've been here before" in-context tooltip is live.

## Develop

```bash
npm install
npm run dev
```

Then in Chrome: `chrome://extensions` → Developer mode → "Load unpacked" → select `dist/`.

Send a prompt on ChatGPT, Claude, Gemini, DeepSeek, or Grok. Click the Deja toolbar icon (or press ⌘⇧K) to see it.

## What's built

- Passive prompt capture from ChatGPT, Claude, Gemini, DeepSeek, and Grok
- Local IndexedDB storage (Dexie) — nothing ever leaves your machine
- **Credential-safe capture**: never reads password/OTP/payment fields, with per-site capture-health so silent selector breakage is visible
- **"You've been here before"**: as you type, a tooltip surfaces similar prompts you've saved (IDF-weighted trigram similarity), shows *why* they matched, and lets you step through candidates — click to copy (it never auto-fills)
- Fuzzy search (MiniSearch) in the popup and the full library page
- Platform filter, tags with multi-tag filtering, pin, favorites view, bulk select/delete, and sorts (newest / most useful / most used / longest unseen)
- Copy-to-clipboard with usage tracking; soft-delete with undo
- JSON export/import (round-trips) and Markdown export
- Settings: clear all data, blocklist domains and regex patterns; an in-extension privacy page

## What's deferred

LLM-based scoring, auto-categorization, streaks, cloud sync, sharing, and semantic (embeddings-based) paraphrase matching. See `ROADMAP.md` for the phased plan and `PromptShelf_Concept.pdf` for the original vision.
