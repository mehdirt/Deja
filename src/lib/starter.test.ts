import { describe, expect, it } from 'vitest'
import { STARTER_PROMPTS, startersFor } from './starter'
import { INTENTS } from './prefs'

describe('startersFor', () => {
  it('shows everything when nothing was picked — skipping is a real choice', () => {
    expect(startersFor([])).toEqual(STARTER_PROMPTS)
  })

  it('narrows to the picked topics', () => {
    const rows = startersFor(['learning'])
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.intent === 'learning' || STARTER_PROMPTS.includes(r))).toBe(true)
  })

  it('never leaves fewer than three examples, whatever is picked', () => {
    for (const intent of INTENTS) {
      expect(startersFor([intent]).length).toBeGreaterThanOrEqual(3)
    }
  })

  it('gives every welcome chip something of its own to show', () => {
    for (const intent of INTENTS) {
      expect(STARTER_PROMPTS.some((s) => s.intent === intent)).toBe(true)
    }
  })

  it('gives every starter exactly one known intent', () => {
    for (const s of STARTER_PROMPTS) {
      expect(INTENTS).toContain(s.intent)
    }
  })
})
