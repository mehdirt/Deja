import { describe, it, expect } from 'vitest'
import { redactPii, hasPii } from './pii'

describe('redactPii', () => {
  it('redacts email addresses', () => {
    const r = redactPii('email me at john.doe@acme.co please')
    expect(r.text).toBe('email me at [email] please')
    expect(r.counts.email).toBe(1)
  })

  it('redacts a Luhn-valid card, leaves a non-card number alone', () => {
    expect(redactPii('pay with 4242 4242 4242 4242 now').text).toBe('pay with [card] now')
    // 16 digits but fails the Luhn check → not a card, left intact
    expect(redactPii('order 1111 1111 1111 1111').text).toBe('order 1111 1111 1111 1111')
  })

  it('redacts SSNs, IPs, and phone numbers', () => {
    expect(redactPii('ssn 123-45-6789').text).toBe('ssn [ssn]')
    expect(redactPii('host 192.168.1.1').text).toBe('host [ip]')
    expect(redactPii('call 415-555-0132').text).toBe('call [phone]')
    expect(redactPii('call +1 (415) 555-0132').text).toBe('call [phone]')
  })

  it('redacts common secrets and tokens', () => {
    expect(redactPii('key sk-ABCDEFGHIJKLMNOPQRSTUVWX').text).toBe('key [secret]')
    expect(redactPii('token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345').text).toBe('token [secret]')
    expect(redactPii('jwt eyJhbGc.eyJzdWI.sIgnAtUrE').text).toBe('jwt [secret]')
  })

  it('leaves ordinary prompts untouched', () => {
    const t = 'write a bash script that backs up my postgres db every night'
    const r = redactPii(t)
    expect(r.text).toBe(t)
    expect(r.total).toBe(0)
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
    })
    expect(r.text).toBe('a@b.com and [phone]')
    expect(r.counts.email).toBe(0)
  })

  it('hasPii reflects detection', () => {
    expect(hasPii('nothing here')).toBe(false)
    expect(hasPii('a@b.com')).toBe(true)
  })
})
