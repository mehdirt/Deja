import { describe, expect, it } from 'vitest'
import { findTrigger } from './picker'

// The trigger rules are the whole reason `//` is safe to use on someone else's
// page: it must open when a person reaches for it and stay shut every other
// time, especially inside a URL.

describe('findTrigger', () => {
  it('opens on // at the start of the box', () => {
    expect(findTrigger('//')).toEqual({ at: 0, query: '' })
    expect(findTrigger('//trip')).toEqual({ at: 0, query: 'trip' })
  })

  it('opens mid-sentence, after a space', () => {
    expect(findTrigger('ask them about //email')).toEqual({ at: 15, query: 'email' })
  })

  it('never opens inside a URL', () => {
    expect(findTrigger('https://')).toBeNull()
    expect(findTrigger('see https://example.com')).toBeNull()
    expect(findTrigger('file://tmp')).toBeNull()
  })

  it('never opens when the slashes are glued to a word', () => {
    expect(findTrigger('and/or//maybe')).toBeNull()
    expect(findTrigger('a//b')).toBeNull()
  })

  it('lets go once the query stops looking like a search', () => {
    // A newline means they moved on.
    expect(findTrigger('//email\nnext line')).toBeNull()
    // A double space means they are writing prose, not filtering.
    expect(findTrigger('//write a  letter')).toBeNull()
    // Long enough that this is a sentence, not a query.
    expect(findTrigger('//' + 'x'.repeat(61))).toBeNull()
  })

  it('tracks the most recent trigger, not the first', () => {
    const hit = findTrigger('//one thing then //two')
    expect(hit).toEqual({ at: 17, query: 'two' })
  })

  it('returns null when there is no trigger at all', () => {
    expect(findTrigger('')).toBeNull()
    expect(findTrigger('just typing normally')).toBeNull()
  })
})
