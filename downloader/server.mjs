import { spawn } from 'node:child_process'
import { timingSafeEqual } from 'node:crypto'
import { chmod, mkdir, readdir, rm, stat } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { startProxy } from './proxy.mjs'
import { isBlockedHostname, isPrivateAddress } from './private-net.mjs'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const PORT = Number(process.env.PORT || 8090)
const TOKEN = process.env.DOWNLOADER_TOKEN || ''
const ROOT = process.env.DOWNLOAD_ROOT || '/downloads'
const YT_DLP = process.env.YT_DLP_BIN || '/app/bin/yt-dlp'
const MAX_SECONDS = 135 * 60
const SEND_MAX_BYTES = 2_000_000_000
const PROXY = 'http://127.0.0.1:8888'

if (!TOKEN) {
  console.error('DOWNLOADER_TOKEN is required')
  process.exit(1)
}

const YT_BASE = [
  '--ignore-config',
  '--no-playlist',
  '--no-warnings',
  '--no-progress',
  '--restrict-filenames',
  '--socket-timeout', '30',
  '--retries', '2',
  '--no-cache-dir',
  '--proxy', PROXY,
]

function sameSecret(header) {
  const given = String(header || '').replace(/^Bearer /, '')
  const a = Buffer.from(given)
  const b = Buffer.from(TOKEN)
  return a.length === b.length && timingSafeEqual(a, b)
}

function run(cmd, args, timeoutMs) {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  const take = (prev, chunk) => (prev + chunk.toString('utf8')).slice(-4000)
  child.stdout.on('data', (chunk) => { stdout = take(stdout, chunk) })
  child.stderr.on('data', (chunk) => { stderr = take(stderr, chunk) })
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
  return new Promise((resolve, reject) => {
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

async function assertPublic(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.username || url.password) return null
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isBlockedHostname(host)) return null
  if (isIP(host)) return isPrivateAddress(host) ? null : url.href
  let records
  try {
    records = await lookup(host, { all: true, verbatim: true })
  } catch {
    return null
  }
  if (records.length === 0 || records.some((item) => isPrivateAddress(item.address))) return null
  return url.href
}

function parseDuration(raw) {
  const text = String(raw || '').trim()
  if (!text || text === 'NA' || text === 'None') return null
  const value = Number(text)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

async function probe(url) {
  const result = await run(YT_DLP, [...YT_BASE, '--skip-download', '--print', '%(duration)s', url], 60_000)
  if (result.code !== 0) return null
  const line = result.stdout.trim().split('\n').filter(Boolean).pop() ?? ''
  return parseDuration(line)
}

async function findFile(dir, pred) {
  const names = await readdir(dir)
  return names.find(pred) || null
}

function tooBig(stderr) {
  return /larger than max-filesize|File is larger/i.test(stderr)
}

async function videoPicture(file) {
  const result = await run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,pix_fmt',
    '-of', 'json',
    file,
  ], 30_000)
  if (result.code !== 0) return { codec: '', pix: '' }
  try {
    const stream = JSON.parse(result.stdout).streams?.[0] ?? {}
    return { codec: stream.codec_name || '', pix: stream.pix_fmt || '' }
  } catch {
    return { codec: '', pix: '' }
  }
}

function telegramCanPlay(codec, pix) {
  return codec === 'h264' && (pix === 'yuv420p' || pix === 'yuvj420p')
}

async function h264IfNeeded(videoPath, dir) {
  const { codec, pix } = await videoPicture(videoPath)
  if (telegramCanPlay(codec, pix)) {
    console.log(`video keep ${codec} ${pix}`)
    return path.basename(videoPath)
  }
  console.log(`video transcode ${codec || 'unknown'} ${pix || 'unknown'}`)
  const out = path.join(dir, 'video-h264.mp4')
  const encoded = await run('ffmpeg', [
    '-y', '-i', videoPath,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'aac', '-ac', '2', '-b:a', '128k',
    '-movflags', '+faststart',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    out,
  ], 20 * 60 * 1000)
  if (encoded.code !== 0) {
    console.log('video transcode failed')
    return path.basename(videoPath)
  }
  await chmod(out, 0o644)
  if (path.resolve(out) !== path.resolve(videoPath)) await rm(videoPath, { force: true })
  return 'video-h264.mp4'
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 8000) throw new Error('too big')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function send(res, status, body) {
  const raw = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(raw)
}

