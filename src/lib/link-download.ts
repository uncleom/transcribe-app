import { spawn } from 'node:child_process'
import { lookup } from 'node:dns/promises'
import { chmod, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { BlockList, isIP } from 'node:net'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

// Gladia accepts 135 minutes. The local Bot API accepts a file up to 2000 MB.
export const GLADIA_MAX_SECONDS = 135 * 60
export const SEND_MAX_BYTES = 2_000_000_000

const FILES_ROOT = path.resolve(process.env.TELEGRAM_LOCAL_FILES_ROOT || '/var/lib/telegram-bot-api')
const OUTGOING = path.resolve(FILES_ROOT, 'outgoing')
const YT_DLP = process.env.YT_DLP_BIN || path.join(process.cwd(), 'bin', 'yt-dlp')

const PRIVATE = new BlockList()
PRIVATE.addSubnet('0.0.0.0', 8, 'ipv4')
PRIVATE.addSubnet('10.0.0.0', 8, 'ipv4')
PRIVATE.addSubnet('127.0.0.0', 8, 'ipv4')
PRIVATE.addSubnet('100.64.0.0', 10, 'ipv4')
PRIVATE.addSubnet('169.254.0.0', 16, 'ipv4')
PRIVATE.addSubnet('172.16.0.0', 12, 'ipv4')
PRIVATE.addSubnet('192.168.0.0', 16, 'ipv4')
PRIVATE.addSubnet('224.0.0.0', 3, 'ipv4')
PRIVATE.addAddress('::1', 'ipv6')
PRIVATE.addAddress('::', 'ipv6')
PRIVATE.addSubnet('fc00::', 7, 'ipv6')
PRIVATE.addSubnet('fe80::', 10, 'ipv6')

export type LinkFailure = 'blocked' | 'too_long' | 'unavailable' | 'no_audio'

export class LinkError extends Error {
  code: LinkFailure
  constructor(code: LinkFailure) {
    super(code)
    this.code = code
  }
}

export interface LinkMedia {
  videoPath: string | null
  audioPath: string
  durationSeconds: number
  videoTooBig: boolean
  cleanup: () => Promise<void>
}

export function extractHttpUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i)
  if (!match) return null
  return match[0].replace(/[),.;]+$/, '')
}

function isPrivate(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  const ip = mapped ? mapped[1] : address
  const kind = isIP(ip)
  if (kind === 4) return PRIVATE.check(ip, 'ipv4')
  if (kind === 6) return PRIVATE.check(ip, 'ipv6')
  return true
}

/** Refuse local and private targets. Any public http(s) host is left to yt-dlp. */
export async function assertPublicHttpUrl(raw: string): Promise<string> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new LinkError('blocked')
  }
  if (url.username || url.password) throw new LinkError('blocked')
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new LinkError('blocked')

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (
    !host
    || host === 'localhost'
    || host.endsWith('.localhost')
    || host.endsWith('.local')
    || host.endsWith('.internal')
    || host.endsWith('.home.arpa')
  ) {
    throw new LinkError('blocked')
  }

  if (isIP(host)) {
    if (isPrivate(host)) throw new LinkError('blocked')
    return url.href
  }

  let addrs: { address: string; family: number }[]
  try {
    addrs = await lookup(host, { all: true, verbatim: true })
  } catch {
    throw new LinkError('blocked')
  }
  if (addrs.length === 0 || addrs.some(item => isPrivate(item.address))) {
    throw new LinkError('blocked')
  }
  return url.href
}

function run(cmd: string, args: string[], timeoutMs: number): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  const take = (prev: string, chunk: Buffer) => (prev + chunk.toString('utf8')).slice(-8_000)
  child.stdout.on('data', (chunk: Buffer) => { stdout = take(stdout, chunk) })
  child.stderr.on('data', (chunk: Buffer) => { stderr = take(stderr, chunk) })
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

const YT_BASE = [
  '--ignore-config',
  '--no-playlist',
  '--no-warnings',
  '--no-progress',
  '--restrict-filenames',
  '--socket-timeout', '30',
  '--retries', '2',
  '--no-cache-dir',
]

