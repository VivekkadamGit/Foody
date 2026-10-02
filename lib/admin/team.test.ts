import { describe, it, expect } from 'vitest'
import { canDemote, defaultTesterName, isValidEmail, memberState } from './team'

describe('defaultTesterName', () => {
  it.each([
    ['vivek.adam@gmail.com', 'Vivek Adam'],
    ['priya_s-k@x.in', 'Priya S K'],
    ['RAHUL@x.com', 'Rahul'],
    ['@x.com', 'Tester'],
  ])('%s -> %s', (email, name) => expect(defaultTesterName(email)).toBe(name))
})

describe('isValidEmail', () => {
  it('accepts normal addresses and rejects junk', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail(' a@b.co ')).toBe(true)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('nope')).toBe(false)
  })
})

describe('memberState', () => {
  const now = new Date('2026-10-02T00:00:00Z')
  it('removed when banned into the future', () => {
    expect(memberState({ last_sign_in_at: '2026-01-01', banned_until: '2126-01-01T00:00:00Z' }, now)).toBe('removed')
  })
  it('invited when never signed in', () => {
    expect(memberState({ last_sign_in_at: null }, now)).toBe('invited')
  })
  it('active otherwise, including an expired ban', () => {
    expect(memberState({ last_sign_in_at: '2026-09-01', banned_until: '2026-01-01T00:00:00Z' }, now)).toBe('active')
  })
})

describe('canDemote', () => {
  it('never leaves zero admins', () => {
    expect(canDemote(1)).toBe(false)
    expect(canDemote(2)).toBe(true)
  })
})
