import { describe, it, expect } from 'vitest'
import { loginErrorMessage, loginNotice, resetRequestError, authLinkType } from './authMessages'

describe('loginErrorMessage', () => {
  it('explains wrong credentials and the Directus mix-up', () => {
    const m = loginErrorMessage({ message: 'Invalid login credentials' })
    expect(m).toContain("don't match a Chakh admin account")
    expect(m).toContain('Directus')
  })
  it('explains unconfirmed accounts', () => {
    expect(loginErrorMessage({ message: 'Email not confirmed' })).toContain("hasn't been confirmed")
  })
  it('explains network failures', () => {
    expect(loginErrorMessage({ message: 'Failed to fetch' })).toContain("Can't reach the login server")
  })
  it('falls back to the raw message, or a generic one', () => {
    expect(loginErrorMessage({ message: 'Rate limit exceeded' })).toBe('Rate limit exceeded')
    expect(loginErrorMessage(null)).toBe('Something went wrong. Please try again.')
  })
})

describe('loginNotice', () => {
  it('maps query params to notices', () => {
    expect(loginNotice({ reset: 'sent' })).toEqual({ tone: 'info', text: 'Check your inbox for a reset link.' })
    const linkNotice = loginNotice({ error: 'link' })
    expect(linkNotice?.tone).toBe('error')
    expect(linkNotice?.text).toContain('different browser')
    expect(loginNotice({})).toBeNull()
  })
})

describe('resetRequestError', () => {
  it('is null with no error or an unknown account', () => {
    expect(resetRequestError(null)).toBeNull()
    expect(resetRequestError({ message: 'User not found' })).toBeNull()
  })
  it('explains rate limits', () => {
    expect(resetRequestError({ message: 'x', status: 429 })).toContain('Too many')
    expect(resetRequestError({ message: 'For security purposes, you can only request this after 20 seconds' })).toContain('Too many')
  })
  it('explains network failures', () => {
    expect(resetRequestError({ message: 'Failed to fetch' })).toContain("Can't reach")
  })
  it('surfaces other failures with the raw message', () => {
    const m = resetRequestError({ message: 'Error sending recovery email' })
    expect(m).toContain('Error sending recovery email')
    expect(m).toContain('Supabase')
  })
})

describe('authLinkType', () => {
  it('reads the type from an auth redirect hash', () => {
    expect(authLinkType('#access_token=a&refresh_token=b&type=invite')).toBe('invite')
    expect(authLinkType('#type=recovery&access_token=a')).toBe('recovery')
    expect(authLinkType('')).toBeNull()
    expect(authLinkType('#section-2')).toBeNull()
    expect(authLinkType('#type=weird')).toBeNull()
  })
})
