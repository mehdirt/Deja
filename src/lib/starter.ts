import type { Intent } from './prefs'

// A small set of everyday prompts shown while someone's library is still empty.
//
// WHY THIS EXISTS, AND WHERE THE LINE IS. Deja's library fills itself, but the
// first few days are empty by definition, and an empty tool teaches nobody
// anything. These give a new user something to try in the first minute and —
// because every one of them has a blank in it — quietly demonstrate what a
// reusable prompt looks like.
//
// What this is NOT: a recommendation engine. Nothing here is generated, ranked,
// personalised, or written into the library behind someone's back. It's a fixed,
// hand-written list that disappears the moment there's a real prompt to show,
// and copying one is always an explicit click. The roadmap's ban on "prompt of
// the day" is about a machine telling you what to ask; this is a worked example
// on an empty page.
//
// Every starter carries an `intent` so the welcome chips can narrow the list to
// what someone said they use AI for. That is a filter over a fixed hand-written
// set — still not a recommendation engine, and still nothing generated.

export interface StarterPrompt {
  /** Short, human category — grouping for the eye, not a taxonomy. */
  kind: string
  /**
   * Which welcome chip this belongs to. Separate from `kind` on purpose: `kind`
   * is what the eye groups by on the page, `intent` is what filters. Every
   * starter has one, so the mapping is total and nothing depends on inference.
   */
  intent: Intent
  text: string
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    kind: '✉️ Email',
    intent: 'email',
    text: 'Write a short, friendly email to {who} about {situation}. Keep it under 120 words, warm but direct, and end with a clear next step.',
  },
  {
    kind: '✉️ Email',
    intent: 'email',
    text: 'Rewrite the message below so it sounds calm and professional, without losing what it actually says:\n\n{paste your message here}',
  },
  {
    kind: '📚 Learning',
    intent: 'learning',
    text: 'Explain {topic} to me as if I know nothing about it. Use a real-world comparison, then tell me the one thing most people get wrong about it.',
  },
  {
    kind: '📚 Learning',
    intent: 'planning',
    text: 'I want to learn {skill} in {how much time}. Give me a realistic week-by-week plan, and say what to skip.',
  },
  {
    kind: '🤔 Deciding',
    intent: 'planning',
    text: "Help me think through {decision}. Give me the strongest case for each option, then tell me what you'd want to know before choosing.",
  },
  {
    kind: '✍️ Writing',
    intent: 'email',
    text: 'Write three versions of a {kind of post} about {topic}: one plain, one playful, one thoughtful. No hashtags, no emoji.',
  },
  {
    kind: '✍️ Writing',
    intent: 'learning',
    text: 'Summarise the text below in five bullet points a busy person could read in twenty seconds:\n\n{paste the text here}',
  },
  {
    kind: '🏠 Everyday',
    intent: 'planning',
    text: 'Plan {number} days of simple dinners for {how many people}, using ordinary supermarket ingredients. Give me one shopping list at the end.',
  },
  {
    kind: '🏠 Everyday',
    intent: 'everyday',
    text: "I need to tell {who} that {awkward thing}. Give me three ways to say it kindly, and tell me which one you'd pick.",
  },
  {
    kind: '💼 Work',
    intent: 'email',
    text: 'Turn these rough notes into a clear update for {audience}. Lead with what changed, keep it to one short paragraph plus bullets:\n\n{paste your notes here}',
  },
]

/**
 * The starters to show, narrowed to what someone said they use AI for.
 *
 * Two deliberate softenings. An empty pick list shows everything — skipping the
 * welcome chips is a real choice, not a way to end up with a thinner page. And
 * a selection that would leave fewer than three examples gets topped up from
 * the rest, because the point of this list is to demonstrate what a reusable
 * prompt looks like, and one lonely card demonstrates nothing.
 */
export function startersFor(intents: readonly string[]): StarterPrompt[] {
  if (!intents.length) return STARTER_PROMPTS
  const picked = STARTER_PROMPTS.filter((s) => intents.includes(s.intent))
  if (picked.length >= MIN_STARTERS) return picked
  const filler = STARTER_PROMPTS.filter((s) => !picked.includes(s))
  return [...picked, ...filler.slice(0, MIN_STARTERS - picked.length)]
}

const MIN_STARTERS = 3
