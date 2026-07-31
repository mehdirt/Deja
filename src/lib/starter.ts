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

export interface StarterPrompt {
  /** Short, human category — grouping for the eye, not a taxonomy. */
  kind: string
  text: string
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    kind: 'Email',
    text: 'Write a short, friendly email to {who} about {situation}. Keep it under 120 words, warm but direct, and end with a clear next step.',
  },
  {
    kind: 'Email',
    text: 'Rewrite the message below so it sounds calm and professional, without losing what it actually says:\n\n{paste your message here}',
  },
  {
    kind: 'Learning',
    text: 'Explain {topic} to me as if I know nothing about it. Use a real-world comparison, then tell me the one thing most people get wrong about it.',
  },
  {
    kind: 'Learning',
    text: 'I want to learn {skill} in {how much time}. Give me a realistic week-by-week plan, and say what to skip.',
  },
  {
    kind: 'Deciding',
    text: "Help me think through {decision}. Give me the strongest case for each option, then tell me what you'd want to know before choosing.",
  },
  {
    kind: 'Writing',
    text: 'Write three versions of a {kind of post} about {topic}: one plain, one playful, one thoughtful. No hashtags, no emoji.',
  },
  {
    kind: 'Writing',
    text: 'Summarise the text below in five bullet points a busy person could read in twenty seconds:\n\n{paste the text here}',
  },
  {
    kind: 'Everyday',
    text: 'Plan {number} days of simple dinners for {how many people}, using ordinary supermarket ingredients. Give me one shopping list at the end.',
  },
  {
    kind: 'Everyday',
    text: "I need to tell {who} that {awkward thing}. Give me three ways to say it kindly, and tell me which one you'd pick.",
  },
  {
    kind: 'Work',
    text: 'Turn these rough notes into a clear update for {audience}. Lead with what changed, keep it to one short paragraph plus bullets:\n\n{paste your notes here}',
  },
]
