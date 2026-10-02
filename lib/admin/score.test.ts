import { describe, it, expect } from 'vitest'
import { parseScore } from './score'

describe('parseScore', () => {
  it('blank is null', () => {
    expect(parseScore('')).toBeNull()
    expect(parseScore('   ')).toBeNull()
  })
  it('parses and rounds to one decimal', () => {
    expect(parseScore('8')).toBe(8)
    expect(parseScore('8.46')).toBe(8.5)
    expect(parseScore('0')).toBe(0)
    expect(parseScore('10')).toBe(10)
  })
  it.each(['-1', '10.1', 'abc', '1e3'])('rejects %s', (raw) => {
    expect(() => parseScore(raw)).toThrow('Score must be between 0 and 10')
  })
})
