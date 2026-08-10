import { describe, expect, it } from 'vitest'
import { pickDotState } from './presence'

// The dot says exactly one thing at a time, and which thing it says when
// several apply is a product decision, not an implementation detail.

describe('pickDotState', () => {
  it('is quiet when there is nothing to say', () => {
    expect(pickDotState({ saving: 'on', broken: false, matches: 0 })).toBe('idle')
  })

  it('lights up when something saved looks like this', () => {
    expect(pickDotState({ saving: 'on', broken: false, matches: 2 })).toBe('matches')
  })

  it('warns when the site moved and capture lost the box', () => {
    expect(pickDotState({ saving: 'on', broken: true, matches: 0 })).toBe('broken')
  })

  it('never shows the alarm colour when the user is the reason', () => {
    // "We're not saving because you paused" and "we're not saving because the
    // site changed" are different messages; showing the alarming one here
    // would be a small lie.
    expect(pickDotState({ saving: 'paused', broken: true, matches: 3 })).toBe('off')
    expect(pickDotState({ saving: 'site-off', broken: true, matches: 3 })).toBe('off')
  })

  it('prefers the problem over the suggestion count', () => {
    expect(pickDotState({ saving: 'on', broken: true, matches: 5 })).toBe('broken')
  })
})
