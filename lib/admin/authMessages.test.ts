import { describe, it, expect } from 'vitest'
import { loginErrorMessage, loginNotice } from './authMessages'

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
    expect(loginNotice({ error: 'link' })?.tone).toBe('error')
    expect(loginNotice({})).toBeNull()
  })
})
