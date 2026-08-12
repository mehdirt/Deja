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

  it('at balanced, keeps short non-glue asks that strict would skip', () => {
    for (const t of ['make it blue', 'ideas for date night', 'draft a resignation email']) {
      expect(classifyPrompt(t, 'balanced').minor, t).toBe(false)
      expect(classifyPrompt(t, 'strict').minor, t).toBe(true)
      expect(classifyPrompt(t, 'strict').reason, t).toBe('short')
    }
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

  it('rescues a short prompt that contains code (strict)', () => {
    expect(classifyPrompt('fix `const x = 1`', 'strict').minor).toBe(false)
    expect(classifyPrompt('what does ```rm -rf``` do', 'strict').minor).toBe(false)
  })

  it('rescues a short prompt that contains a URL or file path (strict)', () => {
    expect(classifyPrompt('summarize https://example.com/x', 'strict').minor).toBe(false)
    expect(classifyPrompt('explain main.py', 'strict').minor).toBe(false)
  })

  it('rescues a short prompt with list structure or multiple sentences (strict)', () => {
    expect(classifyPrompt('do this:\n- a\n- b', 'strict').minor).toBe(false)
    expect(classifyPrompt('Go left. Then stop.', 'strict').minor).toBe(false)
  })

  it('keeps a short-but-wordy prompt at balanced without needing craft cues', () => {
    expect(classifyPrompt('write a poem about a small cat').minor).toBe(false)
  })

  it('rescues short everyday prompts that specify a tone, audience or format', () => {
    for (const t of [
      'reply to this, but polite',
      'explain gravity to a 6 year old',
      'rewrite as a table',
      'say it in French',
      'translate to Spanish',
      'ELI5 photosynthesis',
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

  it('flags everyday acknowledgements and keep-going phrases as trivial', () => {
    for (const t of ['got it', 'sounds good', 'try again', 'lol', 'more detail', 'send it']) {
      const c = classifyPrompt(t)
      expect(c.minor, t).toBe(true)
      expect(c.reason, t).toBe('trivial')
    }
  })

  it('rescues spelled-out small counts, not only digits', () => {
    expect(classifyPrompt('give me five ideas', 'strict').minor).toBe(false)
  })

  it("strength 'off' keeps everything, even bare glue", () => {
    expect(classifyPrompt('yes', 'off').minor).toBe(false)
    expect(classifyPrompt('ok thanks', 'off').minor).toBe(false)
    expect(classifyPrompt('👍', 'off').minor).toBe(false)
    expect(classifyPrompt('make it blue', 'off').minor).toBe(false)
  })

  it('skips empty text at every strength, including off', () => {
    for (const s of ['off', 'balanced', 'strict'] as const) {
      expect(classifyPrompt('', s).minor, s).toBe(true)
      expect(classifyPrompt('  \n ', s).minor, s).toBe(true)
    }
  })

  it('matches trivial phrases typed with a smart apostrophe', () => {
    expect(classifyPrompt('that’s fine').minor).toBe(true)
    expect(classifyPrompt('that’s fine').reason).toBe('trivial')
  })

  it('skips glue combinations no phrase list could enumerate', () => {
    for (const t of [
      'ok thanks',
      'yes please',
      'thank you so much',
      'got it, cool',
      'ok cool thanks',
      'no worries',
      'ah ok',
      'well ok then',
    ]) {
      expect(classifyPrompt(t, 'balanced').minor, t).toBe(true)
    }
  })

  it('skips messages made only of emoji or punctuation', () => {
    for (const t of ['👍', '🙏🏽', '???', '...', '!!!', '👍👍']) {
      const c = classifyPrompt(t, 'balanced')
      expect(c.minor, t).toBe(true)
      expect(c.reason, t).toBe('trivial')
    }
  })

  it('skips glue dressed up with emoji or stretched letters', () => {
    for (const t of ['ok 👍', 'thanks!! 🙏', 'yesss', 'okkkk', 'hahaha', 'loool', 'perfect 🎉']) {
      expect(classifyPrompt(t, 'balanced').minor, t).toBe(true)
    }
  })

  it('does not mistake a real short ask for filler', () => {
    for (const t of [
      'make it blue',
      'ideas for date night',
      'what rhymes with orange',
      'is it going to rain',
      'why do cats purr',
      'love poem for my wife',
    ]) {
      expect(classifyPrompt(t, 'balanced').minor, t).toBe(false)
    }
  })

  it('rescues a short prompt that names an output format (strict)', () => {
    for (const t of [
      'put it in a table',
      'as a checklist',
      'reply in markdown',
      'in bullet points',
    ]) {
      expect(classifyPrompt(t, 'strict').minor, t).toBe(false)
    }
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

  it('matches Settings golden examples for each strength', () => {
    // balanced — skip glue, keep short real asks
    expect(classifyPrompt('yes', 'balanced').minor).toBe(true)
    expect(classifyPrompt('got it', 'balanced').minor).toBe(true)
    expect(classifyPrompt('continue', 'balanced').minor).toBe(true)
    expect(classifyPrompt('make it blue', 'balanced').minor).toBe(false)
    expect(classifyPrompt('ideas for date night', 'balanced').minor).toBe(false)
    // strict — skip short fragments, keep composed asks
    expect(classifyPrompt('make it blue', 'strict').minor).toBe(true)
    expect(classifyPrompt('try again', 'strict').minor).toBe(true)
    expect(classifyPrompt('explain gravity to a 6-year-old', 'strict').minor).toBe(false)
    expect(classifyPrompt('plan 3 days of dinners', 'strict').minor).toBe(false)
  })
})
