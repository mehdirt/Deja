import { describe, it, expect } from 'vitest'
import {
  redactPii,
  hasPii,
  ssnValid,
  ibanValid,
  assignPlaceholders,
  nextIndexForKind,
  mergeHits,
  redactFromHits,
} from './pii'

describe('redactPii', () => {
  it('redacts email addresses with numbered placeholders', () => {
    const r = redactPii('email me at john.doe@acme.co please')
    expect(r.text).toBe('email me at [email_1] please')
    expect(r.counts.email).toBe(1)
    expect(r.mappings['[email_1]']).toBe('john.doe@acme.co')
  })

  it('reuses the same number for the same value in one prompt', () => {
    const r = redactPii('a@b.com then again a@b.com and c@d.com')
    expect(r.text).toBe('[email_1] then again [email_1] and [email_2]')
    expect(r.counts.email).toBe(3)
    expect(Object.keys(r.mappings)).toEqual(['[email_1]', '[email_2]'])
  })

  it('reuses vault numbers across prompts', () => {
    const r = redactPii('write to a@b.com', undefined, {
      existingVault: { '[email_1]': 'a@b.com' },
    })
    expect(r.text).toBe('write to [email_1]')
    expect(r.mappings['[email_1]']).toBe('a@b.com')
  })

  it('redacts a Luhn-valid card, leaves a non-card number alone', () => {
    expect(redactPii('pay with 4242 4242 4242 4242 now').text).toBe('pay with [card_1] now')
    expect(redactPii('order 1111 1111 1111 1111').text).toBe('order 1111 1111 1111 1111')
  })

  it('redacts valid SSNs and phones; rejects reserved SSN shapes', () => {
    expect(redactPii('ssn 123-45-6789').text).toBe('ssn [ssn_1]')
    expect(redactPii('ssn 000-12-3456').text).toBe('ssn 000-12-3456')
    expect(redactPii('ssn 666-12-3456').text).toBe('ssn 666-12-3456')
    expect(redactPii('host 192.168.1.1').text).toBe('host [ip_1]')
    expect(redactPii('call 415-555-0132').text).toBe('call [phone_1]')
    expect(redactPii('call +1 (415) 555-0132').text).toBe('call [phone_1]')
  })

  it('redacts IBANs only when check digits pass', () => {
    // Well-known valid IBAN (GB82 WEST 1234 5698 7654 32)
    expect(redactPii('pay GB82 WEST 1234 5698 7654 32').text).toBe('pay [iban_1]')
    expect(redactPii('pay GB00 WEST 1234 5698 7654 32').text).toBe(
      'pay GB00 WEST 1234 5698 7654 32',
    )
  })

  it('redacts common secrets and tokens', () => {
    expect(redactPii('key sk-ABCDEFGHIJKLMNOPQRSTUVWX').text).toBe('key [secret_1]')
    expect(redactPii('token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345').text).toBe(
      'token [secret_1]',
    )
    expect(redactPii('stripe sk_live_ABCDEFGHIJKLMNOP').text).toBe('stripe [secret_1]')
    expect(redactPii('jwt eyJhbGc.eyJzdWI.sIgnAtUrE').text).toBe('jwt [secret_1]')
  })

  it('leaves ordinary prompts untouched', () => {
    const t = 'write a bash script that backs up my postgres db every night'
    const r = redactPii(t)
    expect(r.text).toBe(t)
    expect(r.total).toBe(0)
    expect(r.mappings).toEqual({})
  })

  it('counts multiple items and reports a total', () => {
    const r = redactPii('reach me at a@b.com or 415-555-0132')
    expect(r.counts.email).toBe(1)
    expect(r.counts.phone).toBe(1)
    expect(r.total).toBe(2)
  })

  it('honors per-category toggles', () => {
    const r = redactPii('a@b.com and 415-555-0132', {
      secret: true,
      email: false,
      card: true,
      iban: true,
      ssn: true,
      phone: true,
      ip: true,
      person: false,
      place: false,
      city: false,
    })
    expect(r.text).toBe('a@b.com and [phone_1]')
    expect(r.counts.email).toBe(0)
  })

  it('mergeHits adds non-overlapping extra spans', () => {
    const base = [{ start: 0, end: 7, kind: 'email' as const, value: 'a@b.com' }]
    const extra = [{ start: 12, end: 17, kind: 'person' as const, value: 'Sarah' }]
    const merged = mergeHits(base, extra)
    expect(merged).toHaveLength(2)
    const r = redactFromHits('a@b.com ask Sarah', merged)
    expect(r.text).toBe('[email_1] ask [person_1]')
  })

  it('hasPii reflects detection', () => {
    expect(hasPii('nothing here')).toBe(false)
    expect(hasPii('a@b.com')).toBe(true)
  })
})

describe('validators', () => {
  it('ssnValid rejects reserved areas', () => {
    expect(ssnValid('123-45-6789')).toBe(true)
    expect(ssnValid('000-45-6789')).toBe(false)
    expect(ssnValid('666-45-6789')).toBe(false)
    expect(ssnValid('900-45-6789')).toBe(false)
    expect(ssnValid('123-00-6789')).toBe(false)
  })

  it('ibanValid checks mod-97', () => {
    expect(ibanValid('GB82WEST12345698765432')).toBe(true)
    expect(ibanValid('GB00WEST12345698765432')).toBe(false)
  })
})

describe('assignPlaceholders', () => {
  it('continues numbering after vault', () => {
    expect(nextIndexForKind('email', ['[email_1]', '[email_3]'])).toBe(4)
    const { tokens } = assignPlaceholders(
      [
        { kind: 'email', value: 'new@x.com' },
        { kind: 'email', value: 'a@b.com' },
      ],
      { '[email_1]': 'a@b.com' },
    )
    expect(tokens).toEqual(['[email_2]', '[email_1]'])
  })
})
