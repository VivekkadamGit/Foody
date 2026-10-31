import { describe, it, expect, vi, afterEach } from 'vitest'
import { aiSearchEnabled, withTimeout } from './gemini'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('withTimeout', () => {
  it('resolves when the promise wins', async () => {
    await expect(withTimeout(Promise.resolve(1), 50)).resolves.toBe(1)
  })

  it('rejects with "timeout" when the promise is too slow', async () => {
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow('timeout')
  })
})

describe('aiSearchEnabled', () => {
  it('is false when AI_SEARCH=off', () => {
    vi.stubEnv('GEMINI_API_KEY', 'k')
    vi.stubEnv('AI_SEARCH', 'off')
    expect(aiSearchEnabled()).toBe(false)
  })

  it('is false without GEMINI_API_KEY', () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('AI_SEARCH', '')
    expect(aiSearchEnabled()).toBe(false)
  })

  it('is true with a key and no flag', () => {
    vi.stubEnv('GEMINI_API_KEY', 'k')
    vi.stubEnv('AI_SEARCH', '')
    expect(aiSearchEnabled()).toBe(true)
  })
})
