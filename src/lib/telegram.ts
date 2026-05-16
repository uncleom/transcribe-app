// Telegram Bot API helpers
// All requests use the bot token from TELEGRAM_BOT_TOKEN env var

const API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`
const FILE_API = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}`

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

export interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  text?: string
  voice?: TelegramFileRef
  audio?: TelegramFileRef
  video?: TelegramFileRef
  document?: TelegramFileRef & { mime_type?: string; file_name?: string }
}

export interface TelegramUser {
  id: number
  first_name: string
  username?: string
  language_code?: string
}

export interface TelegramChat {
  id: number
}

export interface TelegramFileRef {
  file_id: string
  file_size?: number
  duration?: number
  mime_type?: string
  file_name?: string
}

export interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  data?: string
}

export interface InlineKeyboardButton {
  text: string
  callback_data?: string
  url?: string
}

export interface SendMessageOptions {
  parse_mode?: 'HTML' | 'MarkdownV2'
  reply_markup?: {
    inline_keyboard: InlineKeyboardButton[][]
  }
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function call(method: string, body: object): Promise<unknown> {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json() as { ok: boolean; description?: string; result?: unknown }
  if (!data.ok) {
    console.error(`Telegram ${method} failed:`, data.description)
  }
  return data.result
}

export async function sendMessage(
  chatId: number,
  text: string,
  options: SendMessageOptions = {}
): Promise<void> {
  await call('sendMessage', { chat_id: chatId, text, ...options })
}

export async function sendChatAction(
  chatId: number,
  action: 'typing' | 'upload_document'
): Promise<void> {
  await call('sendChatAction', { chat_id: chatId, action })
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  await call('answerCallbackQuery', { callback_query_id: callbackQueryId, text })
}

export async function sendDocument(
  chatId: number,
  content: Uint8Array,
  filename: string,
  caption?: string,
  replyMarkup?: SendMessageOptions['reply_markup']
): Promise<void> {
  const form = new FormData()
  form.append('chat_id', String(chatId))
  form.append('document', new Blob([content.buffer as ArrayBuffer]), filename)
  if (caption) form.append('caption', caption)
  if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup))

  const res = await fetch(`${API}/sendDocument`, { method: 'POST', body: form })
  const data = await res.json() as { ok: boolean; description?: string }
  if (!data.ok) {
    console.error('Telegram sendDocument failed:', data.description)
  }
}

export interface TelegramFileInfo {
  file_id: string
  file_path: string
  file_size: number
}

export async function getFileInfo(fileId: string): Promise<TelegramFileInfo> {
  const result = await call('getFile', { file_id: fileId })
  return result as TelegramFileInfo
}

export async function downloadFile(filePath: string): Promise<ArrayBuffer> {
  const res = await fetch(`${FILE_API}/${filePath}`)
  if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`)
  return res.arrayBuffer()
}

export async function setWebhook(url: string, secretToken: string): Promise<void> {
  await call('setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: ['message', 'callback_query'],
  })
}

export async function setMyCommands(): Promise<void> {
  await call('setMyCommands', {
    commands: [
      { command: 'start', description: 'Start / get help' },
      { command: 'connect', description: 'Connect your account' },
      { command: 'history', description: 'View transcription history' },
    ],
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the file ref (with file_size) from any supported message type */
export function getFileRef(msg: TelegramMessage): TelegramFileRef | null {
  return msg.voice ?? msg.audio ?? msg.video ?? msg.document ?? null
}

/** Formats a timestamp suffix for unique filenames: 20260516_143022 */
export function fileTimestamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  )
}

/** Supported language codes for translate button */
export const SUPPORTED_LANGS: Record<string, string> = {
  en: 'Translate 🇬🇧',
  es: 'Traducir 🇪🇸',
  pt: 'Traduzir 🇧🇷',
  ru: 'Перевести 🇷🇺',
}

/** Returns the translate button label for a given Telegram language_code */
export function getTranslateLabel(languageCode: string): string {
  const base = languageCode.split('-')[0].toLowerCase()
  return SUPPORTED_LANGS[base] ?? SUPPORTED_LANGS['en']
}

/** Returns the target language for translation based on Telegram language_code */
export function getTargetLang(languageCode: string): string {
  const base = languageCode.split('-')[0].toLowerCase()
  return base in SUPPORTED_LANGS ? base : 'en'
}

const TELEGRAM_MAX_TEXT = 4096

/** Send text or file depending on length */
export async function sendTextOrFile(
  chatId: number,
  text: string,
  filename: string,
  replyMarkup?: SendMessageOptions['reply_markup']
): Promise<void> {
  if (text.length <= TELEGRAM_MAX_TEXT) {
    await sendMessage(chatId, text, { reply_markup: replyMarkup })
  } else {
    const bytes = new TextEncoder().encode(text)
    await sendDocument(chatId, bytes, filename, undefined, replyMarkup)
    // Send keyboard in a separate message if there is one (can't attach to document easily)
    if (replyMarkup) {
      await sendMessage(chatId, '👆 Use the buttons above to get summary or translation.', {
        reply_markup: replyMarkup,
      })
    }
  }
}
