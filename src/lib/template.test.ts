import { describe, it, expect } from 'vitest'
import { blankLabel, findPlaceholders, isTemplate, fillTemplate } from './template'

describe('findPlaceholders', () => {
  it('finds single- and double-brace blanks', () => {
    expect(findPlaceholders('write about {topic}')).toEqual([{ name: 'topic', token: '{topic}' }])
    expect(findPlaceholders('hello {{name}}')).toEqual([{ name: 'name', token: '{{name}}' }])
  })

  it('finds the placeholders PII redaction leaves behind', () => {
    expect(findPlaceholders('email [email] about the invoice')).toEqual([
      { name: 'email', token: '[email]' },
    ])
    expect(findPlaceholders('email [email_1] and [email_2]')).toEqual([
      { name: 'email_1', token: '[email_1]' },
      { name: 'email_2', token: '[email_2]' },
    ])
  })

  it('ignores bracketed words that are not PII placeholders', () => {
    expect(findPlaceholders('the report [sic] was late')).toEqual([])
    expect(findPlaceholders('see [the docs](https://x.com)')).toEqual([])
  })

  it('leaves code and JSON alone', () => {
    expect(findPlaceholders('fix this: { "a": 1, "b": [2, 3] }')).toEqual([])
    expect(findPlaceholders('why does .btn { color: red; } not work')).toEqual([])
  })

  it('ignores braces inside fenced or inline code', () => {
    const fenced = [
      'Explain this:',
      '',
      '```python',
      'def greet(name):',
      '    return f"Hello, {name}!"',
      '',
      'print(greet("World"))',
      '```',
    ].join('\n')
    expect(findPlaceholders(fenced)).toEqual([])
    expect(findPlaceholders('Use `f"Hello, {name}!"` as an example')).toEqual([])
  })

  it('ignores unfenced f-strings and def/return lines', () => {
    const bare = [
      'def greet(name):',
      '    return f"Hello, {name}!"',
      '',
      'print(greet("World"))',
    ].join('\n')
    expect(findPlaceholders(bare)).toEqual([])
  })

  it('still finds prose blanks next to a code fence', () => {
    const mixed = [
      'Rewrite this for {audience}:',
      '',
      '```js',
      'console.log(`hi ${name}`)',
      'const x = {name}',
      '```',
    ].join('\n')
    expect(findPlaceholders(mixed)).toEqual([{ name: 'audience', token: '{audience}' }])
  })

  it('deduplicates a blank used more than once, keeping first-seen order', () => {
    const found = findPlaceholders('a {x} then {y} then {x} again')
    expect(found.map((p) => p.name)).toEqual(['x', 'y'])
  })

  it('tolerates whitespace inside the braces', () => {
    expect(findPlaceholders('about { topic }')[0].name).toBe('topic')
  })

  it('rejects blanks that are too long to be a field name', () => {
    expect(findPlaceholders(`{${'x'.repeat(60)}}`)).toEqual([])
  })
})

describe('isTemplate', () => {
  it('is true only when there is something to fill in', () => {
    expect(isTemplate('write a post about {topic}')).toBe(true)
    expect(isTemplate('write a post about cats')).toBe(false)
  })
})

describe('fillTemplate', () => {
  it('replaces every occurrence of each blank', () => {
    expect(fillTemplate('{x} and {x} and {y}', { x: 'a', y: 'b' })).toBe('a and a and b')
  })

  it('leaves unfilled blanks untouched so the prompt still reads', () => {
    expect(fillTemplate('write about {topic} for {audience}', { topic: 'bees' })).toBe(
      'write about bees for {audience}',
    )
    expect(fillTemplate('write about {topic}', { topic: '   ' })).toBe('write about {topic}')
  })

  it('fills PII placeholders', () => {
    expect(fillTemplate('email [email] today', { email: 'sam@example.com' })).toBe(
      'email sam@example.com today',
    )
    expect(fillTemplate('email [email_1] today', { email_1: 'sam@example.com' })).toBe(
      'email sam@example.com today',
    )
  })

  it('does not re-substitute text introduced by an earlier fill', () => {
    expect(fillTemplate('{a} {b}', { a: '{b}', b: 'x' })).toBe('{b} x')
  })

  it('returns the original when there is nothing to fill', () => {
    expect(fillTemplate('plain prompt', { a: 'b' })).toBe('plain prompt')
  })
})

describe('blankLabel', () => {
  it('title-cases everyday template tokens', () => {
    expect(blankLabel('topic')).toBe('Topic')
    expect(blankLabel('audience_name')).toBe('Audience Name')
  })

  it('keeps friendly names for PII placeholders', () => {
    expect(blankLabel('email')).toBe('Email')
    expect(blankLabel('email_1')).toBe('Email 1')
    expect(blankLabel('person')).toBe('Name')
  })
})
