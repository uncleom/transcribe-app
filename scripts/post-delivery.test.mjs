import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { sendPostMedia, sendPostText, splitTelegramText } from '../src/lib/post-delivery.mjs'
import { deliverPost } from '../src/lib/process-post.mjs'

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'post-delivery-'))
  const outgoing = path.join(root, 'outgoing')
  await mkdir(outgoing)
  const calls = []
  let rejectGroup = false
  let rejectSingles = false
  let rejectText = false
  let dropGroup = false
  const responseQueues = new Map()
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const method = req.url.slice(1).split('/').at(-1)
    calls.push({ method, payload: JSON.parse(body) })
    if (method === 'sendMediaGroup' && dropGroup) { req.socket.destroy(); return }
    const queued = responseQueues.get(method)?.shift()
    const rejected = method === 'sendMediaGroup' ? rejectGroup : method === 'sendMessage' ? rejectText : rejectSingles
    res.statusCode = queued?.statusCode ?? 200
    if (queued?.retryAfter != null) res.setHeader('retry-after', String(queued.retryAfter))
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(queued?.body ?? (rejected ? { ok: false, description: 'sensitive token text' } : { ok: true, result: {} })))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => { server.close(); await rm(root, { recursive: true, force: true }) })
  return { root, outgoing, calls, api: `http://127.0.0.1:${server.address().port}/bot-secret`, rejectGroup: value => { rejectGroup = value }, rejectSingles: value => { rejectSingles = value }, rejectText: value => { rejectText = value }, dropGroup: value => { dropGroup = value }, queue: (method, responses) => responseQueues.set(method, [...responses]) }
}

async function createItems(f, count) {
  const videoPath = path.join(f.outgoing, 'clip.mp4')
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=64x48:d=1', '-c:v', 'mpeg4', '-y', videoPath])
  const items = []
  for (let index = 1; index <= count; index++) {
    const type = index % 2 ? 'photo' : 'video'
    const filePath = type === 'video' ? videoPath : path.join(f.outgoing, `photo-${index}.jpg`)
    if (type === 'photo') await writeFile(filePath, 'jpeg')
    items.push({ index, type, filePath })
  }
  return items
}

test('splits Unicode text losslessly within UTF-16 limit and avoids splitting surrogate pairs', () => {
  const text = ('🙂a \n').repeat(1400)
  const chunks = splitTelegramText(text, 4000)
  assert.equal(chunks.join(''), text)
  assert.ok(chunks.every(chunk => chunk.length <= 4000))
  assert.ok(chunks.every(chunk => !/[\uD800-\uDBFF]$/.test(chunk) && !/^[\uDC00-\uDFFF]/.test(chunk)))
})

test('sendPostText posts chunks as plain text and rejects Telegram errors safely', async t => {
  const f = await fixture(t)
  const text = '🙂'.repeat(3000)
  await sendPostText(f.api, 'chat', text)
  assert.deepEqual(f.calls.map(call => call.method), ['sendMessage', 'sendMessage'])
  assert.equal(f.calls.map(call => call.payload.text).join(''), text)
  f.calls.length = 0
  f.rejectText(true)
  await assert.rejects(sendPostText(f.api, 'chat', 'plain'), /Telegram text send failed/)
  assert.ok(!JSON.stringify(f.calls).includes('sensitive token'))
})

test('16 and 21 ordered mixed items use <=10 albums and a final singleton method', async t => {
  const f = await fixture(t)
  const items = await createItems(f, 21)
  assert.deepEqual(await sendPostMedia(f.api, 'chat', items.slice(0, 16), f.outgoing), { failed: [] })
  assert.deepEqual(f.calls.map(call => call.method), ['sendMediaGroup', 'sendMediaGroup'])
  assert.deepEqual(f.calls[0].payload.media.map(item => path.basename(new URL(item.media).pathname)), items.slice(0, 10).map(item => path.basename(item.filePath)))
  assert.ok(f.calls[0].payload.media.every(item => item.type === 'photo' || item.type === 'video'))
  const video = f.calls[0].payload.media.find(item => item.type === 'video')
  assert.equal(video.width, 64)
  assert.equal(video.height, 48)
  assert.ok(video.duration >= 1)
  assert.equal(video.supports_streaming, true)
  f.calls.length = 0
  await sendPostMedia(f.api, 'chat', items, f.outgoing)
  assert.deepEqual(f.calls.map(call => call.method), ['sendMediaGroup', 'sendMediaGroup', 'sendPhoto'])
})