async function download(url) {
  const id = randomUUID()
  const dir = path.join(ROOT, id)
  await mkdir(dir, { mode: 0o755 })
  const cleanup = () => rm(dir, { recursive: true, force: true })
  try {
    const probed = await probe(url)
    if (probed != null && probed > MAX_SECONDS) {
      await cleanup()
      return { status: 422, body: { code: 'too_long' } }
    }
    const videoRun = await run(YT_DLP, [
      ...YT_BASE,
      '--max-filesize', '2000M',
      '--merge-output-format', 'mp4',
      '-o', path.join(dir, 'video.%(ext)s'),
      url,
    ], 20 * 60 * 1000)
    if (videoRun.code === 0) {
      const video = await findFile(dir, (name) => name.startsWith('video.') && !name.endsWith('.part'))
      if (!video) {
        await cleanup()
        return { status: 422, body: { code: 'unavailable' } }
      }
      const videoPath = path.join(dir, video)
      await chmod(videoPath, 0o644)
      let duration = probed
      if (duration == null) {
        const probedFile = await run('ffprobe', [
          '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', videoPath,
        ], 30_000)
        duration = probedFile.code === 0 ? parseDuration(probedFile.stdout) : null
      }
      if (duration != null && duration > MAX_SECONDS) {
        await cleanup()
        return { status: 422, body: { code: 'too_long' } }
      }
      const extracted = await run('ffmpeg', [
        '-y', '-i', videoPath, '-vn', '-ac', '1', '-c:a', 'aac', '-b:a', '64k', path.join(dir, 'audio.m4a'),
      ], 15 * 60 * 1000)
      if (extracted.code !== 0) {
        await cleanup()
        return { status: 422, body: { code: 'no_audio' } }
      }
      await chmod(path.join(dir, 'audio.m4a'), 0o644)
      // Telegram plays H.264 8-bit in the chat. HEVC, AV1 and VP9 keep the sound and freeze the picture.
      let videoName = await h264IfNeeded(videoPath, dir)
      const sendPath = path.join(dir, videoName)
      let videoTooBig = false
      if ((await stat(sendPath)).size > SEND_MAX_BYTES) {
        videoTooBig = true
        videoName = null
        await rm(sendPath, { force: true })
      }
      return {
        status: 200,
        body: {
          id,
          video: videoName,
          audio: 'audio.m4a',
          durationSeconds: duration ?? 60,
          videoTooBig,
        },
      }
    }
    if (!tooBig(videoRun.stderr)) {
      await cleanup()
      return { status: 422, body: { code: 'unavailable' } }
    }
    const audioRun = await run(YT_DLP, [
      ...YT_BASE,
      '-f', 'ba/b',
      '-x',
      '--audio-format', 'm4a',
      '-o', path.join(dir, 'speech.%(ext)s'),
      url,
    ], 20 * 60 * 1000)
    if (audioRun.code !== 0) {
      await cleanup()
      return { status: 422, body: { code: 'unavailable' } }
    }
    const speech = await findFile(dir, (name) => name.startsWith('speech.') && !name.endsWith('.part'))
    if (!speech) {
      await cleanup()
      return { status: 422, body: { code: 'no_audio' } }
    }
    await chmod(path.join(dir, speech), 0o644)
    const duration = probed
    if (duration != null && duration > MAX_SECONDS) {
      await cleanup()
      return { status: 422, body: { code: 'too_long' } }
    }
    return {
      status: 200,
      body: {
        id,
        video: null,
        audio: speech,
        durationSeconds: duration ?? 60,
        videoTooBig: true,
      },
    }
  } catch (err) {
    await cleanup()
    throw err
  }
}

const DOWNLOAD_TTL_MS = 2 * 60 * 60 * 1000
const UUID_DIR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function sweepDownloads() {
  let names = []
  try {
    names = await readdir(ROOT)
  } catch {
    return
  }
  const cutoff = Date.now() - DOWNLOAD_TTL_MS
  for (const name of names) {
    if (!UUID_DIR.test(name)) continue
    const dir = path.join(ROOT, name)
    try {
      const info = await stat(dir)
      if (!info.isDirectory() || info.mtimeMs >= cutoff) continue
      await rm(dir, { recursive: true, force: true })
    } catch {
      // A file disappearing mid-sweep is fine.
    }
  }
}

await sweepDownloads()
setInterval(() => {
  sweepDownloads().catch(() => {})
}, 30 * 60 * 1000)

await startProxy(8888)

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    send(res, 200, { ok: true })
    return
  }
  if (req.method !== 'POST' || (req.url !== '/probe' && req.url !== '/download')) {
    send(res, 404, { code: 'unavailable' })
    return
  }
  if (!sameSecret(req.headers.authorization)) {
    send(res, 401, { code: 'unavailable' })
    return
  }
  let body
  try {
    body = await readBody(req)
  } catch {
    send(res, 400, { code: 'unavailable' })
    return
  }
  const url = await assertPublic(body.url)
  if (!url) {
    send(res, 422, { code: 'blocked' })
    return
  }
  try {
    if (req.url === '/probe') {
      const durationSeconds = await probe(url)
      if (durationSeconds != null && durationSeconds > MAX_SECONDS) {
        send(res, 422, { code: 'too_long' })
        return
      }
      send(res, 200, { durationSeconds })
      return
    }
    const result = await download(url)
    send(res, result.status, result.body)
  } catch {
    send(res, 422, { code: 'unavailable' })
  }
})

server.requestTimeout = 21 * 60 * 1000
server.listen(PORT, '0.0.0.0', () => {
  console.log('downloader listening')
})
