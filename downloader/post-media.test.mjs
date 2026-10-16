import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, copyFile, writeFile, readdir, rm, stat, open } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import test from 'node:test'
import { normalizePost, normalizePhoto, photoGeometry, photoArgs, createDownloader,
  PROXY, PHOTO_MAX_BYTES, METADATA_MAX_BYTES } from './post-media.mjs'
import { downloadVideo, inspectMedia } from './video-media.mjs'
import { run } from './process.mjs'
import { startProxy } from './proxy.mjs'

async function workspace(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'post-media-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}
async function ff(args) {
  const result = await run('ffmpeg', ['-v', 'error', '-y', ...args], 30_000)
  assert.equal(result.code, 0, result.stderr)
}
const metadata = info => ({ code: 0, stdout: JSON.stringify(info), stderr: '' })

test('Instagram failed video previews retain video intent despite empty formats and caption', () => {
  for (const indicators of [{ duration: 12 }, { duration: '12' }, { post_media_type: 'video' },
    { media_type: 2 }, { media_type: 'video' }, { is_video: true }, { video_duration: 12 }]) {
    const entry = { extractor_key: 'Instagram', formats: [], thumbnails: [{ url: 'https://cdn.example/preview.jpg' }],
      description: 'Original caption', ...indicators }
    const single = normalizePost(entry)
    assert.equal(single.items.length, 1)
    assert.equal(single.items[0].type, 'video', JSON.stringify(indicators))
    const album = normalizePost({ _type: 'playlist', extractor_key: 'Instagram', entries: [
      { formats: [], thumbnail: 'https://cdn.example/photo.jpg' }, entry,
    ] })
    assert.deepEqual(album.items.map(x => x.type), ['photo', 'video'], JSON.stringify(indicators))
    assert.deepEqual(album.items[1].selection, ['--yes-playlist', '--playlist-items', '2'])
  }
})

test('audio extraction failure preserves original valid H264 video and cleans partial audio', async t => {
  const root = await workspace(t)
  const fixture = path.join(root, 'input.mp4')
  await ff(['-f', 'lavfi', '-i', 'color=c=red:s=160x90:r=10', '-f', 'lavfi', '-i',
    'sine=frequency=440:sample_rate=16000', '-t', '0.4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', fixture])
  const original = await inspectMedia(fixture)
  assert.equal(original.streams.find(s => s.codec_type === 'video').codec_name, 'h264')
  assert.ok(original.streams.some(s => s.codec_type === 'audio'))
  let extractionFailures = 0
  const execute = async (cmd, args, ...rest) => {
    if (cmd === 'fixture-ytdlp') {
      if (args.includes('--dump-single-json')) return metadata({ formats: [{}], description: 'Original' })
      await copyFile(fixture, args[args.indexOf('-o') + 1].replace('%(ext)s', 'mp4'))
      return { code: 0, stdout: '', stderr: '' }
    }
    if (cmd === 'ffmpeg' && args.includes('-vn')) {
      extractionFailures++
      await writeFile(args.at(-1), 'partial failed audio')
      return { code: 1, stdout: '', stderr: 'simulated extraction failure' }
    }
    return run(cmd, args, ...rest)
  }
  const download = createDownloader({ root, ytDlp: 'fixture-ytdlp', ytBase: ['--proxy', PROXY], assertPublic: async u => u, execute })
  const { status, body } = await download('https://source.example/post')
  assert.equal(status, 200)
  assert.equal(extractionFailures, 1)
  assert.equal(body.items[0].file, '1-video.mp4')
  assert.equal(body.items[0].audio, null)
  assert.equal(body.items[0].audioError, 'no_audio')
  assert.equal(body.items[0].error, undefined)
  assert.equal(body.video, '1-video.mp4')
  assert.equal(body.audio, null)
  assert.deepEqual(await readdir(path.join(root, body.id)), ['1-video.mp4'])
  const preserved = path.join(root, body.id, body.items[0].file)
  const { readFile } = await import('node:fs/promises')
  assert.deepEqual(await readFile(preserved), await readFile(fixture))
  assert.ok((await inspectMedia(preserved)).streams.some(s => s.codec_type === 'audio'))
})

test('observed Instagram shape: 16 photos, no dimensions/caption, best ordered thumbnail', () => {
  const post = normalizePost({ _type: 'playlist', extractor_key: 'Instagram', title: 'Generated title',
    entries: Array.from({ length: 16 }, (_, i) => ({ formats: [], thumbnails: [
      { url: `https://cdn.example/${i}-small`, id: '0' }, { url: `https://cdn.example/${i}-large`, id: '1' },
    ] })) })
  assert.equal(post.text, '')
  assert.equal(post.items.length, 16)
  post.items.forEach((item, i) => {
    assert.equal(item.index, i + 1)
    assert.equal(item.type, 'photo')
    assert.equal(item.url, `https://cdn.example/${i}-large`)
  })
})

test('mixed order, explicit markers, text-only, no generic/failed-video preview substitution', () => {
  const post = normalizePost({ _type: 'playlist', extractor_key: 'Threads', description: 'Original 😀', entries: [
    { post_media_type: 'photo', thumbnail: 'https://cdn.example/1' },
    { post_media_type: 'video', formats: [{}] },
    { post_media_type: 'photo', thumbnail: 'https://cdn.example/3' },
  ] })
  assert.deepEqual(post.items.map(x => x.type), ['photo', 'video', 'photo'])
  assert.deepEqual(post.items[1].selection, ['--yes-playlist', '--playlist-items', '2'])
  assert.equal(post.text, 'Original 😀')
  for (const info of [{ extractor_key: 'Generic', thumbnail: 'https://cdn.example/preview' },
    { extractor_key: 'Threads', post_media_type: 'video', formats: [],
      description: 'Caption', thumbnail: 'https://cdn.example/preview' }]) {
    assert.equal(normalizePost(info).items[0].type, 'video')
  }
  assert.deepEqual(normalizePost({ extractor_key: 'Threads', post_media_type: 'text',
    description: 'Text 😀', formats: [] }), { text: 'Text 😀', items: [] })
  assert.throws(() => normalizePost({ _type: 'playlist', entries: [] }), { code: 'no_media' })
  assert.throws(() => normalizePost({ _type: 'playlist', entries: Array(101).fill({}) }), { code: 'too_many_items' })
  assert.throws(() => normalizePost({ _type: 'playlist', playlist_count: 101, entries: [{}] }), { code: 'too_many_items' })
  const invalid = normalizePost({ _type: 'playlist', entries: [null, { formats: [{}] }] })
  assert.equal(invalid.items[0].error, 'invalid_metadata')
  assert.equal(invalid.items[1].index, 2)
})

test('curl cannot bypass the proxy for redirects or NO_PROXY; HTTPS and finite limits', async t => {
  const dir = await workspace(t)
  const proxy = await startProxy(0)
  t.after(() => new Promise(resolve => proxy.close(resolve)))
  const proxyUrl = `http://127.0.0.1:${proxy.address().port}`
  const args = photoArgs('https://127.0.0.1/private', path.join(dir, 'source'), proxyUrl)
  for (const [flag, value] of [['--proxy', proxyUrl], ['--noproxy', ''], ['--proto', '=https'],
    ['--proto-redir', '=https'], ['--max-filesize', String(PHOTO_MAX_BYTES)], ['--max-time', '90']]) {
    assert.equal(args[args.indexOf(flag) + 1], value)
  }
  assert.equal(args[0], '--disable')
  assert.ok(args.includes('--location'))
  const result = await run('curl', args, 5000)
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /403/)
  assert.deepEqual(await readdir(dir), [])
})

