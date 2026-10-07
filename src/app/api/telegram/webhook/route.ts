import { readFile } from 'node:fs/promises'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  sendMessage,
  sendChatAction,
  getFileRef,
  getTargetLang,
  getTranslateLabel,
  fileTimestamp,
  sendTextOrFile,
  answerCallbackQuery,
  getFileInfo,
  downloadFile,
  sendLocalVideo,
  type TelegramUpdate,
  type TelegramMessage,
  type TelegramCallbackQuery,
} from '@/lib/telegram'
import { processFile, formatTranscriptText } from '@/lib/transcription'
import { summariseTranscript, translateTranscript } from '@/lib/groq'
import { resolveGroqKey } from '@/lib/api-keys'
import type { TranscriptionResult } from '@/types'
import { reserveCredits, adjustCredits, refundCredits, CreditsInsufficientError } from '@/lib/credits'
import { downloadLink, extractHttpUrl, isOwner, LinkError } from '@/lib/link-download'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://transcribe.om-dev.uk'
const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB (Telegram getFile limit)

/** Strip markdown formatting for plain-text Telegram messages */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^[-*]\s/gm, '• ')
    .trim()
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Validate Telegram secret header
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (!secret || secret !== process.env.TELEGRAM_SECRET_TOKEN) {
    return new Response('Unauthorized', { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await req.json() as TelegramUpdate
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  // Respond immediately — Telegram requires < 5s response.
  // processUpdate runs on the same Node.js server after response is sent.
  // This works on Coolify (persistent process), NOT on serverless.
  void processUpdate(update)

  return new Response('ok', { status: 200 })
}

// ─── Update dispatcher ────────────────────────────────────────────────────────

async function processUpdate(update: TelegramUpdate) {
  try {
    if (update.message) {
      await handleMessage(update.message)
    } else if (update.callback_query) {
      await handleCallback(update.callback_query)
    }
  } catch (err) {
    console.error('Telegram processUpdate error:', err)
  }
}

// ─── Message handler ─────────────────────────────────────────────────────────

async function handleMessage(msg: TelegramMessage) {
  const chatId = msg.chat.id
  const telegramId = msg.from?.id
  if (!telegramId) return

  const text = msg.text ?? ''

  // /start [link_TOKEN]
  if (text.startsWith('/start')) {
    const arg = text.split(' ')[1]
    if (arg?.startsWith('link_')) {
      await handleLinkToken(chatId, telegramId, msg.from?.username, arg.slice(5))
    } else {
      await sendWelcome(chatId)
    }
    return
  }

  // /connect
  if (text === '/connect') {
    await sendMessage(chatId,
      `To connect your account, open the link below and sign in with Google:\n${SITE_URL}/connect-telegram`
    )
    return
  }

  // /history
  if (text === '/history') {
    await sendMessage(chatId, 'View your transcription history on the web:', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Open History →', url: `${SITE_URL}/history` }]],
      },
    })
    return
  }

  // Audio / voice / video / document
  const fileRef = getFileRef(msg)
  if (fileRef) {
    await handleFile(chatId, telegramId, msg.from?.language_code ?? 'en', fileRef)
    return
  }

  const link = extractHttpUrl(text)
  if (link) {
    if (!isOwner(telegramId)) {
      await sendMessage(chatId,
        'Send me an audio or voice file and I\'ll transcribe it.\n\n' +
        'Use /connect to link your account first.'
      )
      return
    }
    await handleLink(chatId, telegramId, msg.from?.language_code ?? 'en', link)
    return
  }

  // Unknown message
  await sendMessage(chatId,
    'Send me an audio or voice file and I\'ll transcribe it.\n\n' +
    'Use /connect to link your account first.'
  )
}

// ─── File transcription ───────────────────────────────────────────────────────

