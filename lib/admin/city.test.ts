import { describe, it, expect } from 'vitest'
import { pickCity } from './city'

describe('pickCity', () => {
  it('honours a valid requested slug', () => expect(pickCity(['ahmedabad', 'surat'], 'ahmedabad')).toBe('ahmedabad'))
  it('falls back to the priority city, then the first', () => {
    expect(pickCity(['ahmedabad', 'surat'], 'nope')).toBe('surat')
    expect(pickCity(['pune'], undefined)).toBe('pune')
  })
  it('returns null with no cities', () => expect(pickCity([], undefined)).toBeNull())
})
