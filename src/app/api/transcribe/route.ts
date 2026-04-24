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

// Sanitize uploaded filename: strip path, allow only safe chars, bound length.
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
  const durationHint = durationHintRaw
    ? Math.max(1, Math.round(Number(durationHintRaw)))
    : 60 // conservative fallback if client didn't send

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

  const admin = createAdminClient()

  // --- Upload to Supabase Storage (private bucket — see SPECIFICATION §4.1) ---
  const safeName = sanitizeFilename(file.name)
  const storagePath = `uploads/${Date.now()}_${safeName}`

  const { error: storageError } = await admin.storage
    .from('audio-files')
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (storageError) {
    console.error('Storage upload error:', storageError)
    await refundCredits(subject, durationHint)
    return NextResponse.json({ error: 'Failed to store file' }, { status: 500 })
  }

  // Store only the storage path; signed URLs are minted on demand by owner-checked endpoints.
  // --- Create transcription record ---
  const { data: transcription, error: insertError } = await admin
    .from('transcriptions')
    .insert({
      file_name: safeName,
      file_url: storagePath,
      status: 'pending',
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

  const transcriptionId = transcription.id

  // --- Start Gladia job ---
  try {
    const gladiaAudioUrl = await uploadAudio(file, safeName)
    const resultUrl = await startTranscription({
      audio_url: gladiaAudioUrl,
      diarization: true,
    })

    await admin
      .from('transcriptions')
      .update({ status: 'processing', gladia_result_url: resultUrl })
      .eq('id', transcriptionId)
  } catch (err) {
    console.error('Gladia start error:', err)
    await admin.from('transcriptions').update({ status: 'error' }).eq('id', transcriptionId)
    await refundCredits(subject, durationHint)

    return NextResponse.json(
      { error: 'Failed to start transcription job' },
      { status: 502 }
    )
  }

  return NextResponse.json({ id: transcriptionId, status: 'processing' }, { status: 202 })
}
