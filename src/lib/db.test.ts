import { describe, expect, it } from 'vitest'
import { normalizePromptText, promptTextMatches } from './db'

describe('normalizePromptText', () => {
  it('collapses whitespace and lowercases', () => {
    expect(normalizePromptText('  Hello   World \n')).toBe('hello world')
  })
})

describe('promptTextMatches', () => {
  it('treats whitespace and case differences as the same prompt', () => {
    expect(promptTextMatches('Fix the bug', '  fix   the bug  ')).toBe(true)
  })

  it('distinguishes different prompts', () => {
    expect(promptTextMatches('Fix the bug', 'Fix another bug')).toBe(false)
  })
})