async function handleFile(
  chatId: number,
  telegramId: number,
  langCode: string,
  fileRef: ReturnType<typeof getFileRef> & object
) {
  const admin = createAdminClient()

  // Check account linking
  const { data: account } = await admin
    .from('telegram_accounts')
    .select('supabase_user_id')
    .eq('telegram_id', telegramId)
    .single()

  if (!account) {
    await sendMessage(chatId,
      `To use this bot, connect your account first:\n${SITE_URL}/connect-telegram`
    )
    return
  }

  const userId = account.supabase_user_id

  // Check file size
  if (fileRef.file_size && fileRef.file_size > MAX_FILE_BYTES) {
    await sendMessage(chatId,
      `File is too large (max 20 MB for Telegram).\nFor bigger files, use the web app:\n${SITE_URL}`
    )
    return
  }

  // Check credits
  const { data: profile } = await admin
    .from('profiles')
    .select('credits_seconds, is_unlimited')
    .eq('id', userId)
    .single()

  if (!profile) return

  if (!profile.is_unlimited && profile.credits_seconds <= 0) {
    await sendMessage(chatId,
      `You're out of credits. Top up at:\n${SITE_URL}/billing`
    )
    return
  }

  await sendChatAction(chatId, 'typing')

  // Download file from Telegram
  let fileBuffer: ArrayBuffer
  try {
    const info = await getFileInfo(fileRef.file_id)
    fileBuffer = await downloadFile(info.file_path)
  } catch (err) {
    // readFile errors include the absolute path, and that path contains the bot token.
    const raw = err instanceof Error ? err.message : ''
    const message = raw.startsWith('Telegram file') ? raw : 'download failed'
    console.error('Telegram file download error:', message)
    await sendMessage(chatId, 'Failed to download the file. Please try again.')
    return
  }

  // Estimate duration for credit reservation (conservative: file_size / 16000 bytes/sec for ~128kbps)
  const estimatedSeconds = fileRef.file_size
    ? Math.min(Math.ceil(fileRef.file_size / 16_000), 14400)
    : 300

  const subject = { type: 'user' as const, id: userId }

  // Reserve credits
  try {
    await reserveCredits(subject, estimatedSeconds)
  } catch (err) {
    if (err instanceof CreditsInsufficientError) {
      await sendMessage(chatId,
        `Not enough credits for this file. Top up at:\n${SITE_URL}/billing`
      )
      return
    }
    throw err
  }

  const ext = fileRef.file_name?.split('.').pop() ?? 'ogg'
  const file = new File([fileBuffer], `audio.${ext}`)
  await completeTranscription(
    chatId,
    userId,
    langCode,
    fileRef.file_name ?? 'voice_message',
    file,
    `audio.${ext}`,
    estimatedSeconds,
  )
}

async function handleLink(
  chatId: number,
  telegramId: number,
  langCode: string,
  url: string,
) {
  const admin = createAdminClient()

  const { data: account } = await admin
    .from('telegram_accounts')
    .select('supabase_user_id')
    .eq('telegram_id', telegramId)
    .single()

  if (!account) {
    await sendMessage(chatId,
      `To use this bot, connect your account first:\n${SITE_URL}/connect-telegram`
    )
    return
  }

  const userId = account.supabase_user_id
  const { data: profile } = await admin
    .from('profiles')
    .select('credits_seconds, is_unlimited')
    .eq('id', userId)
    .single()

  if (!profile) return

  if (!profile.is_unlimited && profile.credits_seconds <= 0) {
    await sendMessage(chatId,
      `You're out of credits. Top up at:\n${SITE_URL}/billing`
    )
    return
  }

  await sendMessage(chatId, 'Downloading the video.')
  await sendChatAction(chatId, 'upload_video')

  let media
  try {
    media = await downloadLink(url)
  } catch (err) {
    const code = err instanceof LinkError ? err.code : 'unavailable'
    const text = code === 'blocked'
      ? 'That address is on a private network. I won\'t download it.'
      : code === 'too_long'
        ? 'This is longer than 135 minutes. Gladia won\'t take it.'
        : code === 'no_audio'
          ? 'This video has no audio track.'
          : 'Couldn\'t download this. If it\'s private, I don\'t have a login for it.'
    const detail = err instanceof LinkError ? '' : (err instanceof Error ? err.name : '')
    console.error('Link download failed:', code, detail)
    await sendMessage(chatId, text)
    return
  }

  try {
    if (media.videoTooBig) {
      await sendMessage(chatId, 'The video is over 2 GB, so it is not in the chat. Transcribing the audio.')
    } else if (media.videoPath) {
      try {
        await sendLocalVideo(chatId, media.videoPath)
      } catch {
        await sendMessage(chatId, 'Could not send the video. Transcribing the audio.')
      }
    }

    const audioBuf = await readFile(media.audioPath)
    const estimatedSeconds = Math.min(Math.ceil(media.durationSeconds), 135 * 60)
    const subject = { type: 'user' as const, id: userId }
    try {
      await reserveCredits(subject, estimatedSeconds)
    } catch (err) {
      if (err instanceof CreditsInsufficientError) {
        await sendMessage(chatId,
          `Not enough credits for this video. Top up at:\n${SITE_URL}/billing`
        )
        return
      }
      throw err
    }

    let host = 'link'
    try { host = new URL(url).hostname } catch { /* keep the fallback */ }
    const file = new File([new Uint8Array(audioBuf)], 'audio.m4a')
    await completeTranscription(chatId, userId, langCode, host, file, 'audio.m4a', estimatedSeconds)
  } finally {
    await media.cleanup()
  }
}

