import { describe, expect, it } from 'vitest'
import { isStreetLikePlace, looksLikeCityOrCountry, nerEntitiesToHits, type NerEntity } from './nerPii'

describe('isStreetLikePlace', () => {
  it('accepts street lines with a number and type', () => {
    expect(isStreetLikePlace('12 Oak Street')).toBe(true)
    expect(isStreetLikePlace('100 Main Rd')).toBe(true)
    expect(isStreetLikePlace('4B Lincoln Ave')).toBe(true)
  })

  it('rejects bare cities and countries', () => {
    expect(isStreetLikePlace('London')).toBe(false)
    expect(isStreetLikePlace('New York')).toBe(false)
    expect(isStreetLikePlace('France')).toBe(false)
  })
})

describe('looksLikeCityOrCountry', () => {
  it('accepts short geo names', () => {
    expect(looksLikeCityOrCountry('London')).toBe(true)
    expect(looksLikeCityOrCountry('New York')).toBe(true)
    expect(looksLikeCityOrCountry('France')).toBe(true)
  })

  it('rejects streets', () => {
    expect(looksLikeCityOrCountry('12 Oak Street')).toBe(false)
  })
})

describe('nerEntitiesToHits', () => {
  const enabled = { person: true, place: true, city: true }

  it('keeps high-confidence PERSON spans', () => {
    const text = 'Ask Sarah about the lease'
    const entities: NerEntity[] = [
      { entity_group: 'PER', score: 0.92, word: 'Sarah', start: 4, end: 9 },
    ]
    expect(nerEntitiesToHits(text, entities, enabled)).toEqual([
      { start: 4, end: 9, kind: 'person', value: 'Sarah' },
    ])
  })

  it('drops low-confidence and disabled kinds', () => {
    const text = 'Ask Sarah about the lease'
    const entities: NerEntity[] = [
      { entity_group: 'PER', score: 0.5, word: 'Sarah', start: 4, end: 9 },
    ]
    expect(nerEntitiesToHits(text, entities, enabled)).toEqual([])
    expect(
      nerEntitiesToHits(text, [{ ...entities[0], score: 0.9 }], {
        person: false,
        place: true,
        city: true,
      }),
    ).toEqual([])
  })

  it('splits street LOC vs city LOC', () => {
    const text = 'Meet at 12 Oak St then fly to London'
    const entities: NerEntity[] = [
      { entity_group: 'LOC', score: 0.95, word: '12 Oak St', start: 8, end: 17 },
      { entity_group: 'LOC', score: 0.99, word: 'London', start: 30, end: 36 },
    ]
    expect(nerEntitiesToHits(text, entities, enabled)).toEqual([
      { start: 8, end: 17, kind: 'place', value: '12 Oak St' },
      { start: 30, end: 36, kind: 'city', value: 'London' },
    ])
    expect(
      nerEntitiesToHits(text, entities, { person: true, place: true, city: false }),
    ).toEqual([{ start: 8, end: 17, kind: 'place', value: '12 Oak St' }])
  })

  it('ignores ORG and entities without offsets', () => {
    const text = 'Chase the dog near Acme'
    const entities: NerEntity[] = [
      { entity_group: 'ORG', score: 0.99, word: 'Acme', start: 19, end: 23 },
      { entity_group: 'PER', score: 0.99, word: 'Chase' },
    ]
    expect(nerEntitiesToHits(text, entities, enabled)).toEqual([])
  })
})
