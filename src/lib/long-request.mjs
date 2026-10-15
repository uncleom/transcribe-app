import { request } from 'undici'

/** Explicit HTTP deadlines: AbortSignal alone does not replace the 5-minute headers timeout. */
export async function postLongJson(url, payload, timeoutMs, headers = {}) {
  const { statusCode, body } = await request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
    signal: AbortSignal.timeout(timeoutMs),
  })
  return { statusCode, data: await body.json() }
}
