/** "" → null (not scored). Otherwise 0–10, rounded to one decimal. */
export function parseScore(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error('Score must be between 0 and 10')
  const n = Math.round(Number(t) * 10) / 10
  if (n < 0 || n > 10) throw new Error('Score must be between 0 and 10')
  return n
}
