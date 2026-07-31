import { describe, it, expect } from 'vitest'
import { relativeTime, truncate, conversationUrl } from './format'

const NOW = new Date('2026-07-31T12:00:00Z').getTime()
const ago = (ms: number) => NOW - ms
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('relativeTime', () => {
  it('spells units out rather than abbreviating them', () => {
    expect(relativeTime(ago(5 * MIN), NOW)).toBe('5 minutes ago')
    expect(relativeTime(ago(3 * HOUR), NOW)).toBe('3 hours ago')
    expect(relativeTime(ago(4 * DAY), NOW)).toBe('4 days ago')
  })

  it('uses singulars and friendly words at the edges', () => {
    expect(relativeTime(ago(30_000), NOW)).toBe('just now')
    expect(relativeTime(ago(MIN), NOW)).toBe('1 minute ago')
    expect(relativeTime(ago(HOUR), NOW)).toBe('1 hour ago')
    expect(relativeTime(ago(DAY), NOW)).toBe('yesterday')
  })

  it('falls back to a date once relative time stops being useful', () => {
    expect(relativeTime(ago(120 * DAY), NOW)).toMatch(/\d{4}/)
  })

  it('never reports a future timestamp as negative', () => {
    expect(relativeTime(NOW + 10 * MIN, NOW)).toBe('just now')
  })
})

describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('cuts and ellipsises longer text', () => {
    expect(truncate('hello world', 5)).toBe('hello…')
  })
})

describe('conversationUrl', () => {
  it('keeps a link that points at a real conversation', () => {
    expect(conversationUrl('https://chatgpt.com/c/abc-123')).toBe('https://chatgpt.com/c/abc-123')
    expect(conversationUrl('https://claude.ai/chat/xyz')).toBe('https://claude.ai/chat/xyz')
  })

  it('drops a bare landing URL, which would just reload the homepage', () => {
    expect(conversationUrl('https://chatgpt.com/')).toBeNull()
    expect(conversationUrl('https://gemini.google.com/app')).toBeNull()
    expect(conversationUrl('https://claude.ai/new')).toBeNull()
  })

  it('refuses anything that is not a plain https URL', () => {
    expect(conversationUrl('javascript:alert(1)')).toBeNull()
    expect(conversationUrl('http://chatgpt.com/c/abc')).toBeNull()
    expect(conversationUrl('')).toBeNull()
    expect(conversationUrl('not a url')).toBeNull()
  })
})
