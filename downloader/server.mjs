import { timingSafeEqual } from 'node:crypto'
import { readdir, rm, stat } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { startProxy } from './proxy.mjs'
import { isBlockedHostname, isPrivateAddress } from './private-net.mjs'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { run } from './process.mjs'
import { createDownloader, MAX_SECONDS, PROXY } from './post-media.mjs'

const PORT = Number(process.env.PORT || 8090)
const TOKEN = process.env.DOWNLOADER_TOKEN || ''
const ROOT = process.env.DOWNLOAD_ROOT || '/downloads'
const YT_DLP = process.env.YT_DLP_BIN || '/app/bin/yt-dlp'

if (!TOKEN) {
  console.error('DOWNLOADER_TOKEN is required')
  process.exit(1)
}

const YT_BASE = [
  '--ignore-config',
  '--no-plugin-dirs',
  '--plugin-dirs', path.join(import.meta.dirname, 'plugins'),
  '--no-playlist',
  '--no-warnings',
  '--no-progress',
  '--restrict-filenames',
  '--socket-timeout', '30',
  '--retries', '2',
  '--no-cache-dir',
  '--js-runtimes', 'node',
  '--proxy', PROXY,
]

function sameSecret(header) {
  const given = String(header || '').replace(/^Bearer /, '')
  const a = Buffer.from(given)
  const b = Buffer.from(TOKEN)
  return a.length === b.length && timingSafeEqual(a, b)
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

const download = createDownloader({ root: ROOT, ytDlp: YT_DLP, ytBase: YT_BASE, assertPublic })

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
  } catch (err) {
    console.error(JSON.stringify({ event: 'download_failed', stage: 'service', host: new URL(url).hostname,
      code: typeof err?.code === 'string' ? err.code : 'unavailable' }))
    send(res, 422, { code: 'unavailable' })
  }
})

server.requestTimeout = 21 * 60 * 1000
server.listen(PORT, '0.0.0.0', () => {
  console.log('downloader listening')
})
