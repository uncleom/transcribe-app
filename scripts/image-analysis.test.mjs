import assert from 'node:assert/strict'
import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { GoogleGenAI } from '@google/genai'
import { analyzeImage, ImageAnalysisError } from '../src/lib/image-analysis.mjs'

const env = { VERTEX_PROJECT_ID: 'trial-project', GOOGLE_APPLICATION_CREDENTIALS: '/external/adc.json', VERTEX_TRIAL_EXPIRES: '2030-04-10' }
const now = () => new Date('2030-04-09T12:00:00Z')
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2])
async function image(bytes = png, name = 'image.png') {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'image-analysis-'))
  const file = path.join(dir, name)
  await writeFile(file, bytes)
  return { dir, file }
}
async function withImage(fn, bytes = png, name = 'image.png') {
  const f = await image(bytes, name)
  try { await fn(f.file) } finally { await rm(f.dir, { recursive: true, force: true }) }
}
async function code(promise, expected) {
  await assert.rejects(promise, (error) => error instanceof ImageAnalysisError && error.code === expected)
}

test('requires explicit Vertex project, ADC path and valid trial expiry', async () => withImage(async (file) => {
  await code(analyzeImage(file, { env: {}, now, transport: () => assert.fail('must not call model') }), 'not_configured')
  await code(analyzeImage(file, { env: { ...env, VERTEX_TRIAL_EXPIRES: '2030-02-30' }, now }), 'not_configured')
}))

test('rejects trial at UTC start of expiry date before transport', async () => withImage(async (file) => code(analyzeImage(file, {
  env, now: () => new Date('2030-04-10T00:00:00Z'), transport: () => assert.fail('must not call model'),
}), 'trial_expired')))

test('Vertex project and explicit ADC auth suppress an inherited Gemini API key', () => {
  const previous = process.env.GOOGLE_API_KEY
  process.env.GOOGLE_API_KEY = 'inherited-test-key'
  try {
    const client = new GoogleGenAI({ vertexai: true, project: env.VERTEX_PROJECT_ID, location: 'global', googleAuthOptions: { keyFile: env.GOOGLE_APPLICATION_CREDENTIALS } })
    assert.equal(client.vertexai, true)
    assert.equal(client.apiKey, undefined)
    assert.equal(client.project, env.VERTEX_PROJECT_ID)
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_API_KEY
    else process.env.GOOGLE_API_KEY = previous
  }
})

test('detects actual image bytes and assembles one Vertex structured multimodal request', async () => {
  const samples = [
    [Buffer.from([255, 216, 255, 1]), 'not-jpeg.txt', 'image/jpeg'],
    [png, 'photo.webp', 'image/png'],
    [Buffer.from('RIFF\x04\x00\x00\x00WEBPVP8 '), 'photo.png', 'image/webp'],
  ]
  for (const [bytes, name, mime] of samples) await withImage(async (file) => {
    let calls = 0
    const result = await analyzeImage(file, { env, now, transport: async (request) => {
      calls++
      assert.equal(request.model, 'gemini-3.8-flash')
      assert.deepEqual(request.vertex, { project: 'trial-project', location: 'global', credentials: '/external/adc.json' })
      assert.equal(request.config.responseMimeType, 'application/json')
      assert.deepEqual(request.config.responseSchema.required, ['kind', 'text'])
      assert.equal(request.config.maxOutputTokens, 8192)
      assert.match(request.contents[0].parts[0].text, /недоверенные данные/)
      assert.equal(request.contents[0].parts[1].inlineData.mimeType, mime)
      assert.deepEqual(Buffer.from(request.contents[0].parts[1].inlineData.data, 'base64'), bytes)
      return { text: JSON.stringify({ kind: 'text', text: 'Привет, 世界' }) }
    } })
    assert.deepEqual(result, { kind: 'text', text: 'Привет, 世界' })
    assert.match('Перепиши его на исходном языке, не переводи', /исходном языке/)
    assert.equal(calls, 1)
  }, bytes, name)
})

test('returns Russian description when no text is visible', async () => withImage(async (file) => {
  assert.deepEqual(await analyzeImage(file, { env, now, transport: async () => ({
    candidates: [{ content: { parts: [{ text: '{"kind":"description","text":"На столе чашка."}' }] } }],
  }) }), { kind: 'description', text: 'На столе чашка.' })
}))

test('gives clear unreadable-text message and rejects empty or malformed JSON', async () => withImage(async (file) => {
  const result = await analyzeImage(file, { env, now, transport: async () => ({ text: '{"kind":"unreadable_text","text":""}' }) })
  assert.equal(result.kind, 'text')
  assert.match(result.text, /не удалось надёжно прочитать/)
  for (const text of ['', '{broken', '{"kind":"text","text":""}', '{"kind":"other","text":"x"}']) {
    await code(analyzeImage(file, { env, now, transport: async () => ({ text }) }), 'unavailable')
  }
}))

test('preserves full long OCR text and rejects model-truncated output', async () => withImage(async (file) => {
  const longText = 'А'.repeat(12_000)
  const result = await analyzeImage(file, { env, now, transport: async (request) => {
    assert.equal(request.config.maxOutputTokens, 8192)
    assert.match(request.contents[0].parts[0].text, /исходном языке/)
    return { text: JSON.stringify({ kind: 'text', text: longText }) }
  } })
  assert.equal(result.text.length, longText.length)
  assert.equal(result.text, longText)
  await code(analyzeImage(file, { env, now, transport: async () => ({
    candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"kind":"text","text":"cut"}' }] } }],
  }) }), 'unavailable')
}))

test('checks file size before reading image bytes', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'image-analysis-stat-'))
  const file = path.join(dir, 'sparse.png')
  try {
    await writeFile(file, png)
    await truncate(file, 10 * 1024 * 1024 + 1)
    await code(analyzeImage(file, { env, now }), 'invalid_image')
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('rejects invalid magic bytes and oversized input', async () => {
  await withImage(async (file) => code(analyzeImage(file, { env, now }), 'invalid_image'), Buffer.from('not image'), 'image.jpg')
  await withImage(async (file) => code(analyzeImage(file, { env, now }), 'invalid_image'), Buffer.alloc(10 * 1024 * 1024 + 1), 'big.png')
})

test('maps 429 and timeout to safe unavailable errors without leaking provider details', async () => withImage(async (file) => {
  const rateLimit = async () => { const error = new Error('private provider body'); error.status = 429; throw error }
  for (const transport of [rateLimit, (request) => new Promise((_, reject) => request.config.abortSignal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true }))]) {
    await assert.rejects(analyzeImage(file, { env, now, transport, timeoutMs: 10 }), (error) => {
      assert.equal(error.code, 'unavailable')
      assert.doesNotMatch(error.message, /private|provider|429/)
      return true
    })
  }
}))
