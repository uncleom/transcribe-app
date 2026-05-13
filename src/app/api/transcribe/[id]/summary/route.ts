import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '@/lib/supabase/server'
import { summariseTranscript } from '@/lib/groq'
import type { TranscriptionResult } from '@/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_LANGS = new Set(['en', 'es', 'pt', 'ru'])

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let language = 'en'
  try {
    const body = await req.json()
    if (typeof body.language === 'string' && VALID_LANGS.has(body.language)) {
      language = body.language
    }
  } catch {
    // use default
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('transcriptions')
    .select('status, result, user_id')
    .eq('id', id)
    .single()

  if (error || !data || data.status !== 'done' || !data.result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (data.user_id && (!user || user.id !== data.user_id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const result = data.result as TranscriptionResult
  if (!result.full_transcript) {
    return NextResponse.json({ error: 'No transcript available' }, { status: 422 })
  }

  try {
    const summary = await summariseTranscript(result.full_transcript, language)
    return NextResponse.json({ summary })
  } catch (err) {
    console.error('Summary regeneration error:', err)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 502 })
  }
}