test('invalid paths and null oversized entries report original indices without shifting others', async t => {
  const f = await fixture(t)
  const items = await createItems(f, 1)
  const outside = path.join(f.root, 'outside.jpg')
  await writeFile(outside, 'jpg')
  const link = path.join(f.outgoing, 'escape.jpg')
  await symlink(outside, link)
  const result = await sendPostMedia(f.api, 'chat', [
    { index: 3, type: 'video', filePath: null, videoTooBig: true },
    { index: 4, type: 'photo', filePath: path.join(f.outgoing, '..', 'outside.jpg') },
    { index: 9, type: 'photo', filePath: link },
    ...items,
  ], f.outgoing)
  assert.deepEqual(result, { failed: [3, 4, 9] })
  assert.deepEqual(f.calls.map(call => call.method), ['sendPhoto'])
})

test('definite album rejection falls back to singles; single rejections are reported without error details', async t => {
  const f = await fixture(t)
  const items = await createItems(f, 2)
  f.rejectGroup(true)
  f.rejectSingles(true)
  assert.deepEqual(await sendPostMedia(f.api, 'chat', items, f.outgoing), { failed: [1, 2] })
  assert.deepEqual(f.calls.map(call => call.method), ['sendMediaGroup', 'sendPhoto', 'sendVideo'])
  assert.ok(!JSON.stringify(f.calls).includes('sensitive token'))
})

test('ambiguous network failure marks album failed and never retries it as singles', async t => {
  const f = await fixture(t)
  const items = await createItems(f, 2)
  f.dropGroup(true)
  assert.deepEqual(await sendPostMedia(f.api, 'chat', items, f.outgoing), { failed: [1, 2] })
  assert.deepEqual(f.calls.map(call => call.method), ['sendMediaGroup'])
})

test('video metadata failure only fails its own item and does not discard sibling media', async t => {
  const f = await fixture(t)
  const badVideo = path.join(f.outgoing, 'bad.mp4')
  const photo = path.join(f.outgoing, 'photo.jpg')
  await writeFile(badVideo, 'not a video')
  await writeFile(photo, 'jpeg')
  assert.deepEqual(await sendPostMedia(f.api, 'chat', [
    { index: 7, type: 'video', filePath: badVideo },
    { index: 8, type: 'photo', filePath: photo },
  ], f.outgoing), { failed: [7] })
  assert.deepEqual(f.calls.map(call => call.method), ['sendPhoto'])
})

test('429 album response waits and retries the exact same album without singles', async t => {
  const f = await fixture(t)
  const items = await createItems(f, 2)
  f.queue('sendMediaGroup', [
    { statusCode: 429, retryAfter: 1, body: { ok: false, error_code: 429, parameters: { retry_after: 1 } } },
    { statusCode: 200, body: { ok: true, result: {} } },
  ])
  const started = Date.now()
  assert.deepEqual(await sendPostMedia(f.api, 'chat', items, f.outgoing), { failed: [] })
  assert.ok(Date.now() - started >= 950, 'retry_after delay should be honored')
  assert.deepEqual(f.calls.map(call => call.method), ['sendMediaGroup', 'sendMediaGroup'])
  assert.deepEqual(f.calls[0].payload, f.calls[1].payload)
})

test('429 author text retries before media delivery and cleanup completes after success', async t => {
  const f = await fixture(t)
  const items = await createItems(f, 1)
  f.queue('sendMessage', [
    { statusCode: 429, retryAfter: 1, body: { ok: false, error_code: 429, parameters: { retry_after: 1 } } },
    { statusCode: 200, body: { ok: true, result: {} } },
  ])
  let cleaned = false
  const started = Date.now()
  await deliverPost({
    post: { text: 'author text', items: [{ ...items[0], type: 'photo' }], cleanup: async () => { cleaned = true } },
    sourceUrl: 'https://example.test/post',
    sendText: text => sendPostText(f.api, 'chat', text),
    sendMedia: media => sendPostMedia(f.api, 'chat', media, f.outgoing),
    analyze: async () => ({ kind: 'description', text: 'ok' }),
    transcribe: async () => {},
  })
  assert.ok(Date.now() - started >= 950, 'retry_after delay should be honored')
  assert.deepEqual(f.calls.map(call => call.method), ['sendMessage', 'sendMessage', 'sendPhoto', 'sendMessage'])
  assert.equal(f.calls[0].payload.text, f.calls[1].payload.text)
  assert.equal(cleaned, true)
})

test('exhausted 429 retries report album failure without falling back to singles', async t => {
  const f = await fixture(t)
  const items = await createItems(f, 2)
  f.queue('sendMediaGroup', Array.from({ length: 3 }, () => ({
    statusCode: 200, retryAfter: 0, body: { ok: false, error_code: 429, parameters: { retry_after: 0 } },
  })))
  assert.deepEqual(await sendPostMedia(f.api, 'chat', items, f.outgoing), { failed: [1, 2] })
  assert.deepEqual(f.calls.map(call => call.method), ['sendMediaGroup', 'sendMediaGroup', 'sendMediaGroup'])
})
