import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '@/lib/supabase/server'
import { uploadAudio, startTranscription } from '@/lib/gladia'
import {
  reserveCredits,
  refundCredits,
  CreditsInsufficientError,
  getClientIp,
  type CreditSubject,
} from '@/lib/credits'

const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB

function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'file'
  return (
    base
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^\.+/, '_')
      .slice(0, 100) || 'file'
  )
}

export async function POST(req: NextRequest) {
  // --- Parse form data ---
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Field "file" is required' }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 422 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 500 MB limit' }, { status: 413 })
  }

  // --- Parse duration hint ---
  const durationHintRaw = formData.get('duration_hint')
  let durationHint = 60 // conservative fallback
  if (durationHintRaw !== null) {
    const parsed = Math.round(Number(durationHintRaw))
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 14400) {
      durationHint = parsed
    }
  }

  // --- Resolve identity ---
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const subject: CreditSubject = user
    ? { type: 'user', id: user.id }
    : { type: 'anon', ip: getClientIp(req) }

  // --- Reserve credits ---
  try {
    await reserveCredits(subject, durationHint)
  } catch (err) {
    if (err instanceof CreditsInsufficientError) {
      return NextResponse.json(
        { error: 'Insufficient credits', code: 'credits_insufficient' },
        { status: 402 }
      )
    }
    console.error('Reserve credits error:', err)
    return NextResponse.json({ error: 'Failed to reserve credits' }, { status: 500 })
  }

  const safeName = sanitizeFilename(file.name)

  // --- Upload to Gladia and start transcription job ---
  let gladiaAudioUrl: string
  let resultUrl: string
  try {
    gladiaAudioUrl = await uploadAudio(file, safeName)
    resultUrl = await startTranscription({
      audio_url: gladiaAudioUrl,
      diarization: true,
    })
  } catch (err) {
    console.error('Gladia error:', err)
    await refundCredits(subject, durationHint)
    return NextResponse.json({ error: 'Failed to start transcription job' }, { status: 502 })
  }

  // --- Create transcription record ---
  const admin = createAdminClient()
  const { data: transcription, error: insertError } = await admin
    .from('transcriptions')
    .insert({
      file_name: safeName,
      file_url: gladiaAudioUrl,
      status: 'processing',
      gladia_result_url: resultUrl,
      reserved_seconds: durationHint,
      ...(user ? { user_id: user.id } : {}),
    })
    .select('id')
    .single()

  if (insertError || !transcription) {
    console.error('DB insert error:', insertError)
    await refundCredits(subject, durationHint)
    return NextResponse.json({ error: 'Failed to create transcription record' }, { status: 500 })
  }

  return NextResponse.json({ id: transcription.id, status: 'processing' }, { status: 202 })
}
