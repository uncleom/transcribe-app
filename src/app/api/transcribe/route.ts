import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '@/lib/supabase/server'
import { uploadAudio, startTranscription } from '@/lib/gladia'

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

  // --- Resolve current user (optional — anonymous upload is allowed) ---
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  // --- Upload to Supabase Storage ---
  const storagePath = `uploads/${Date.now()}_${file.name}`

  const { error: storageError } = await admin.storage
    .from('audio-files')
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (storageError) {
    console.error('Storage upload error:', storageError)
    return NextResponse.json({ error: 'Failed to store file' }, { status: 500 })
  }

  const {
    data: { publicUrl },
  } = admin.storage.from('audio-files').getPublicUrl(storagePath)

  // --- Create transcription record ---
  const { data: transcription, error: insertError } = await admin
    .from('transcriptions')
    .insert({
      file_name: file.name,
      file_url: publicUrl,
      status: 'pending',
      ...(user ? { user_id: user.id } : {}),
    })
    .select('id')
    .single()

  if (insertError || !transcription) {
    console.error('DB insert error:', insertError)
    return NextResponse.json({ error: 'Failed to create transcription record' }, { status: 500 })
  }

  const transcriptionId = transcription.id

  // --- Start Gladia job (upload + kick off) ---
  try {
    const gladiaAudioUrl = await uploadAudio(file, file.name)
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
    await admin
      .from('transcriptions')
      .update({ status: 'error' })
      .eq('id', transcriptionId)

    return NextResponse.json(
      { error: 'Failed to start transcription job' },
      { status: 502 }
    )
  }

  return NextResponse.json({ id: transcriptionId, status: 'processing' }, { status: 202 })
}