async function completeTranscription(
  chatId: number,
  userId: string,
  langCode: string,
  fileName: string,
  audio: Blob,
  audioName: string,
  estimatedSeconds: number,
) {
  const admin = createAdminClient()
  const subject = { type: 'user' as const, id: userId }

  let result
  try {
    result = await processFile(audio, audioName, userId)
  } catch (err) {
    console.error('Transcription error:', err)
    await refundCredits(subject, estimatedSeconds)
    await sendMessage(chatId, 'Transcription failed. Please try again.')
    return
  }

  await adjustCredits(subject, estimatedSeconds, Math.ceil(result.duration))

  const { data: transcription } = await admin
    .from('transcriptions')
    .insert({
      user_id: userId,
      file_name: fileName,
      file_url: '',
      status: 'done',
      result,
      language: result.language,
      reserved_seconds: estimatedSeconds,
      duration_seconds: Math.ceil(result.duration),
    })
    .select('id')
    .single()

  const transcriptText = formatTranscriptText(result.utterances)
  const targetLang = getTargetLang(langCode)
  const transcriptLang = result.language?.split(/[+\-]/)[0]?.toLowerCase() ?? 'unknown'
  const showTranslate = transcriptLang !== targetLang && targetLang in { en: 1, es: 1, pt: 1, ru: 1 }

  const keyboard = {
    inline_keyboard: [
      [
        { text: 'Summary 📝', callback_data: `sum:${transcription?.id ?? 'none'}` },
        ...(showTranslate
          ? [{ text: getTranslateLabel(langCode), callback_data: `trl:${transcription?.id ?? 'none'}:${targetLang}` }]
          : []),
      ],
    ],
  }

  const ts = fileTimestamp()
  await sendTextOrFile(chatId, transcriptText, `transcript_${ts}.txt`, keyboard)
}

// ─── Callback handler ─────────────────────────────────────────────────────────

const VALID_CALLBACK_LANGS = new Set(['en', 'es', 'pt', 'ru'])

