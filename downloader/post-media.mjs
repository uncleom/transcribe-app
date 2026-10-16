import { chmod, mkdir, open, readdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { run } from './process.mjs'
import { failureCode } from './failures.mjs'
import { downloadVideo } from './video-media.mjs'

export const MAX_ITEMS = 100
export const METADATA_MAX_BYTES = 8 * 1024 * 1024
export const PHOTO_MAX_BYTES = 25 * 1024 * 1024
export const TELEGRAM_PHOTO_BYTES = 10_000_000
export const PROXY = 'http://127.0.0.1:8888'
export const MAX_SECONDS = 135 * 60

function fail(code) { throw Object.assign(new Error(code), { code }) }
function sourceText(info) {
  return typeof info?.description === 'string' ? info.description : ''
}

export function imageCandidate(info) {
  // yt-dlp preserves ascending extractor/source preference even without dimensions.
  const thumbnails = Array.isArray(info.thumbnails) ? info.thumbnails : []
  return thumbnails.filter(t => typeof t?.url === 'string').at(-1)?.url
    || (typeof info.thumbnail === 'string' ? info.thumbnail : null)
}

export function normalizePost(info) {
  if (!info || typeof info !== 'object') fail('invalid_metadata')
  const playlist = info._type === 'playlist' || info._type === 'multi_video'
  const entries = playlist ? info.entries : [info]
  if (!Array.isArray(entries)) fail('invalid_metadata')
  if (entries.length > MAX_ITEMS || Number(info.playlist_count) > MAX_ITEMS) fail('too_many_items')
  const extractor = info.extractor_key || info.extractor || ''
  const text = sourceText(info) || entries.map(sourceText).find(Boolean) || ''
  const items = entries.map((entry, offset) => {
    const index = offset + 1
    if (!entry || typeof entry !== 'object') return { index, type: 'video', error: 'invalid_metadata' }
    const entryExtractor = entry.extractor_key || entry.extractor || extractor
    const knownPhotos = /^(Instagram|Threads)$/i.test(entryExtractor)
    const hasFormats = Array.isArray(entry.formats) && entry.formats.length > 0
    const videoIntent = entry.post_media_type === 'video' || Number(entry.duration) > 0
      || Number(entry.video_duration) > 0 || entry.media_type === 2
      || String(entry.media_type).toLowerCase() === 'video' || entry.is_video === true
    const photo = !videoIntent && (entry.post_media_type === 'photo'
      || (knownPhotos && !entry.post_media_type && !hasFormats && !entry.url && imageCandidate(entry)))
    if (photo) return { index, type: 'photo', url: imageCandidate(entry) }
    if (!playlist && knownPhotos && !videoIntent
      && !hasFormats && !entry.url && text) return null
    return { index, type: 'video', durationSeconds: Number(entry.duration) || undefined,
      selection: playlist ? ['--yes-playlist', '--playlist-items', String(index)] : ['--no-playlist'] }
  }).filter(Boolean)
  if (!items.length && !text.trim()) fail('no_media')
  return { text, items }
}

export function photoArgs(url, output, proxy = PROXY) {
  return ['--disable', '--fail', '--silent', '--show-error', '--proxy', proxy,
    '--noproxy', '', '--proto', '=https', '--proto-redir', '=https',
    '--max-filesize', String(PHOTO_MAX_BYTES), '--max-time', '90',
    '--connect-timeout', '30', '--max-redirs', '5', '--location',
    '--output', output, '--url', url]
}

export function photoGeometry(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || width < 1 || height < 1 || width > 32768 || height > 32768
    || width * height > 50_000_000) fail('image_dimensions')
  const ratio = Math.min(1, 4096 / width, 4096 / height)
  const w = Math.max(1, Math.floor(width * ratio))
  const h = Math.max(1, Math.floor(height * ratio))
  // Subsampled JPEG formats round pad dimensions down to chroma boundaries.
  return { width: w, height: h, paddedWidth: Math.ceil(Math.max(w, Math.ceil(h / 20)) / 2) * 2,
    paddedHeight: Math.ceil(Math.max(h, Math.ceil(w / 20)) / 2) * 2 }
}

async function imageInfo(file) {
  const result = await run('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe',
    '-show_entries', 'stream=codec_name,codec_type,width,height:format=format_name', '-of', 'json', file], 30_000)
  if (result.code !== 0) fail('invalid_image')
  let info
  try { info = JSON.parse(result.stdout) } catch { fail('invalid_image') }
  const stream = info.streams?.[0]
  if (info.streams?.length !== 1 || stream?.codec_type !== 'video'
    || !['mjpeg', 'png', 'webp', 'av1'].includes(stream.codec_name)) fail('invalid_image')
  if (!Number.isSafeInteger(stream.width) || !Number.isSafeInteger(stream.height)
    || stream.width < 1 || stream.height < 1) fail('invalid_image')
  photoGeometry(stream.width, stream.height)
  return stream
}

