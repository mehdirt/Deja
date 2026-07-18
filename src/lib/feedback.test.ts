import { describe, expect, it } from 'vitest'
import { FEEDBACK_URL, REPO_URL, feedbackHref } from './feedback'

describe('feedbackHref', () => {
  it('opens a prefilled GitHub issue by default', () => {
    const href = feedbackHref('problem', 'capture broken on ChatGPT', '0.4.1')
    expect(FEEDBACK_URL).toBe('')
    expect(href.startsWith(`${REPO_URL}/issues/new?`)).toBe(true)
    const q = new URL(href).searchParams
    expect(q.get('title')).toBe('Deja — a problem')
    expect(q.get('body')).toContain('What happened:')
    expect(q.get('body')).toContain('Context: capture broken on ChatGPT')
    expect(q.get('body')).toContain('Deja 0.4.1')
  })

  it('uses idea framing for idea reports', () => {
    const href = feedbackHref('idea')
    const q = new URL(href).searchParams
    expect(q.get('title')).toBe('Deja — an idea')
    expect(q.get('body')).toContain('My idea:')
  })
})
