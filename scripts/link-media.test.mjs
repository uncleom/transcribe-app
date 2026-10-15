import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import http from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { Agent, getGlobalDispatcher, setGlobalDispatcher } from 'undici'
import { postLongJson } from '../src/lib/long-request.mjs'
import { sendVideoFile, videoInfo } from '../src/lib/local-video.mjs'
import { failureCode } from '../downloader/failures.mjs'

test('download errors distinguish unsupported links, image posts, anti-bot blocks and logins', () => {
  assert.equal(failureCode({ stderr: 'ERROR: Unsupported URL: https://example.com/post' }), 'unsupported')
  assert.equal(failureCode({ stderr: 'ERROR: No video formats found!' }), 'no_media')
  assert.equal(failureCode({ stderr: 'Sign in to confirm you’re not a bot. Use cookies for authentication.' }), 'source_blocked')
  assert.equal(failureCode({ stderr: 'You have exceeded the rate-limit for accessing posts anonymously. Login required.' }), 'source_blocked')
  assert.equal(failureCode({ stderr: 'This video is private. Login required.' }), 'login_required')
  assert.equal(failureCode({ timedOut: true, stderr: '' }), 'timeout')
  assert.equal(failureCode({ stderr: 'Something failed' }), 'unavailable')
})

async function listen(handler) {
  const server = http.createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return { server, url: `http://127.0.0.1:${server.address().port}` }
}

test('long requests outlive an inherited short headers timeout', async () => {
  const { server, url } = await listen((req, res) => {
    setTimeout(() => res.end('{"ok":true}'), 2000)
  })
  const previous = getGlobalDispatcher()
  const agent = new Agent({ headersTimeout: 40 })
  setGlobalDispatcher(agent)
  try {
    const { data } = await postLongJson(url, {}, 5000)
    assert.equal(data.ok, true)
  } finally {
    setGlobalDispatcher(previous)
    await agent.close()
    server.closeAllConnections()
    server.close()
  }
})

test('an explicit deadline still stops a stuck download', async () => {
  const { server, url } = await listen(() => {})
  try {
    await assert.rejects(postLongJson(url, {}, 80))
  } finally {
    server.closeAllConnections()
    server.close()
  }
})

test('Telegram receives actual portrait dimensions and duration, not its 320x320 default', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'link-video-test-'))
  const file = path.join(dir, 'portrait.mp4')
  let received
  const { server, url } = await listen(async (req, res) => {
    let raw = ''
    for await (const chunk of req) raw += chunk
    received = JSON.parse(raw)
    res.end('{"ok":true}')
  })
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=144x256:rate=5',
      '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file])
    assert.deepEqual(await videoInfo(file), { width: 144, height: 256, duration: 1 })
    await sendVideoFile(url, 123, file)
    assert.equal(received.width, 144)
    assert.equal(received.height, 256)
    assert.equal(received.duration, 1)
    assert.equal(received.video, `file://${file}`)
  } finally {
    server.closeAllConnections()
    server.close()
    await rm(dir, { recursive: true, force: true })
  }
})

test('video metadata respects non-square pixels and rotation', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'link-video-rotation-'))
  try {
    const source = path.join(dir, 'anamorphic.mp4')
    const rotated = path.join(dir, 'rotated.mp4')
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=144x144:rate=5',
      '-t', '1', '-vf', 'setsar=16/9', '-c:v', 'libx264', source])
    try {
      execFileSync('ffmpeg', ['-v', 'error', '-display_rotation', '90', '-i', source, '-c', 'copy', rotated], { stdio: 'pipe' })
    } catch (err) {
      // FFmpeg 5 uses the old metadata option; 8+ no longer writes rotation with it.
      if (!String(err.stderr).includes('Unrecognized option')) throw err
      execFileSync('ffmpeg', ['-v', 'error', '-i', source, '-c', 'copy', '-metadata:s:v:0', 'rotate=90', rotated])
    }
    assert.deepEqual(await videoInfo(source), { width: 256, height: 144, duration: 1 })
    assert.deepEqual(await videoInfo(rotated), { width: 144, height: 256, duration: 1 })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