export async function normalizePhoto(input, output) {
  if ((await stat(input)).size > PHOTO_MAX_BYTES) fail('image_too_big')
  const handle = await open(input, 'r')
  const magic = Buffer.alloc(32)
  try { await handle.read(magic, 0, magic.length, 0) } finally { await handle.close() }
  const jpeg = magic[0] === 0xff && magic[1] === 0xd8 && magic[2] === 0xff
  const png = magic.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const webp = magic.toString('ascii', 0, 4) === 'RIFF' && magic.toString('ascii', 8, 12) === 'WEBP'
  const avif = magic.toString('ascii', 4, 8) === 'ftyp' && magic.toString('ascii', 8, 12) === 'avif'
  if (!jpeg && !png && !webp && !avif) fail('invalid_image')
  const info = await imageInfo(input)
  const geometry = photoGeometry(info.width, info.height)
  for (const quality of [3, 8, 15]) {
    const encoded = await run('ffmpeg', ['-v', 'error', '-y', '-protocol_whitelist', 'file,pipe',
      '-i', input, '-map', '0:v:0', '-frames:v', '1', '-an', '-map_metadata', '-1',
      '-vf', `scale=${geometry.width}:${geometry.height},pad=${geometry.paddedWidth}:${geometry.paddedHeight}:(ow-iw)/2:(oh-ih)/2:white,setsar=1`,
      '-c:v', 'mjpeg', '-q:v', String(quality), '-threads', '1', output], 90_000)
    if (encoded.code !== 0) fail('invalid_image')
    if ((await stat(output)).size <= TELEGRAM_PHOTO_BYTES) {
      const actual = await imageInfo(output)
      if (actual.codec_name !== 'mjpeg' || actual.width + actual.height > 10000
        || Math.max(actual.width / actual.height, actual.height / actual.width) > 20) fail('image_dimensions')
      await chmod(output, 0o644)
      return
    }
  }
  fail('image_too_big')
}

export function createDownloader({ root, ytDlp, ytBase, assertPublic, proxy = PROXY,
  execute = run, video = downloadVideo } ) {
  return async function download(url) {
    const metadata = await execute(ytDlp, [...ytBase, '--skip-download', '--ignore-no-formats-error',
      '--playlist-end', String(MAX_ITEMS + 1), '--dump-single-json', url], 120_000,
    { stdoutLimit: METADATA_MAX_BYTES, complete: true })
    if (metadata.overflow) return { status: 422, body: { code: 'metadata_too_big' } }
    if (metadata.code !== 0) return { status: 422, body: { code: failureCode(metadata) } }
    let post
    try { post = normalizePost(JSON.parse(metadata.stdout)) } catch (err) {
      return { status: 422, body: { code: err.code || 'invalid_metadata' } }
    }
    const id = randomUUID()
    const dir = path.join(root, id)
    await mkdir(dir, { mode: 0o755 })
    try {
      const items = []
      for (const item of post.items) {
        // Each slide has a private workspace: a failed process cannot leak partial files.
        const work = path.join(dir, `work-${item.index}`)
        await mkdir(work)
        try {
          if (item.error) fail(item.error)
          let result
          if (item.type === 'photo') {
            if (typeof item.url !== 'string' || !item.url.startsWith('https:') || !await assertPublic(item.url)) fail('blocked')
            const raw = path.join(work, 'source')
            const fetched = await execute('curl', photoArgs(item.url, raw, proxy), 100_000)
            if (fetched.code !== 0) fail(fetched.timedOut ? 'timeout' : 'image_download_failed')
            const output = path.join(work, 'photo.jpg')
            await normalizePhoto(raw, output)
            result = { file: 'photo.jpg' }
          } else {
            result = await video({ url, dir: work, item, ytDlp, ytBase, execute })
          }
          // Only controlled output basenames become public files in the UUID directory.
          const published = {}
          for (const field of ['file', 'audio']) {
            const name = result[field]
            if (!name) { if (field === 'file' || field in result) published[field] = null; continue }
            if (path.basename(name) !== name || !/^[a-zA-Z0-9_.-]+$/.test(name)) fail('invalid_file')
            const target = `${item.index}-${name}`
            await rename(path.join(work, name), path.join(dir, target))
            published[field] = target
          }
          items.push({ index: item.index, type: item.type, ...result, ...published })
        } catch (err) {
          // Remove files already published if the second rename or normalization failed.
          for (const name of await readdir(dir)) {
            if (name.startsWith(`${item.index}-`)) await rm(path.join(dir, name), { force: true })
          }
          const codes = new Set(['blocked', 'timeout', 'invalid_image', 'image_dimensions', 'image_too_big',
            'image_download_failed', 'too_long', 'no_audio', 'invalid_metadata', 'invalid_file',
            'source_blocked', 'login_required', 'unsupported', 'no_media', 'transcode_failed'])
          items.push({ index: item.index, type: item.type, file: null,
            error: codes.has(err.code) ? err.code : 'unavailable' })
        } finally { await rm(work, { recursive: true, force: true }) }
      }
      const firstVideo = items.find(item => item.type === 'video' && !item.error)
      return { status: 200, body: { id, text: post.text, items,
        ...(firstVideo ? { video: firstVideo.file, audio: firstVideo.audio ?? null,
          durationSeconds: firstVideo.durationSeconds, videoTooBig: firstVideo.videoTooBig ?? false } : {}) } }
    } catch (err) {
      await rm(dir, { recursive: true, force: true })
      throw err
    }
  }
}