async function handleCallback(cbq: TelegramCallbackQuery) {
  const chatId = cbq.message?.chat.id
  if (!chatId || !cbq.data) return

  await answerCallbackQuery(cbq.id)

  const [action, transcriptionId, lang] = cbq.data.split(':')
  if (!transcriptionId || transcriptionId === 'none') return
  if (lang && !VALID_CALLBACK_LANGS.has(lang)) return

  const admin = createAdminClient()

  // Verify the requesting Telegram user owns this transcription
  const { data: account } = await admin
    .from('telegram_accounts')
    .select('supabase_user_id')
    .eq('telegram_id', cbq.from.id)
    .single()

  if (!account) return

  const { data: transcription } = await admin
    .from('transcriptions')
    .select('result, user_id')
    .eq('id', transcriptionId)
    .eq('user_id', account.supabase_user_id)
    .single()

  if (!transcription?.result) {
    await sendMessage(chatId, 'Transcription not found.')
    return
  }

  const result = transcription.result as TranscriptionResult
  const groqKey = resolveGroqKey(transcription.user_id)
  const ts = fileTimestamp()

  if (action === 'sum') {
    await sendChatAction(chatId, 'typing')
    try {
      const summary = await summariseTranscript(
        result.full_transcript,
        result.language?.split(/[+\-]/)[0] ?? 'en',
        groqKey
      )

      const userLang = cbq.from.language_code ?? 'en'
      const targetLang = getTargetLang(userLang)
      const summaryLang = result.language?.split(/[+\-]/)[0]?.toLowerCase() ?? 'unknown'
      const showTranslate = summaryLang !== targetLang && targetLang in { en: 1, es: 1, pt: 1, ru: 1 }

      const keyboard = showTranslate ? {
        inline_keyboard: [[
          { text: getTranslateLabel(userLang), callback_data: `trs:${transcriptionId}:${targetLang}` },
        ]],
      } : undefined

      await sendTextOrFile(chatId, stripMarkdown(summary ?? 'No summary available.'), `summary_${ts}.txt`, keyboard)
    } catch {
      await sendMessage(chatId, 'Failed to generate summary. Please try again.')
    }
    return
  }

  // Translate summary — re-generates summary in target language
  if (action === 'trs' && lang) {
    await sendChatAction(chatId, 'typing')
    try {
      const summary = await summariseTranscript(result.full_transcript, lang, groqKey)
      await sendTextOrFile(chatId, stripMarkdown(summary), `summary_${ts}.txt`)
    } catch {
      await sendMessage(chatId, 'Failed to translate summary. Please try again.')
    }
    return
  }

  if (action === 'trl' && lang) {
    await sendChatAction(chatId, 'typing')
    try {
      const translation = await translateTranscript(result.full_transcript, lang, groqKey)
      await sendTextOrFile(chatId, translation, `translation_${ts}.txt`)
    } catch {
      await sendMessage(chatId, 'Failed to translate. Please try again.')
    }
  }
}

// ─── Linking ──────────────────────────────────────────────────────────────────

async function handleLinkToken(
  chatId: number,
  telegramId: number,
  username: string | undefined,
  token: string
) {
  const admin = createAdminClient()

  const { data: linkToken } = await admin
    .from('telegram_link_tokens')
    .select('supabase_user_id, expires_at, used')
    .eq('token', token)
    .single()

  if (!linkToken || linkToken.used || new Date(linkToken.expires_at) < new Date()) {
    await sendMessage(chatId,
      'This link has expired or is invalid.\nGenerate a new one at:\n' +
      `${SITE_URL}/billing`
    )
    return
  }

  // Mark token as used
  await admin
    .from('telegram_link_tokens')
    .update({ used: true })
    .eq('token', token)

  // Upsert telegram account
  await admin
    .from('telegram_accounts')
    .upsert({
      telegram_id: telegramId,
      supabase_user_id: linkToken.supabase_user_id,
      telegram_username: username ?? null,
    })

  await sendMessage(chatId,
    '✅ Account connected!\n\nSend me an audio or voice file to get started.'
  )
}

// ─── Welcome ──────────────────────────────────────────────────────────────────

async function sendWelcome(chatId: number) {
  await sendMessage(chatId,
    'Hi! I\'m Transcribo — I turn audio into text.\n\n' +
    'Forward me any voice message or audio file and I\'ll transcribe it with speaker labels. Works with recordings from WhatsApp, iMessage, Telegram, or any app.\n\n' +
    'To get started:\n' +
    `1. Connect your account → ${SITE_URL}/connect-telegram\n` +
    '2. Send or forward an audio file\n' +
    '3. Get the transcript in seconds'
  )
}
