import { describe, it, expect } from 'vitest'
import { publicOrigin } from './publicOrigin'

const h = (o: Record<string, string>) => new Headers(o)

describe('publicOrigin', () => {
  it('uses the forwarded host and proto over the Host the server sees', () => {
    expect(publicOrigin(h({ host: 'chakh.abc.cs.amazonlightsail.com', 'x-forwarded-host': 'chakh.in', 'x-forwarded-proto': 'https' })))
      .toBe('https://chakh.in')
  })

  it('prefers CloudFront\'s proto when a load balancer in between reports http', () => {
    expect(publicOrigin(h({ host: 'chakh.in', 'x-forwarded-proto': 'http', 'cloudfront-forwarded-proto': 'https' })))
      .toBe('https://chakh.in')
  })

  it('falls back to Host, assuming https outside localhost', () => {
    expect(publicOrigin(h({ host: 'chakh.in' }))).toBe('https://chakh.in')
  })

  it('is http on localhost', () => {
    expect(publicOrigin(h({ host: 'localhost:3000' }))).toBe('http://localhost:3000')
  })

  it('uses localhost when there are no headers at all', () => {
    expect(publicOrigin(h({}))).toBe('http://localhost:3000')
  })
})
