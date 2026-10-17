import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { postLongJson } from './long-request.mjs'
import { videoInfo } from './local-video.mjs'

const SEND_TIMEOUT_MS = 30 * 60 * 1000

function assertConfig(api, chatId) {
  if (typeof api !== 'string' || !/^https?:\/\//.test(api) || chatId == null) throw new Error('Telegram delivery is not configured')
}

async function safeFile(filePath, outgoingRoot) {
  if (typeof filePath !== 'string' || typeof outgoingRoot !== 'string') return null
  try {
    const [resolved, root] = await Promise.all([realpath(filePath), realpath(outgoingRoot)])
    const relative = path.relative(root, resolved)
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null
    return (await stat(resolved)).isFile() ? resolved : null
  } catch { return null }
}

const MAX_RATE_LIMIT_RETRIES = 2
const MAX_RETRY_AFTER_SECONDS = 120

function rateLimitError() {
  const error = new Error('Telegram rate limit prevented delivery')
  error.telegramRateLimited = true
  return error
}

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

async function send(api, method, payload) {
  for (let retry = 0; ; retry++) {
    let response
    try { response = await postLongJson(`${api}/${method}`, payload, SEND_TIMEOUT_MS) }
    catch { throw new Error('Telegram delivery outcome is unknown') }

    const rateLimited = response.statusCode === 429 || response.data?.error_code === 429
    if (rateLimited) {
      const retryAfter = response.data?.parameters?.retry_after
      if (!Number.isFinite(retryAfter) || retryAfter < 0 || retryAfter > MAX_RETRY_AFTER_SECONDS || retry >= MAX_RATE_LIMIT_RETRIES) {
        throw rateLimitError()
      }
      await sleep(retryAfter * 1000)
      continue
    }

    if (response.data?.ok === false && (response.statusCode >= 200 && response.statusCode < 300 || response.statusCode >= 400 && response.statusCode < 500)) {
      const error = new Error('Telegram rejected delivery')
      error.telegramRejected = true
      throw error
    }
    if (response.statusCode < 200 || response.statusCode >= 300 || response.data?.ok !== true) {
      throw new Error('Telegram delivery outcome is unknown')
    }
    return
  }
}

async function sendOne(api, chatId, item) {
  const payload = { chat_id: chatId, [item.type]: `file://${item.filePath}` }
  if (item.type === 'video') Object.assign(payload, { supports_streaming: true, ...item.videoInfo })
  await send(api, item.type === 'photo' ? 'sendPhoto' : 'sendVideo', payload)
}

async function sendGroup(api, chatId, items) {
  const media = []
  for (const item of items) {
    const entry = { type: item.type, media: `file://${item.filePath}` }
    if (item.type === 'video') Object.assign(entry, { supports_streaming: true, ...item.videoInfo })
    media.push(entry)
  }
  await send(api, 'sendMediaGroup', { chat_id: chatId, media })
}

export async function sendPostMedia(api, chatId, items, outgoingRoot) {
  assertConfig(api, chatId)
  if (!Array.isArray(items)) throw new Error('Telegram delivery is not configured')
  const prepared = []
  const failed = []
  for (const item of items) {
    if (!item || !Number.isInteger(item.index) || !['photo', 'video'].includes(item.type) || !item.filePath) {
      if (Number.isInteger(item?.index)) failed.push(item.index)
      continue
    }
    const filePath = await safeFile(item.filePath, outgoingRoot)
    if (!filePath) { failed.push(item.index); continue }
    const ready = { ...item, filePath }
    if (item.type === 'video') {
      try { ready.videoInfo = await videoInfo(filePath) }
      catch { failed.push(item.index); continue }
    }
    prepared.push(ready)
  }
  for (let offset = 0; offset < prepared.length;) {
    const remaining = prepared.length - offset
    const count = remaining === 1 ? 1 : Math.min(10, remaining)
    const batch = prepared.slice(offset, offset + count)
    if (batch.length === 1) {
      try { await sendOne(api, chatId, batch[0]) } catch { failed.push(batch[0].index) }
    } else {
      try { await sendGroup(api, chatId, batch) }
      catch (error) {
        if (error?.telegramRejected) {
          for (const item of batch) {
            try { await sendOne(api, chatId, item) } catch { failed.push(item.index) }
          }
        } else failed.push(...batch.map(item => item.index))
      }
    }
    offset += count
  }
  return { failed }
}

export function splitTelegramText(text, limit = 4000) {
  if (typeof text !== 'string' || !Number.isInteger(limit) || limit < 2) throw new TypeError('Invalid Telegram text')
  const chunks = []
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + limit, text.length)
    if (end < text.length && text.charCodeAt(end - 1) >= 0xD800 && text.charCodeAt(end - 1) <= 0xDBFF && text.charCodeAt(end) >= 0xDC00 && text.charCodeAt(end) <= 0xDFFF) end--
    chunks.push(text.slice(start, end))
    start = end
  }
  return chunks
}

export async function sendPostText(api, chatId, text) {
  assertConfig(api, chatId)
  for (const chunk of splitTelegramText(text)) {
    try { await send(api, 'sendMessage', { chat_id: chatId, text: chunk }) }
    catch { throw new Error('Telegram text send failed') }
  }
}
