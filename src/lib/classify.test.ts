import { describe, it, expect } from 'vitest'
import { classifyPrompt } from './classify'

describe('classifyPrompt', () => {
  it('flags bare conversational glue as minor (trivial)', () => {
    for (const t of ['yes', 'No', 'ok', 'continue', 'go on', 'thanks', 'do it', 'explain']) {
      const c = classifyPrompt(t)
      expect(c.minor, t).toBe(true)
      expect(c.reason, t).toBe('trivial')
    }
  })

  it('ignores trailing punctuation when matching trivial prompts', () => {
    expect(classifyPrompt('yes.').minor).toBe(true)
    expect(classifyPrompt('continue!').minor).toBe(true)
    expect(classifyPrompt('thanks…').minor).toBe(true)
  })

  it('flags very short fragments with no substance as minor (short)', () => {
    const c = classifyPrompt('make it blue')
    expect(c.minor).toBe(true)
    expect(c.reason).toBe('short')
  })

  it('treats empty / whitespace-only as minor', () => {
    expect(classifyPrompt('').minor).toBe(true)
    expect(classifyPrompt('   \n  ').minor).toBe(true)
  })

  it('keeps a trivial WORD when it leads a real, substantial prompt', () => {
    expect(classifyPrompt('explain how the TCP three-way handshake works').minor).toBe(false)
    expect(classifyPrompt('continue the story where the dragon enters the village').minor).toBe(
      false,
    )
  })

  it('keeps longer, specific prompts', () => {
    expect(
      classifyPrompt('Act as a senior code reviewer and critique this function for bugs').minor,
    ).toBe(false)
  })

  it('rescues a short prompt that contains code', () => {
    expect(classifyPrompt('fix `const x = 1`').minor).toBe(false)
    expect(classifyPrompt('what does ```rm -rf``` do').minor).toBe(false)
  })

  it('rescues a short prompt that contains a URL or file path', () => {
    expect(classifyPrompt('summarize https://example.com/x').minor).toBe(false)
    expect(classifyPrompt('explain main.py').minor).toBe(false)
  })

  it('rescues a short prompt with list structure or multiple sentences', () => {
    expect(classifyPrompt('do this:\n- a\n- b').minor).toBe(false)
    expect(classifyPrompt('Go left. Then stop.').minor).toBe(false)
  })

  it('keeps a short-but-wordy prompt (>= RICH_WORDS words)', () => {
    expect(classifyPrompt('write a poem about a small cat').minor).toBe(false)
  })

  it('rescues short everyday prompts that specify a tone, audience or format', () => {
    for (const t of [
      'reply to this, but polite',
      'explain gravity to a 6 year old',
      'rewrite as a table',
      'say it in French',
    ]) {
      expect(classifyPrompt(t, 'strict').minor, t).toBe(false)
    }
  })

  it('rescues short prompts carrying a real limit or quantity', () => {
    expect(classifyPrompt('cut to 100 words', 'strict').minor).toBe(false)
    expect(classifyPrompt('give me 5 ideas', 'strict').minor).toBe(false)
  })

  it('rescues a short but genuine question', () => {
    expect(classifyPrompt('is oat milk bad for you?', 'strict').minor).toBe(false)
  })

  it('still skips throwaways that merely happen to be questions', () => {
    expect(classifyPrompt('why?').minor).toBe(true)
    expect(classifyPrompt('really?').minor).toBe(true)
  })

  it("strength 'off' keeps everything, even bare glue", () => {
    expect(classifyPrompt('yes', 'off').minor).toBe(false)
    expect(classifyPrompt('', 'off').minor).toBe(false)
    expect(classifyPrompt('make it blue', 'off').minor).toBe(false)
  })

  it("strength 'strict' hides medium prompts that 'balanced' keeps", () => {
    const p = 'write a short poem about the sea'
    expect(classifyPrompt(p, 'balanced').minor).toBe(false)
    expect(classifyPrompt(p, 'strict').minor).toBe(true)
  })

  it("strength 'strict' still keeps long or structured prompts", () => {
    expect(
      classifyPrompt(
        'Act as a senior reviewer and critique this function for correctness and clarity',
        'strict',
      ).minor,
    ).toBe(false)
    expect(classifyPrompt('fix `const x = 1`', 'strict').minor).toBe(false)
  })
})