async function readable(file: string): Promise<void> {
  await chmod(file, 0o644)
}

async function findFile(dir: string, pred: (name: string) => boolean): Promise<string | null> {
  const names = await readdir(dir)
  const name = names.find(pred)
  return name ? path.join(dir, name) : null
}

function parseDuration(raw: string): number | null {
  const text = raw.trim()
  if (!text || text === 'NA' || text === 'None') return null
  const value = Number(text)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

async function probeUrl(url: string): Promise<number | null> {
  const result = await run(YT_DLP, [...YT_BASE, '--skip-download', '--print', '%(duration)s', url], 60_000)
  if (result.code !== 0) return null
  const line = result.stdout.trim().split('\n').filter(Boolean).pop() ?? ''
  return parseDuration(line)
}

async function probeFile(file: string): Promise<number | null> {
  const result = await run(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file],
    30_000,
  )
  if (result.code !== 0) return null
  return parseDuration(result.stdout)
}

function tooBig(stderr: string): boolean {
  return /larger than max-filesize|File is larger/i.test(stderr)
}

export async function downloadLink(rawUrl: string): Promise<LinkMedia> {
  const url = await assertPublicHttpUrl(rawUrl)
  await mkdir(OUTGOING, { recursive: true, mode: 0o755 })
  await chmod(OUTGOING, 0o755)
  const dir = path.join(OUTGOING, randomUUID())
  await mkdir(dir, { mode: 0o755 })

  const cleanup = () => rm(dir, { recursive: true, force: true })

  try {
    const probed = await probeUrl(url)
    if (probed != null && probed > GLADIA_MAX_SECONDS) throw new LinkError('too_long')

    const videoRun = await run(YT_DLP, [
      ...YT_BASE,
      '--max-filesize', '2000M',
      '--merge-output-format', 'mp4',
      '-o', path.join(dir, 'video.%(ext)s'),
      url,
    ], 20 * 60 * 1000)

    if (videoRun.code === 0) {
      const found = await findFile(dir, (name) => name.startsWith('video.') && !name.endsWith('.part'))
      if (!found) throw new LinkError('unavailable')
      await readable(found)
      let duration = probed ?? await probeFile(found)
      if (duration != null && duration > GLADIA_MAX_SECONDS) throw new LinkError('too_long')
      const audioPath = path.join(dir, 'audio.m4a')
      const extracted = await run('ffmpeg', [
        '-y', '-i', found, '-vn', '-ac', '1', '-c:a', 'aac', '-b:a', '64k', audioPath,
      ], 15 * 60 * 1000)
      if (extracted.code !== 0) throw new LinkError('no_audio')
      await readable(audioPath)
      let videoPath: string | null = found
      let videoTooBig = false
      if ((await stat(found)).size > SEND_MAX_BYTES) {
        videoTooBig = true
        videoPath = null
        await rm(found, { force: true })
      }
      return {
        videoPath,
        audioPath,
        durationSeconds: duration ?? 60,
        videoTooBig,
        cleanup,
      }
    }

    if (!tooBig(videoRun.stderr)) throw new LinkError('unavailable')

    const audioRun = await run(YT_DLP, [
      ...YT_BASE,
      '-f', 'ba/b',
      '-x',
      '--audio-format', 'm4a',
      '-o', path.join(dir, 'speech.%(ext)s'),
      url,
    ], 20 * 60 * 1000)
    if (audioRun.code !== 0) throw new LinkError('unavailable')
    const speech = await findFile(dir, (name) => name.startsWith('speech.') && !name.endsWith('.part'))
    if (!speech) throw new LinkError('no_audio')
    await readable(speech)
    const duration = probed ?? await probeFile(speech)
    if (duration != null && duration > GLADIA_MAX_SECONDS) throw new LinkError('too_long')
    return {
      videoPath: null,
      audioPath: speech,
      durationSeconds: duration ?? 60,
      videoTooBig: true,
      cleanup,
    }
  } catch (err) {
    await cleanup()
    throw err
  }
}
