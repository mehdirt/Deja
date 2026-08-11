import { describe, expect, it } from 'vitest'
import {
  FIELD_INSET,
  fieldBox,
  findSendControl,
  isChromeControl,
  pickComposerSpot,
  pickSpot,
  resolveComposerShell,
  spotBesideControl,
  spotFor,
  type Spot,
} from './anchor'

const box = (): DOMRect =>
  ({ left: 100, top: 200, right: 700, bottom: 300, width: 600, height: 100, x: 100, y: 200 }) as DOMRect

const SIZE = 26
const GAP = FIELD_INSET
const free = () => false

const fakeRect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {
      return this
    },
  }) as DOMRect

describe('spotBesideControl', () => {
  it('sits left of Send, vertically centred', () => {
    const send = fakeRect(600, 210, 36, 36)
    const s = spotBesideControl(send, SIZE, 8)
    expect(s.left).toBe(600 - SIZE - 8)
    expect(s.top).toBe(210 + (36 - SIZE) / 2)
  })
})

describe('pickComposerSpot (screenshot-driven)', () => {
  it('DeepSeek/Claude tall card: left of bottom Send, not text-row corner', () => {
    document.body.innerHTML = ''
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })

    // Tall shell: text on top, Send on bottom toolbar.
    const shell = document.createElement('form')
    const field = document.createElement('textarea')
    const send = document.createElement('button')
    send.type = 'submit'
    send.setAttribute('aria-label', 'Send message')
    shell.append(field, send)
    document.body.appendChild(shell)

    shell.getBoundingClientRect = () => fakeRect(100, 200, 640, 160)
    field.getBoundingClientRect = () => fakeRect(116, 212, 600, 48)
    send.getBoundingClientRect = () => fakeRect(680, 310, 36, 36)
    Object.defineProperty(field, 'clientWidth', { value: 600 })
    Object.defineProperty(field, 'clientHeight', { value: 48 })

    const proto = window.getComputedStyle
    window.getComputedStyle = (el: Element) => {
      if (el === shell) return { display: 'flex', borderLeftWidth: '0px', borderTopWidth: '0px' } as CSSStyleDeclaration
      return { display: 'block', borderLeftWidth: '0px', borderTopWidth: '0px' } as CSSStyleDeclaration
    }
    try {
      const spot = pickComposerSpot(field, SIZE, free, { mode: 'beside-send', gap: 8 })
      // Beside Send at bottom — not at field.top (text-row / "card top-right").
      expect(spot.left).toBe(680 - SIZE - 8)
      expect(spot.top).toBeGreaterThan(280)
      expect(spot.top).toBe(310 + (36 - SIZE) / 2)
    } finally {
      window.getComputedStyle = proto
    }
  })

  it('ChatGPT: left of sibling Voice/Send outside the editable cell', () => {
    document.body.innerHTML = ''
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })

    const shell = document.createElement('form')
    const field = document.createElement('div')
    field.setAttribute('contenteditable', 'true')
    const send = document.createElement('button')
    send.setAttribute('data-testid', 'send-button')
    shell.append(field, send)
    document.body.appendChild(shell)

    shell.getBoundingClientRect = () => fakeRect(400, 340, 650, 52)
    field.getBoundingClientRect = () => fakeRect(461, 351, 447, 42)
    send.getBoundingClientRect = () => fakeRect(958, 347, 36, 36)
    Object.defineProperty(field, 'clientWidth', { value: 447 })
    Object.defineProperty(field, 'clientHeight', { value: 42 })

    const proto = window.getComputedStyle
    window.getComputedStyle = (el: Element) => {
      if (el === shell) return { display: 'grid', borderLeftWidth: '0px', borderTopWidth: '0px' } as CSSStyleDeclaration
      return { display: 'block', borderLeftWidth: '0px', borderTopWidth: '0px' } as CSSStyleDeclaration
    }
    try {
      const spot = pickComposerSpot(field, SIZE, free, { mode: 'beside-send', gap: 8 })
      expect(spot.left).toBe(958 - SIZE - 8)
      expect(spot.top).toBe(347 + (36 - SIZE) / 2)
    } finally {
      window.getComputedStyle = proto
    }
  })
})

describe('pickSpot', () => {
  it('slides left along the bottom when the corner is taken', () => {
    const blockedRight = box().right - SIZE - GAP
    const occupied = (s: Spot) => s.corner === 'bottom-right' && s.left > blockedRight - 20
    const spot = pickSpot(box(), SIZE, GAP, occupied)
    expect(spot.corner).toBe('bottom-right')
    expect(spot.left).toBeLessThanOrEqual(blockedRight - 20)
  })
})

describe('spotFor', () => {
  it('parks bottom-right with inset', () => {
    const rect = box()
    const s = spotFor(rect, SIZE, GAP, 'bottom-right')
    expect(s.left).toBe(rect.right - SIZE - GAP)
  })
})

describe('fieldBox', () => {
  it('excludes border and uses clientWidth/Height', () => {
    const el = document.createElement('div')
    el.getBoundingClientRect = () => fakeRect(10, 20, 200, 100)
    Object.defineProperty(el, 'clientWidth', { value: 180 })
    Object.defineProperty(el, 'clientHeight', { value: 90 })
    const proto = window.getComputedStyle
    window.getComputedStyle = () =>
      ({ borderLeftWidth: '2px', borderTopWidth: '2px' }) as CSSStyleDeclaration
    try {
      const r = fieldBox(el)!
      expect(r.left).toBe(12)
      expect(r.width).toBe(180)
    } finally {
      window.getComputedStyle = proto
    }
  })
})

