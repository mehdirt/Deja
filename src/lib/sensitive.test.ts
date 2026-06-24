import { describe, it, expect } from 'vitest'
import {
  isCapturableField,
  isSensitiveField,
  withinComposer,
  looksLikeAuthPath,
  safeCaptureUrl,
} from './sensitive'

function el(html: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.innerHTML = html.trim()
  return wrap.firstElementChild as HTMLElement
}

describe('isCapturableField', () => {
  it('captures a plain textarea', () => {
    expect(isCapturableField(el('<textarea></textarea>'))).toBe(true)
  })

  it('captures a contenteditable div (the modern composer)', () => {
    const d = el('<div contenteditable="true"></div>')
    expect(isCapturableField(d)).toBe(true)
  })

  it('NEVER captures a password input — the reported bug', () => {
    expect(isCapturableField(el('<input type="password" />'))).toBe(false)
  })

  it('never captures any plain input (email, search, text, tel)', () => {
    for (const t of ['text', 'email', 'search', 'tel', 'number', 'url']) {
      expect(isCapturableField(el(`<input type="${t}" />`))).toBe(false)
    }
  })

  it('refuses a textarea that is labelled like a secret', () => {
    expect(isCapturableField(el('<textarea name="otp"></textarea>'))).toBe(false)
    expect(isCapturableField(el('<textarea id="api-key-field"></textarea>'))).toBe(false)
  })

  it('returns false for null', () => {
    expect(isCapturableField(null)).toBe(false)
  })
})

describe('isSensitiveField', () => {
  it('flags a password input', () => {
    expect(isSensitiveField(el('<input type="password" />'))).toBe(true)
  })

  it('flags fields by name/id/aria-label/placeholder', () => {
    expect(isSensitiveField(el('<input name="password" />'))).toBe(true)
    expect(isSensitiveField(el('<input id="user_pwd" />'))).toBe(true)
    expect(isSensitiveField(el('<input aria-label="One-time code" />'))).toBe(true)
    expect(isSensitiveField(el('<input placeholder="CVC" />'))).toBe(true)
  })

  it('flags sensitive autocomplete tokens', () => {
    expect(isSensitiveField(el('<input autocomplete="current-password" />'))).toBe(true)
    expect(isSensitiveField(el('<input autocomplete="one-time-code" />'))).toBe(true)
    expect(isSensitiveField(el('<input autocomplete="cc-number" />'))).toBe(true)
  })

  it('treats any field inside a login form (one with a password input) as sensitive', () => {
    const form = el(
      '<form><input type="text" name="username" /><input type="password" /></form>',
    )
    const username = form.querySelector('input[name="username"]')
    expect(isSensitiveField(username)).toBe(true)
  })

  it('flags newer secret tokens (passcode, recovery, seed phrase, mnemonic)', () => {
    expect(isSensitiveField(el('<input name="passcode" />'))).toBe(true)
    expect(isSensitiveField(el('<input aria-label="Recovery key" />'))).toBe(true)
    expect(isSensitiveField(el('<textarea placeholder="seed phrase"></textarea>'))).toBe(true)
    expect(isSensitiveField(el('<textarea aria-label="mnemonic"></textarea>'))).toBe(true)
  })

  it('treats a form-less SPA login (role=form / modal) with a password input as sensitive', () => {
    const widget = el(
      '<div role="form"><div contenteditable="true" aria-label="email"></div><input type="password" /></div>',
    )
    const email = widget.querySelector('[contenteditable]') as Element
    expect(isSensitiveField(email)).toBe(true)

    const modal = el(
      '<div aria-modal="true"><textarea></textarea><input type="password" /></div>',
    )
    const ta = modal.querySelector('textarea') as Element
    expect(isSensitiveField(ta)).toBe(true)
  })

  it('does NOT flag an ordinary prompt textarea', () => {
    expect(isSensitiveField(el('<textarea placeholder="Message ChatGPT"></textarea>'))).toBe(false)
  })
})

describe('looksLikeAuthPath', () => {
  it('matches common auth paths', () => {
    for (const p of ['/login', '/sign_in', '/signin', '/sign-up', '/auth/callback', '/account/login', '/oauth/authorize', '/password/reset', '/verify']) {
      expect(looksLikeAuthPath(p)).toBe(true)
    }
  })
  it('does not match normal chat paths', () => {
    for (const p of ['/', '/c/abc123', '/chat', '/app', '/g/gpt-4']) {
      expect(looksLikeAuthPath(p)).toBe(false)
    }
  })
})

describe('safeCaptureUrl', () => {
  it('strips query and hash (where tokens live)', () => {
    expect(safeCaptureUrl('https://chat.deepseek.com/sign_in?token=abc#access_token=xyz')).toBe(
      'https://chat.deepseek.com/sign_in',
    )
    expect(safeCaptureUrl('https://claude.ai/new?code=secret')).toBe('https://claude.ai/new')
  })
  it('keeps origin + pathname for clean URLs', () => {
    expect(safeCaptureUrl('https://chatgpt.com/c/123')).toBe('https://chatgpt.com/c/123')
  })
  it('defensively strips even an unparseable string', () => {
    expect(safeCaptureUrl('not a url?token=secret')).toBe('not a url')
  })
})

describe('withinComposer', () => {
  it('allows anything when the composer is unknown (null)', () => {
    expect(withinComposer(el('<textarea></textarea>'), null)).toBe(true)
  })

  it('matches the composer itself and its descendants', () => {
    const composer = el('<div contenteditable="true"><span id="inner">x</span></div>')
    const inner = composer.querySelector('#inner') as Element
    expect(withinComposer(composer, composer)).toBe(true)
    expect(withinComposer(inner, composer)).toBe(true)
  })

  it('rejects an unrelated editable elsewhere on the page', () => {
    const composer = el('<textarea id="a"></textarea>')
    const other = el('<textarea id="b"></textarea>')
    expect(withinComposer(other, composer)).toBe(false)
  })
})
