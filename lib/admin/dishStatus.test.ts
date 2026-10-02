import { describe, it, expect } from 'vitest'
import { dishStatus } from './dishStatus'

const d = (o: Partial<{ score: number | null; diet: string | null; category: string | null; deleted_at: string | null }>) =>
  ({ score: null, diet: 'veg', category: 'baked', deleted_at: null, ...o })

describe('dishStatus', () => {
  it('deleted wins over everything', () => expect(dishStatus(d({ deleted_at: '2026-01-01', diet: null }))).toBe('deleted'))
  it('missing diet or category is needs_tags, even when scored', () => {
    expect(dishStatus(d({ diet: null, score: 8 }))).toBe('needs_tags')
    expect(dishStatus(d({ category: null }))).toBe('needs_tags')
  })
  it('tagged but unscored is needs_score', () => expect(dishStatus(d({}))).toBe('needs_score'))
  it('tagged and scored is scored (0 counts as a score)', () => expect(dishStatus(d({ score: 0 }))).toBe('scored'))
})
