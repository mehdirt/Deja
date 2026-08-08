import { describe, expect, it } from 'vitest'
import { looksLikeMarkdown } from './promptFormat'

describe('looksLikeMarkdown', () => {
  it('is false for ordinary prose', () => {
    expect(looksLikeMarkdown('Write a kind email to my landlord about the leak.')).toBe(false)
    expect(looksLikeMarkdown('What is 2 * 3? Just curious.')).toBe(false)
    expect(looksLikeMarkdown('')).toBe(false)
  })

  it('is true for fenced code alone', () => {
    expect(
      looksLikeMarkdown('Fix this:\n\n```ts\nconst x = 1\n```\n'),
    ).toBe(true)
  })

  it('is true when enough markdown signals combine', () => {
    expect(
      looksLikeMarkdown('## Goals\n\n- Be clear\n- Be kind\n'),
    ).toBe(true)
    expect(
      looksLikeMarkdown('Use `JSON.parse` and **validate** the result.'),
    ).toBe(true)
  })

  it('is false for a single weak signal', () => {
    expect(looksLikeMarkdown('Remember to be *gentle*.')).toBe(false)
    expect(looksLikeMarkdown('- one lonely bullet')).toBe(false)
  })
})
