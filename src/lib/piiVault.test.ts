import { describe, it, expect } from 'vitest'
import { vaultValuesForPlaceholders } from './piiVault'

describe('vaultValuesForPlaceholders', () => {
  it('maps tokens to blank names for fill-in', () => {
    expect(
      vaultValuesForPlaceholders({ '[email_1]': 'a@b.com', '[phone_1]': '415-555-0132' }, [
        '[email_1]',
        '[phone_1]',
        '[card_1]',
      ]),
    ).toEqual({ email_1: 'a@b.com', phone_1: '415-555-0132' })
  })
})
