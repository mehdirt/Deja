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
      'ah ok',
      'well ok then',
      'okay sure thanks',
    ]) {
      expect(classifyPrompt(t, 'balanced').minor, t).toBe(true)
    }
  })

  // The all-filler rule's dangerous edge: a complete ask can be built entirely
  // out of small words, and skipping is permanent. Interrogatives and the copula
  // are deliberately NOT filler for exactly this reason.
  it('keeps short questions built only from small words', () => {
    for (const t of [
      'what is this',
      'how do i do this',
      'what do i do now',
      'is this good',
      'how much is this',
      'why is that',
      'is it done',
      'do you love me',
      'i love you',
    ]) {
      expect(classifyPrompt(t, 'balanced').minor, t).toBe(false)
    }
  })

  // Regression guard for the rule FILLER documents: a word belongs there only
  // if it is meaningless alone AND can't be the backbone of a clause. Each
  // phrase below is ONE backbone word surrounded by filler, so if any of them
  // is ever added to the set, that phrase becomes all-filler and this fails.
  // Built this way on purpose — a phrase with a real content word in it would
  // still pass and prove nothing.
  it('keeps a clause whose only non-filler word is its backbone', () => {
    for (const t of [
      'is it good', // is
      'are you sure', // are
      'was it good', // was
      'am i right', // am
      'can you do it', // can
      'will you please', // will
      'should i do it', // should
      'would you please', // would
      'does it work', // does — 'work' is not filler, 'works' is
      'what is this', // what
      'how much', // how
      'why me', // why
      'who are you', // who
      'love it now', // love
    ]) {
      expect(classifyPrompt(t, 'balanced').minor, t).toBe(false)
    }
  })

  it('still skips those same words when sent bare', () => {
    for (const t of ['what', 'how', 'why', 'wait', 'wait what']) {
      expect(classifyPrompt(t, 'balanced').minor, t).toBe(true)
    }
  })

  it('stops applying the all-filler rule past the word cap', () => {
    // 6 all-filler words is still glue; 7 is long enough that we keep it.
    expect(classifyPrompt('ok cool thanks so very nice', 'balanced').minor).toBe(true)
    expect(classifyPrompt('ok cool thanks so very nice yes', 'balanced').minor).toBe(false)
  })

  it('keeps a question even when every word is small', () => {
    expect(classifyPrompt('how much?', 'balanced').minor).toBe(false)
    expect(classifyPrompt('is it done?', 'balanced').minor).toBe(false)
  })

  it('keeps symbol-only text that is too long to be a reaction', () => {
    // A reaction is dropped; an ASCII diagram or a line of maths is a prompt.
    expect(classifyPrompt('👍', 'balanced').minor).toBe(true)
    expect(classifyPrompt('+---+ | | +---+ <-> [ ]', 'balanced').minor).toBe(false)
  })

  it('never skips anything longer than the short bar', () => {
    // Also the guard that keeps a long paste away from the edge-trim regex.
    const long = 'x'.repeat(200)
    expect(classifyPrompt(long, 'balanced').minor).toBe(false)
    expect(classifyPrompt(long, 'strict').minor).toBe(false)
    // An interior run of punctuation is the shape that makes the edge-trim
    // regex quadratic; the length guard means it never reaches it.
    const divider = 'a' + '-'.repeat(400) + 'a'
    const started = Date.now()
    expect(classifyPrompt(divider, 'balanced').minor).toBe(false)
    expect(Date.now() - started).toBeLessThan(50)
  })

  it('treats laughter as glue', () => {
    for (const t of ['haha', 'hehe', 'lolz', 'rofl', 'lmfao']) {
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

  // The topicless rule — the one that makes 'balanced' generalize past its word
  // lists. Each phrase below is a real clause that TRIVIAL and the all-filler
  // rule both let through, because neither can enumerate greetings and
  // placeholder nouns recombining.
  it('skips messages with no subject in them at balanced', () => {
    for (const t of [
      'hi there',
      'hey there',
      'hello there!',
      'good morning',
      'you there',
      'hi again',
      'hey guys',
      'anyone there',
      'quick question',
      'a quick question',
      'test message',
      'i need help',
      'help me',
      'another one please',
    ]) {
      const c = classifyPrompt(t, 'balanced')
      expect(c.minor, t).toBe(true)
      expect(c.reason, t).toBe('vague')
    }
  })

  // Unlike the all-filler rule, a question mark does NOT rescue a topicless
  // message: "u there?" is a question about nothing.
  it('skips a topicless message even when it is phrased as a question', () => {
    expect(classifyPrompt('hi there?', 'balanced').minor).toBe(true)
    expect(classifyPrompt('u there?', 'balanced').minor).toBe(true)
  })

  it('skips single-token keyboard mashing', () => {
    for (const t of ['asdfasdf', 'sdfsdf', 'blahblah']) {
      expect(classifyPrompt(t, 'balanced').minor, t).toBe(true)
    }
  })

  // The topicless rule's dangerous edge, and the reason SOCIAL and GENERIC are
  // separate sets rather than more entries in FILLER: every word below is
  // contentless in the phrase above it, and load-bearing here.
  it('keeps a subject-bearing prompt built from the same words', () => {
    for (const t of [
      'put it there', // there
      'a quick question about taxes', // quick, question
      'i need a recipe for lasagna', // need
      'help me write my cv', // help
      'another idea for the party', // another
      'what is this thing', // thing
    ]) {
      expect(classifyPrompt(t, 'balanced').minor, t).toBe(false)
    }
  })

  // SOCIAL / GENERIC / FILLER are English, so a non-English message has no
  // recognisable filler and always reads as subject-bearing. That is the
  // correct failure direction — keep it — but it is a real limitation, not an
  // accident, and this pins it so a future "optimisation" can't quietly invert
  // it. (The vowel-based mashing heuristic that would have broken this is why
  // REPEATED_UNIT exists instead.)
  it('fails open on non-English text rather than skipping it', () => {
    expect(classifyPrompt('سلام چطوری', 'balanced').minor).toBe(false)
    expect(classifyPrompt('こんにちは', 'balanced').minor).toBe(false)
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
