import { describe, it, expect } from 'vitest'
import { buildIndex, searchPrompts, normalizeTerm, expandQuery } from './search'
import type { Prompt } from './types'

function prompt(id: number, text: string): Prompt {
  return {
    id,
    text,
    platform: 'chatgpt',
    url: 'https://chatgpt.com/c/abc',
    createdAt: id,
    usageCount: 0,
    lastUsedAt: 0,
  }
}

describe('normalizeTerm', () => {
  it('folds British spellings into one form', () => {
    expect(normalizeTerm('summarise')).toBe('summarize')
    expect(normalizeTerm('favourite')).toBe('favorite')
  })

  it('strips simple plurals', () => {
    expect(normalizeTerm('emails')).toBe('email')
    expect(normalizeTerm('stories')).toBe('story')
    expect(normalizeTerm('boxes')).toBe('box')
  })

  it('leaves words that merely end in s alone', () => {
    expect(normalizeTerm('address')).toBe('address')
    expect(normalizeTerm('bus')).toBe('bus')
  })

  it('does not strip verb endings, which would change the meaning', () => {
    expect(normalizeTerm('meeting')).toBe('meeting')
    expect(normalizeTerm('editing')).toBe('editing')
  })
})

describe('expandQuery', () => {
  it('offers everyday synonyms for a term', () => {
    expect(expandQuery('email').split(' ')).toContain('letter')
  })

  it('never repeats a word the user already typed', () => {
    expect(expandQuery('email letter').split(' ')).not.toContain('email')
  })

  it('is empty when nothing has a synonym', () => {
    expect(expandQuery('zxqv')).toBe('')
  })
})

describe('searchPrompts', () => {
  const prompts = [
    prompt(1, 'Write a polite email to my landlord about the broken heater'),
    prompt(2, 'Draft a letter to the council about parking'),
    prompt(3, 'Give me a recipe for lentil soup'),
  ]
  const index = buildIndex(prompts)

  it('returns nothing for an empty query', () => {
    expect(searchPrompts(index, '   ')).toEqual([])
  })

  it('finds a literal match', () => {
    expect(searchPrompts(index, 'landlord').map((h) => h.id)).toContain(1)
  })

  it('matches across plural and spelling differences', () => {
    expect(searchPrompts(index, 'emails').map((h) => h.id)).toContain(1)
  })

  it('finds a related prompt through a synonym', () => {
    // "letter" appears only in prompt 2, but is a synonym of "email".
    expect(searchPrompts(index, 'email').map((h) => h.id)).toContain(2)
  })

  it('ranks literal matches above synonym matches', () => {
    const ids = searchPrompts(index, 'email').map((h) => h.id)
    expect(ids.indexOf(1)).toBeLessThan(ids.indexOf(2))
  })

  it('respects the limit', () => {
    expect(searchPrompts(index, 'email', 1)).toHaveLength(1)
  })
})
