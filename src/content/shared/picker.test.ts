import { describe, expect, it, vi } from 'vitest'
import { findTrigger } from './picker'
import { renderBlanks } from './blanks'

// The trigger rules are the whole reason `//` is safe to use on someone else's
// page: it must open when a person reaches for it and stay shut every other
// time, especially inside a URL.

describe('findTrigger', () => {
  it('opens on // at the start of the box', () => {
    expect(findTrigger('//')).toEqual({ at: 0, query: '' })
    expect(findTrigger('//trip')).toEqual({ at: 0, query: 'trip' })
  })

  it('opens mid-sentence, after a space', () => {
    expect(findTrigger('ask them about //email')).toEqual({ at: 15, query: 'email' })
  })

  it('never opens inside a URL', () => {
    expect(findTrigger('https://')).toBeNull()
    expect(findTrigger('see https://example.com')).toBeNull()
    expect(findTrigger('file://tmp')).toBeNull()
  })

  it('never opens when the slashes are glued to a word', () => {
    expect(findTrigger('and/or//maybe')).toBeNull()
    expect(findTrigger('a//b')).toBeNull()
  })

  it('lets go once the query stops looking like a search', () => {
    // A newline means they moved on.
    expect(findTrigger('//email\nnext line')).toBeNull()
    // A double space means they are writing prose, not filtering.
    expect(findTrigger('//write a  letter')).toBeNull()
    // Long enough that this is a sentence, not a query.
    expect(findTrigger('//' + 'x'.repeat(61))).toBeNull()
  })

  it('tracks the most recent trigger, not the first', () => {
    const hit = findTrigger('//one thing then //two')
    expect(hit).toEqual({ at: 17, query: 'two' })
  })

  it('returns null when there is no trigger at all', () => {
    expect(findTrigger('')).toBeNull()
    expect(findTrigger('just typing normally')).toBeNull()
  })
})

describe('renderBlanks interaction & isolation', () => {
  it('renders input fields for each placeholder and isolates input events', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const onDone = vi.fn()
    const onCancel = vi.fn()
    const text = 'Write an email to my landlord about {issue} in {apartment}.'

    const handle = renderBlanks(container, { text, onDone, onCancel })
    const inputs = container.querySelectorAll<HTMLInputElement>('.dj-input')
    expect(inputs.length).toBe(2)

    // Focuses the first field
    handle.focus()
    expect(document.activeElement).toBe(inputs[0])

    // Types into fields
    inputs[0].value = 'a leaking pipe'
    inputs[1].value = 'unit 4B'

    // Keydown Enter commits the filled template
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    const stopPropagationSpy = vi.spyOn(enterEvent, 'stopPropagation')
    inputs[0].dispatchEvent(enterEvent)

    expect(stopPropagationSpy).toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledWith(
      'Write an email to my landlord about a leaking pipe in unit 4B.',
    )

    container.remove()
  })

  it('stops input event propagation to prevent triggering outer composer searches', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    renderBlanks(container, {
      text: 'Test {topic}',
      onDone: vi.fn(),
      onCancel: vi.fn(),
    })

    const input = container.querySelector<HTMLInputElement>('.dj-input')!
    const inputEvent = new Event('input', { bubbles: true })
    const stopSpy = vi.spyOn(inputEvent, 'stopPropagation')

    input.dispatchEvent(inputEvent)
    expect(stopSpy).toHaveBeenCalled()

    container.remove()
  })
})

