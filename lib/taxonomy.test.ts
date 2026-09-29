import { describe, it, expect } from 'vitest'
import { stripFiller } from '@/lib/taxonomy'

describe('stripFiller', () => {
  it('removes filler words', () => {
    expect(stripFiller('best biryani in town')).toBe('biryani')
  })
  it('collapses whitespace and lowercases', () => {
    expect(stripFiller('  Top   brwnie  ')).toBe('brwnie')
  })
  it('returns empty when only filler is left', () => {
    expect(stripFiller('best food in town')).toBe('')
    expect(stripFiller('')).toBe('')
  })
})
