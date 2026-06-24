import { describe, expect, it } from 'vitest'
import { buildMarkdown, promptToMarkdownSection } from './markdown'
import type { Prompt } from './types'

function makePrompt(over: Partial<Prompt> = {}): Prompt {
  return {
    text: 'hello world',
    platform: 'chatgpt',
    url: 'https://chatgpt.com',
    createdAt: 1_700_000_000_000,
    usageCount: 0,
    lastUsedAt: 0,
    ...over,
  }
}

describe('promptToMarkdownSection', () => {
  it('uses a plain 3-backtick fence for normal text', () => {
    const section = promptToMarkdownSection(makePrompt({ text: 'just words' }), 'ChatGPT', 'today')
    expect(section).toContain('```\njust words\n```')
  })

  it('renders the human platform label and date in the heading', () => {
    const section = promptToMarkdownSection(makePrompt(), 'ChatGPT', 'Nov 14, 2023')
    expect(section.startsWith('## ChatGPT — Nov 14, 2023')).toBe(true)
  })

  it('renders a tags line when tags are present', () => {
    const section = promptToMarkdownSection(
      makePrompt({ tags: ['code', 'react'] }),
      'Claude',
      'today',
    )
    expect(section).toContain('_tags: code, react_')
  })

  it('omits the tags line when there are no tags', () => {
    const section = promptToMarkdownSection(makePrompt({ tags: [] }), 'Claude', 'today')
    expect(section).not.toContain('_tags:')
  })

  it('uses a longer fence when the text contains a triple-backtick run', () => {
    const text = 'here is code:\n```\nconst x = 1\n```'
    const section = promptToMarkdownSection(makePrompt({ text }), 'ChatGPT', 'today')
    // The opening/closing fence must be at least 4 backticks (longer than the
    // run of 3 inside the text), so the inner ``` can't close the block early.
    expect(section).toContain('````\n' + text + '\n````')
  })

  it('round-trips a fenced-code prompt: the inner ``` does not close the block', () => {
    const text = '```js\nfoo()\n```'
    const section = promptToMarkdownSection(makePrompt({ text }), 'ChatGPT', 'today')
    const fence = '`'.repeat(4)
    const open = section.indexOf(fence)
    const close = section.indexOf(fence, open + fence.length)
    // Everything between the outer fences is exactly the original text.
    expect(section.slice(open + fence.length + 1, close - 1)).toBe(text)
  })
})

describe('buildMarkdown', () => {
  it('filters out soft-deleted rows', () => {
    const md = buildMarkdown([
      makePrompt({ text: 'kept one' }),
      makePrompt({ text: 'tombstoned', deletedAt: Date.now() }),
    ])
    expect(md).toContain('kept one')
    expect(md).not.toContain('tombstoned')
    expect(md).toContain('1 prompt · stored locally')
  })

  it('renders an empty header when there are no live prompts', () => {
    const md = buildMarkdown([])
    expect(md).toContain('# deja export')
    expect(md).toContain('0 prompts · stored locally')
  })
})