test('real image bytes/ffprobe validation, JPEG limits, excessive geometry/bytes', async t => {
  const dir = await workspace(t)
  const source = path.join(dir, 'panorama.png'), output = path.join(dir, 'photo.jpg')
  await ff(['-f', 'lavfi', '-i', 'color=c=blue:s=2000x20', '-frames:v', '1', source])
  await normalizePhoto(source, output)
  const result = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,codec_name', '-of', 'json', output], 5000)
  const stream = JSON.parse(result.stdout).streams[0]
  assert.equal(stream.codec_name, 'mjpeg')
  assert.ok(stream.width + stream.height <= 10000)
  assert.ok(Math.max(stream.width / stream.height, stream.height / stream.width) <= 20)
  assert.ok((await stat(output)).size <= 10_000_000)
  for (const bytes of [Buffer.from('<html>not an image</html>'), Buffer.from([255, 216, 255, 0, 0])]) {
    await writeFile(path.join(dir, 'bad'), bytes)
    await assert.rejects(normalizePhoto(path.join(dir, 'bad'), output), { code: 'invalid_image' })
  }
  for (const [w, h] of [[0, 100], [100, -1], [10000, 10000], [32769, 1], [1.5, 10]]) {
    assert.throws(() => photoGeometry(w, h), { code: 'image_dimensions' })
  }
  const oversized = path.join(dir, 'oversized')
  const handle = await open(oversized, 'w')
  try { await handle.truncate(PHOTO_MAX_BYTES + 1) } finally { await handle.close() }
  await assert.rejects(normalizePhoto(oversized, output), { code: 'image_too_big' })
})