describe('isChromeControl + findSendControl', () => {
  it('skips model pickers and prefers the real end action', () => {
    document.body.innerHTML = ''
    const shell = document.createElement('div')
    const field = document.createElement('textarea')
    const model = document.createElement('button')
    model.textContent = 'Flash'
    model.setAttribute('aria-label', 'Flash')
    const mic = document.createElement('button')
    mic.setAttribute('aria-label', 'Microphone')
    shell.append(field, model, mic)
    document.body.appendChild(shell)
    shell.getBoundingClientRect = () => fakeRect(100, 200, 600, 48)
    field.getBoundingClientRect = () => fakeRect(110, 208, 400, 32)
    model.getBoundingClientRect = () => fakeRect(520, 210, 50, 28)
    mic.getBoundingClientRect = () => fakeRect(580, 210, 32, 32)

    expect(isChromeControl(model)).toBe(true)
    expect(isChromeControl(mic)).toBe(false)
    expect(findSendControl(shell, field)?.getAttribute('aria-label')).toBe('Microphone')
  })
  it('Claude/Gemini: stays left of mic even when a model chip sits beside it', () => {
    document.body.innerHTML = ''
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })

    const shell = document.createElement('div')
    const field = document.createElement('div')
    field.setAttribute('contenteditable', 'true')
    const flash = document.createElement('button')
    flash.textContent = 'Flash'
    flash.setAttribute('aria-label', 'Open mode picker, currently Flash-Lite')
    const mic = document.createElement('button')
    mic.setAttribute('aria-label', 'Dictate (⌘⇧D)')
    shell.append(field, flash, mic)
    document.body.appendChild(shell)

    shell.getBoundingClientRect = () => fakeRect(200, 400, 700, 56)
    field.getBoundingClientRect = () => fakeRect(220, 410, 400, 36)
    flash.getBoundingClientRect = () => fakeRect(720, 412, 56, 32)
    mic.getBoundingClientRect = () => fakeRect(800, 412, 36, 36)
    Object.defineProperty(field, 'clientWidth', { value: 400 })
    Object.defineProperty(field, 'clientHeight', { value: 36 })

    // Old bug: isOccupied(Flash) made us slide further left → beside Flash.
    const occupiedByFlash = (s: Spot) =>
      s.left < 800 - SIZE - 8 && s.left + SIZE > 720 && s.top < 444 && s.top + SIZE > 412

    const spot = pickComposerSpot(field, SIZE, occupiedByFlash, {
      mode: 'beside-send',
      gap: 6,
    })
    expect(spot.left).toBe(800 - SIZE - 6)
    expect(spot.left).toBeGreaterThan(720) // still to the right of Flash
  })

  it('shell fallback does not slide left past a model chip', () => {
    document.body.innerHTML = ''
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })

    const shell = document.createElement('div')
    const field = document.createElement('div')
    field.setAttribute('contenteditable', 'true')
    const sonnet = document.createElement('button')
    sonnet.textContent = 'Sonnet 5 Medium'
    sonnet.setAttribute('aria-label', 'Sonnet 5 Medium')
    // Mic is a non-button icon Claude sometimes uses — no matching control.
    shell.append(field, sonnet)
    document.body.appendChild(shell)

    shell.getBoundingClientRect = () => fakeRect(100, 200, 640, 120)
    field.getBoundingClientRect = () => fakeRect(116, 212, 600, 48)
    sonnet.getBoundingClientRect = () => fakeRect(520, 280, 90, 28)
    Object.defineProperty(field, 'clientWidth', { value: 600 })
    Object.defineProperty(field, 'clientHeight', { value: 48 })
    Object.defineProperty(shell, 'clientWidth', { value: 640 })
    Object.defineProperty(shell, 'clientHeight', { value: 120 })

    const proto = window.getComputedStyle
    window.getComputedStyle = (el: Element) => {
      if (el === shell) return { display: 'flex', borderLeftWidth: '0px', borderTopWidth: '0px' } as CSSStyleDeclaration
      return { display: 'block', borderLeftWidth: '0px', borderTopWidth: '0px' } as CSSStyleDeclaration
    }
    try {
      const occupied = () => true // would have slid under old pickSpot
      const spot = pickComposerSpot(field, SIZE, occupied, { mode: 'beside-send', gap: 8 })
      // Shell BR, not slid left of Sonnet.
      expect(spot.left).toBe(100 + 640 - SIZE - 8)
      expect(spot.left).toBeGreaterThan(520)
    } finally {
      window.getComputedStyle = proto
    }
  })
})

describe('resolveComposerShell', () => {
  it('prefers a tight pill over a full-bleed form (Grok)', () => {
    document.body.innerHTML = ''
    Object.defineProperty(window, 'innerWidth', { value: 1400, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })

    const form = document.createElement('form')
    const pill = document.createElement('div')
    const field = document.createElement('textarea')
    const send = document.createElement('button')
    send.setAttribute('aria-label', 'Submit')
    pill.append(field, send)
    form.appendChild(pill)
    document.body.appendChild(form)

    form.getBoundingClientRect = () => fakeRect(16, 300, 1360, 60)
    pill.getBoundingClientRect = () => fakeRect(200, 300, 800, 60)
    field.getBoundingClientRect = () => fakeRect(244, 319, 631, 40)
    send.getBoundingClientRect = () => fakeRect(950, 329, 40, 40)

    expect(resolveComposerShell(field)).toBe(pill)
  })
})
