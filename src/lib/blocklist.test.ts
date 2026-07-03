import { describe, expect, it } from 'vitest'
import { isBlocked, EMPTY_BLOCKLIST, type Blocklist } from './blocklist'

const bl = (over: Partial<Blocklist> = {}): Blocklist => ({
  domains: [],
  patterns: [],
  ...over,
})

describe('isBlocked — domains', () => {
  it('blocks when the url host contains a blocked domain', () => {
    expect(
      isBlocked('https://claude.ai/chat/123', 'hello there', bl({ domains: ['claude.ai'] })),
    ).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(isBlocked('https://Claude.AI/x', 'hello there', bl({ domains: ['claude.ai'] }))).toBe(
      true,
    )
  })

  it('matches a subdomain via substring', () => {
    expect(
      isBlocked('https://chat.deepseek.com/x', 'hi there', bl({ domains: ['deepseek.com'] })),
    ).toBe(true)
  })

  it('does not block an unrelated host', () => {
    expect(isBlocked('https://chatgpt.com/x', 'hello there', bl({ domains: ['claude.ai'] }))).toBe(
      false,
    )
  })

  it('ignores empty/whitespace domain entries', () => {
    expect(isBlocked('https://chatgpt.com/x', 'hello there', bl({ domains: ['', '  '] }))).toBe(
      false,
    )
  })
})

describe('isBlocked — patterns', () => {
  it('blocks when a regex matches the prompt text', () => {
    expect(
      isBlocked(
        'https://chatgpt.com/x',
        'my key is sk-ABCDEFGHIJ1234567890',
        bl({ patterns: ['sk-[A-Za-z0-9]{10,}'] }),
      ),
    ).toBe(true)
  })

  it('does not block when no pattern matches', () => {
    expect(
      isBlocked(
        'https://chatgpt.com/x',
        'write me a poem',
        bl({ patterns: ['sk-[A-Za-z0-9]{10,}'] }),
      ),
    ).toBe(false)
  })

  it('skips an invalid regex instead of throwing', () => {
    expect(() =>
      isBlocked('https://chatgpt.com/x', 'anything at all', bl({ patterns: ['([unclosed'] })),
    ).not.toThrow()
    expect(
      isBlocked('https://chatgpt.com/x', 'anything at all', bl({ patterns: ['([unclosed'] })),
    ).toBe(false)
  })

  it('still applies valid patterns alongside an invalid one', () => {
    const list = bl({ patterns: ['([bad', 'password'] })
    expect(isBlocked('https://chatgpt.com/x', 'my password is hunter2', list)).toBe(true)
  })
})

describe('isBlocked — empty blocklist (fail-open default)', () => {
  it('blocks nothing with the empty blocklist', () => {
    expect(isBlocked('https://claude.ai/x', 'sk-secretkey', EMPTY_BLOCKLIST)).toBe(false)
  })

  it('handles an unparseable url by matching against the raw string', () => {
    expect(isBlocked('not a url claude.ai here', 'hello', bl({ domains: ['claude.ai'] }))).toBe(
      true,
    )
  })
})