test('odd-sized Instagram JPEG normalizes without chroma-rounded pad failure', async t => {
  const dir = await workspace(t)
  const input = path.join(dir, 'odd.jpg'), output = path.join(dir, 'normalized.jpg')
  await ff(['-f', 'lavfi', '-i', 'color=c=blue:s=1024x1350', '-vf', 'scale=1023:1350',
    '-pix_fmt', 'yuvj420p', '-frames:v', '1', input])
  await normalizePhoto(input, output)
  assert.ok((await stat(output)).size > 0)
  const geometry = photoGeometry(1023, 1350)
  assert.equal(geometry.paddedWidth % 2, 0)
})

test('production mixed downloader uses real photo normalization, silent video, exact selection and cleanup', async t => {
  const root = await workspace(t)
  const photo = path.join(root, 'fixture.png'), silent = path.join(root, 'fixture.mp4')
  await ff(['-f', 'lavfi', '-i', 'color=c=blue:s=100x100', '-frames:v', '1', photo])
  await ff(['-f', 'lavfi', '-i', 'color=c=red:s=160x90:r=10', '-t', '0.4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', silent])
  const commands = []
  const execute = async (cmd, args, ...rest) => {
    commands.push([cmd, args])
    if (cmd === 'fixture-ytdlp') {
      if (args.includes('--dump-single-json')) return metadata({ _type: 'playlist', extractor_key: 'Threads', description: 'Caption', entries: [
        { post_media_type: 'photo', thumbnail: 'https://cdn.example/photo' },
        { post_media_type: 'video', formats: [{}] },
        { post_media_type: 'photo', thumbnail: 'https://cdn.example/bad' },
      ] })
      assert.equal(args[args.indexOf('--playlist-items') + 1], '2')
      assert.equal(args[args.indexOf('--proxy') + 1], PROXY)
      await copyFile(silent, args[args.indexOf('-o') + 1].replace('%(ext)s', 'mp4'))
      return { code: 0, stdout: '', stderr: '' }
    }
    if (cmd === 'curl') {
      const target = args[args.indexOf('--output') + 1]
      if (args.at(-1).endsWith('/bad')) await writeFile(target, 'invalid image')
      else await copyFile(photo, target)
      return { code: 0, stdout: '', stderr: '' }
    }
    return run(cmd, args, ...rest)
  }
  const download = createDownloader({ root, ytDlp: 'fixture-ytdlp', ytBase: ['--proxy', PROXY], assertPublic: async u => u, execute })
  const { status, body } = await download('https://source.example/post')
  assert.equal(status, 200)
  assert.deepEqual(body.items.map(x => x.index), [1, 2, 3])
  assert.deepEqual(body.items.map(x => x.type), ['photo', 'video', 'photo'])
  assert.equal(body.items[0].file, '1-photo.jpg')
  assert.equal(body.items[1].audio, null)
  assert.equal(body.video, body.items[1].file)
  assert.equal(body.audio, null)
  assert.equal(body.items[2].file, null)
  assert.equal(body.items[2].error, 'invalid_image')
  assert.deepEqual((await readdir(path.join(root, body.id))).sort(), ['1-photo.jpg', '2-video.mp4'])
  assert.ok(!commands.some(([cmd, args]) => cmd === 'ffmpeg' && args.includes('-vn')))
})

test('real video transcode and audio extraction exercise production functions', async t => {
  const root = await workspace(t)
  for (const withAudio of [false, true]) {
    const dir = path.join(root, String(withAudio)); await mkdir(dir)
    const fixture = path.join(root, `input-${withAudio}.mp4`)
    await ff(['-f', 'lavfi', '-i', 'color=c=red:s=160x90:r=10',
      ...(withAudio ? ['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=16000'] : []),
      '-t', '0.4', '-c:v', 'mpeg4', ...(withAudio ? ['-c:a', 'aac'] : []), fixture])
    const execute = async (cmd, args, ...rest) => {
      if (cmd === 'fixture-ytdlp') {
        await copyFile(fixture, path.join(dir, 'video.mp4'))
        return { code: 0, stdout: '', stderr: '' }
      }
      return run(cmd, args, ...rest)
    }
    const result = await downloadVideo({ url: 'https://source.example/post', dir, item: { index: 1 }, ytDlp: 'fixture-ytdlp', ytBase: ['--proxy', PROXY], execute })
    assert.equal(result.file, 'video-h264.mp4')
    assert.equal(result.audio, withAudio ? 'audio.m4a' : null)
    assert.equal((await inspectMedia(path.join(dir, result.file))).streams[0].codec_name, 'h264')
    if (withAudio) assert.ok((await inspectMedia(path.join(dir, result.audio))).streams.some(s => s.codec_type === 'audio'))
  }
})

