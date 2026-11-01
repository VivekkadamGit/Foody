/** Load balancer health check: answers without touching Supabase or Gemini. */
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ ok: true })
}
