# PromptShelf — Concept

*Your personal prompt library — organized automatically, always within reach.*

A browser extension that quietly saves every prompt you send to ChatGPT, Claude, and Gemini into a local, searchable shelf. No copy-paste. No accounts. No cloud.

This document supersedes `PromptShelf_Concept.pdf` (June 2026). The PDF's ambition stands; this is the version we are actually building, in the order we are building it.

---

## The problem

Every frequent AI user has experienced the **prompt graveyard**: you craft a perfect prompt, get a great result, and then it's gone — buried in a chat history you'll never scroll through again. The best prompts, the ones that took trial and error to perfect, simply disappear. There is no native way to save, organize, or retrieve them across sessions.

## The product, in one sentence

PromptShelf is a Chrome extension that silently saves every prompt you send to a major AI tool into a local, searchable library, and (eventually) nudges you when you're about to re-ask something you already asked.

## Principles

These are the trade-offs we keep coming back to. When in doubt, follow the principle.

1. **Passive over active.** The user never has to think about saving. If they have to click "Save", we failed.
2. **Local-first.** All data lives on the user's machine by default. Cloud is an opt-in upgrade, never a default.
3. **Good UX over more features.** Three features that feel finished beat ten features that feel half-done.
4. **Never block the host page.** A bug in PromptShelf must never break ChatGPT, Claude, or Gemini.
5. **No judgment.** Don't grade users' prompts. Help them find old ones; that's the job.
6. **No friction at setup.** No login, no API key, no payment to use the core product.

## What v1 is (and isn't)

| In v1 | Deferred |
| --- | --- |
| Passive capture on ChatGPT, Claude, Gemini | LLM-based prompt scoring |
| Local IndexedDB storage | LLM-based auto-categorization |
| Fuzzy search (popup + library page) | "Prompt of the Day" / streaks |
| Platform filter | Activity heatmap |
| Copy-to-clipboard + usage tracking | Cloud sync / accounts |
| Soft-delete with undo | Team / shared vaults |
| JSON export | Prompt chaining |
| Manual tags (light) | Mobile companion |

The deferred list is not the discard list. Several of these (heatmap, "been here before") are great features — they just don't ship until v1 is solid and we have real users telling us which to build first.

## The killer feature

**"You've Been Here Before."** As you type a new prompt, a gentle inline tooltip appears: *"Looks like you've asked something like this before →"* with one click to surface the old one. This single feature is what makes PromptShelf irreplaceable. Everything else is just plumbing for this moment.

The plumbing ships in v1. The moment itself ships in v1.5.

## How it works

```
1. User submits a prompt on ChatGPT/Claude/Gemini, as normal.
2. A platform-specific content script catches the Enter keypress or send-button click.
3. The prompt text is sent to the background service worker.
4. The worker writes it to IndexedDB (via Dexie) with timestamp, platform, and URL.
5. The user opens the popup (⌘⇧K) or library page to find, copy, or export.
```

That's the whole flow for v1. No network. No external service. No latency added to the user's prompt submission.

## UI direction

**Notebook meets terminal.** Clean, slightly warm, monospaced where it matters, sans-serif where it doesn't. Two colors: ink and indigo accent. Dark mode follows OS. The library should feel like a personal cookbook — yours, browsable, alive.

- **Popup** (toolbar icon): search box + 5 most recent prompts + link to full library
- **Library** (options page): full-page view, fuzzy search, platform filter, copy, delete, export
- **Inline tooltip** (v1.5): host-page injection on each supported AI site, shows "been here before" matches

## Where intelligence comes from

We deliberately ship v1 with **zero LLM calls**:

- Fuzzy search → MiniSearch (local, ~50KB, instant)
- "Been here before" similarity → trigram Jaccard (local, zero dependencies)
- Auto-categorization → not in v1; v2 may use an on-device classifier or user tags
- Scoring → cut entirely; users don't want their notes graded

If LLM features ever land, they will be **bring-your-own-key, optional, gated behind a settings toggle**, and **never block the capture flow**.

## Privacy stance

- All prompts are stored in IndexedDB on the user's machine.
- We do not call out to any server.
- We do not collect telemetry.
- Export to JSON is available from day one so users never feel locked in.
- The list of sites the extension reads from is in the manifest; users can audit it.

This stance is a feature, not a side effect. It is the reason a privacy-conscious user installs PromptShelf instead of one of the dozen worse alternatives.