test('blocked photo URL and partially published output leave no files; metadata errors allocate nothing', async t => {
  const root = await workspace(t)
  let executed = 0
  const download = createDownloader({ root, ytDlp: 'fixture-ytdlp', ytBase: [], assertPublic: async () => null,
    execute: async () => { executed++; return metadata({ extractor_key: 'Threads', post_media_type: 'photo', thumbnail: 'https://127.0.0.1/private' }) } })
  const blocked = await download('https://source.example/post')
  assert.equal(executed, 1)
  assert.equal(blocked.body.items[0].error, 'blocked')
  assert.deepEqual(await readdir(path.join(root, blocked.body.id)), [])
  const broken = createDownloader({ root, ytDlp: 'fixture-ytdlp', ytBase: [], assertPublic: async u => u,
    execute: async () => metadata({ formats: [{}] }),
    video: async ({ dir }) => { await writeFile(path.join(dir, 'video.mp4'), 'fixture'); return { file: 'video.mp4', audio: 'missing.m4a' } } })
  const failed = await broken('https://source.example/post')
  assert.equal(failed.body.items[0].file, null)
  assert.deepEqual(await readdir(path.join(root, failed.body.id)), [])
  const before = await readdir(root)
  for (const result of [{ code: 1, overflow: true }, { code: 0, stdout: 'invalid JSON' }]) {
    const bad = createDownloader({ root, ytDlp: 'fixture-ytdlp', ytBase: [], assertPublic: async u => u, execute: async () => result })
    assert.equal((await bad('https://source.example/post')).status, 422)
  }
  assert.deepEqual(await readdir(root), before)
})

test('process stdout/stderr bounded, complete JSON >4KB, timeout kills process group', async () => {
  const complete = await run(process.execPath, ['-e', 'process.stdout.write(JSON.stringify({text:"😀".repeat(4000)}))'], 5000,
    { complete: true, stdoutLimit: METADATA_MAX_BYTES })
  assert.equal(JSON.parse(complete.stdout).text.length, 8000)
  const overflow = await run(process.execPath, ['-e', 'process.stdout.write("x".repeat(50000))'], 5000, { complete: true, stdoutLimit: 4096 })
  assert.equal(overflow.overflow, true)
  assert.equal(overflow.stdout, '')
  const tail = await run(process.execPath, ['-e', 'process.stdout.write("x".repeat(50000));process.stderr.write("y".repeat(50000))'], 5000)
  assert.equal(Buffer.byteLength(tail.stdout), 4000)
  assert.equal(Buffer.byteLength(tail.stderr), 4000)
  const timeout = await run(process.execPath, ['-e', 'require("node:child_process").spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"inherit"});setInterval(()=>{},1000)'], 300)
  assert.equal(timeout.timedOut, true)
  assert.notEqual(timeout.code, 0)
})

test('HTTP server rejects malicious sources before yt-dlp; probe and text-only download remain runnable', async t => {
  const root = await workspace(t)
  const cli = path.join(root, 'yt-dlp-fixture')
  await writeFile(cli, '#!/usr/bin/env node\nif(process.argv.includes("--print")) console.log("12.5"); else console.log(JSON.stringify({extractor_key:"Threads",post_media_type:"text",description:"HTTP text",formats:[]}));\n', { mode: 0o755 })
  const socket = net.createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve))
  const child = spawn(process.execPath, [path.join(import.meta.dirname, 'server.mjs')], {
    env: { PATH: process.env.PATH, PORT: String(port), DOWNLOADER_TOKEN: 'test-token', DOWNLOAD_ROOT: root, YT_DLP_BIN: cli },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited } })
  let errors = ''; child.stderr.on('data', chunk => { errors += chunk })
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`startup timeout: ${errors}`)), 5000)
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`startup exit ${code}: ${errors}`)) })
    child.stdout.on('data', data => { if (String(data).includes('downloader listening')) { clearTimeout(timer); resolve() } })
  })
  const request = async (route, url, auth = true) => {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, { method: 'POST',
      headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer test-token' } : {}) }, body: JSON.stringify({ url }) })
    return { status: response.status, body: await response.json() }
  }
  for (const url of ['https://127.0.0.1/', 'https://169.254.169.254/', 'http://localhost/',
    'https://user:pass@8.8.8.8/', 'file:///etc/passwd', 'https://[::1]/']) {
    for (const route of ['/probe', '/download']) assert.deepEqual(await request(route, url), { status: 422, body: { code: 'blocked' } })
  }
  assert.equal((await request('/download', 'https://8.8.8.8/', false)).status, 401)
  assert.deepEqual(await request('/probe', 'https://8.8.8.8/'), { status: 200, body: { durationSeconds: 12.5 } })
  const result = await request('/download', 'https://8.8.8.8/')
  assert.equal(result.status, 200); assert.equal(result.body.text, 'HTTP text'); assert.deepEqual(result.body.items, [])
})
