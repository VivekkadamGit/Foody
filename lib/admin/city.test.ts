import { describe, it, expect } from 'vitest'
import { pickCity, slugify, validateCity } from './city'

describe('pickCity', () => {
  it('honours a valid requested slug', () => expect(pickCity(['ahmedabad', 'surat'], 'ahmedabad')).toBe('ahmedabad'))
  it('falls back to the priority city, then the first', () => {
    expect(pickCity(['ahmedabad', 'surat'], 'nope')).toBe('surat')
    expect(pickCity(['pune'], undefined)).toBe('pune')
  })
  it('returns null with no cities', () => expect(pickCity([], undefined)).toBeNull())
})

describe('slugify', () => {
  it.each([
    ['Surat', 'surat'],
    ['  New Delhi ', 'new-delhi'],
    ['Navi Mumbai (West)', 'navi-mumbai-west'],
    ['Pune--Camp', 'pune-camp'],
    ['Bengaluru!', 'bengaluru'],
  ])('%s -> %s', (name, slug) => expect(slugify(name)).toBe(slug))
})

describe('validateCity', () => {
  it('trims and accepts valid input', () => {
    expect(validateCity({ name: ' Indore ', slug: 'indore', status: 'coming_soon' })).toEqual({ name: 'Indore', slug: 'indore', status: 'coming_soon' })
  })
  it.each([
    [{ name: ' ', slug: 'x', status: 'active' }, 'City name is required'],
    [{ name: 'X', slug: 'Bad Slug', status: 'active' }, 'Slug can only use lowercase letters, numbers and single dashes'],
    [{ name: 'X', slug: 'a--b', status: 'active' }, 'Slug can only use lowercase letters, numbers and single dashes'],
    [{ name: 'X', slug: 'x', status: 'live' }, 'Unknown status: live'],
  ])('rejects %j', (input, msg) => expect(() => validateCity(input)).toThrow(msg))
})
