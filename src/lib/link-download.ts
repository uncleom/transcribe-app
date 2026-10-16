import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import path from 'node:path'
import { postLongJson } from './long-request.mjs'
import { readDownloaderPost } from './link-post.mjs'

// Gladia accepts 135 minutes. The local Bot API accepts a file up to 2000 MB.
export const GLADIA_MAX_SECONDS = 135 * 60

const FILES_ROOT = path.resolve(process.env.TELEGRAM_LOCAL_FILES_ROOT || '/var/lib/telegram-bot-api')
const OUTGOING = path.resolve(FILES_ROOT, 'outgoing')

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

export type LinkFailure = 'blocked' | 'too_long' | 'unknown_length' | 'unavailable' | 'no_audio'
  | 'timeout' | 'unsupported' | 'source_blocked' | 'login_required' | 'no_media'

export class LinkError extends Error {
  code: LinkFailure
  constructor(code: LinkFailure) {
    super(code)
    this.code = code
  }
}

export interface LinkPostItem {
  index: number
  type: 'photo' | 'video'
  filePath: string | null
  audioPath: string | null
  durationSeconds: number | null
  videoTooBig: boolean
  error: string | null
}

export interface LinkMedia {
  text: string
  items: LinkPostItem[]
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

function downloaderUrl(): string {
  return (process.env.DOWNLOADER_URL || '').replace(/\/$/, '')
}

async function askDownloader(pathname: string, url: string, timeoutMs: number): Promise<Record<string, unknown>> {
  const root = downloaderUrl()
  const token = process.env.DOWNLOADER_TOKEN || ''
  if (!root || !token) throw new LinkError('unavailable')
  let statusCode: number
  let data: Record<string, unknown>
  try {
    const response = await postLongJson(`${root}${pathname}`, { url }, timeoutMs, {
      authorization: `Bearer ${token}`,
    })
    statusCode = response.statusCode
    data = response.data as Record<string, unknown>
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
    const timeout = /TIMEOUT|ABORTED/.test(code) || (err instanceof Error && err.name === 'TimeoutError')
    // No URLs, authorization headers or source cookies in logs.
    console.error('Downloader transport failed:', timeout ? 'timeout' : (code || 'invalid_response'))
    throw new LinkError(timeout ? 'timeout' : 'unavailable')
  }
  if (statusCode < 200 || statusCode >= 300) {
    const code = data.code
    if (
      code === 'blocked' || code === 'too_long' || code === 'unknown_length'
      || code === 'unavailable' || code === 'no_audio'
      || code === 'timeout' || code === 'unsupported' || code === 'source_blocked'
      || code === 'login_required' || code === 'no_media'
    ) {
      throw new LinkError(code)
    }
    throw new LinkError('unavailable')
  }
  return data
}

/** Ask the download service for the length. No media is saved. */
export async function quotedDuration(rawUrl: string): Promise<number> {
  const url = await assertPublicHttpUrl(rawUrl)
  const data = await askDownloader('/probe', url, 70_000)
  const probed = typeof data.durationSeconds === 'number' ? data.durationSeconds : null
  if (probed == null) throw new LinkError('unknown_length')
  if (probed > GLADIA_MAX_SECONDS) throw new LinkError('too_long')
  return probed
}

async function fromDownloader(url: string): Promise<LinkMedia> {
  // Download, audio extraction and H.264 encoding have separate server deadlines.
  const data = await askDownloader('/download', url, 60 * 60 * 1000)
  try {
    return await readDownloaderPost(data, OUTGOING) as LinkMedia
  } catch {
    throw new LinkError('unavailable')
  }
}

export async function downloadLink(rawUrl: string): Promise<LinkMedia> {
  const url = await assertPublicHttpUrl(rawUrl)
  return fromDownloader(url)
}
