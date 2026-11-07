/**
 * The address visitors reached us on. Don't use request.url for this: behind CloudFront the
 * standalone server builds it from its own hostname (http://ip-10-…:3000).
 */
export function publicOrigin(headers: Headers): string {
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost:3000'
  const proto =
    headers.get('cloudfront-forwarded-proto') ??
    headers.get('x-forwarded-proto') ??
    (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
