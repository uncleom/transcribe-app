import { realpath, rm, stat } from 'node:fs/promises'
import path from 'node:path'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function invalid() { throw new Error('Invalid downloader response') }

/** Decode the service contract without trusting filenames or symlinks on the shared volume. */
export async function readDownloaderPost(data, outgoingRoot) {
  if (!data || typeof data !== 'object' || typeof data.id !== 'string' || !UUID.test(data.id)) invalid()
  const dir = path.resolve(outgoingRoot, data.id)
  const cleanup = () => rm(dir, { recursive: true, force: true })
  try {
    const root = await realpath(outgoingRoot)
    if (await realpath(dir) !== path.join(root, data.id)) invalid()
    const text = data.text == null ? '' : data.text
    if (typeof text !== 'string' || text.length > 1_000_000) invalid()
    const rawItems = data.items == null
      ? [{ index: 1, type: 'video', file: data.video ?? null, audio: data.audio ?? null,
          durationSeconds: data.durationSeconds, videoTooBig: data.videoTooBig }]
      : data.items
    if (!Array.isArray(rawItems) || rawItems.length > 100 || (!rawItems.length && !text.trim())) invalid()
    let previous = 0
    const items = []
    async function file(value) {
      if (value == null) return null
      if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(value)) invalid()
      const filename = path.join(dir, value)
      const actual = await realpath(filename)
      if (path.dirname(actual) !== path.join(root, data.id) || !(await stat(actual)).isFile()) invalid()
      return actual
    }
    for (const raw of rawItems) {
      if (!raw || !Number.isInteger(raw.index) || raw.index <= previous || raw.index > 100
        || !['photo', 'video'].includes(raw.type)) invalid()
      previous = raw.index
      const error = raw.error == null ? null : raw.error
      if (error != null && (typeof error !== 'string' || !/^[a-z_]{1,64}$/.test(error))) invalid()
      if (raw.videoTooBig != null && typeof raw.videoTooBig !== 'boolean') invalid()
      if (raw.type === 'photo' && raw.audio != null) invalid()
      const filePath = await file(raw.file)
      const audioPath = await file(raw.audio)
      if (!filePath && !audioPath && !error) invalid()
      if (raw.type === 'photo' && !filePath && !error) invalid()
      const durationSeconds = typeof raw.durationSeconds === 'number' && Number.isFinite(raw.durationSeconds)
        && raw.durationSeconds > 0 ? raw.durationSeconds : null
      items.push({ index: raw.index, type: raw.type, filePath, audioPath, durationSeconds,
        videoTooBig: raw.videoTooBig === true, error })
    }
    return { text, items, cleanup }
  } catch {
    await cleanup()
    throw new Error('Invalid downloader response')
  }
}
