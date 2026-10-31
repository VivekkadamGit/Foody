import { GoogleGenAI } from '@google/genai'

/**
 * One place for the model id, so /suggest and AI search never drift apart.
 * Flash-Lite: on our key it answers a full city list in ~5s; 3.6/3.8 Flash took 20s+ or hung.
 */
export const GEMINI_MODEL = 'gemini-3.5-flash-lite'

const DEFAULT_TIMEOUT_MS = 10_000

/** AI search runs only with a key, and can be switched off with AI_SEARCH=off. */
export function aiSearchEnabled(): boolean {
  return process.env.AI_SEARCH !== 'off' && !!process.env.GEMINI_API_KEY
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    p.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) }
    )
  })
}

/** Asks Gemini for JSON and returns it parsed. Throws on network, parse or timeout. */
export async function generateJson(prompt: string, opts: { timeoutMs?: number } = {}): Promise<unknown> {
  const ms = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  // generateContent hangs or 404s for current models on this key; the Interactions API answers.
  const res = await withTimeout(
    ai.interactions.create(
      {
        model: GEMINI_MODEL,
        input: prompt,
        response_format: { type: 'text', mime_type: 'application/json' },
        generation_config: { thinking_level: 'low' },
      },
      { timeout: ms }
    ),
    ms
  )
  return JSON.parse(res.output_text ?? '')
}
