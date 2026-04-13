import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { checkTranscriptionStatus, normaliseResult } from '@/lib/gladia'
import { summariseTranscript } from '@/lib/groq'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('transcriptions')
    .select('id, file_name, status, result, gladia_result_url, language')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Already in terminal state — return stored data
  if (data.status === 'done' || data.status === 'error') {
    return NextResponse.json({
      id: data.id,
      file_name: data.file_name,
      status: data.status,
      result: data.result,
    })
  }

  // Still in-flight — ping Gladia once to get latest status
  if (data.gladia_result_url) {
    try {
      const gladiaStatus = await checkTranscriptionStatus(data.gladia_result_url)

      if (gladiaStatus.status === 'done') {
        const result = normaliseResult(gladiaStatus)

        // Generate summary (best-effort — don't fail the whole request)
        try {
          result.summary = await summariseTranscript(result.full_transcript, result.language)
        } catch (err) {
          console.error('Summary generation failed:', err)
        }

        await admin
          .from('transcriptions')
          .update({
            status: 'done',
            result,
            language: result.language,
            duration_seconds: result.duration,
          })
          .eq('id', id)

        return NextResponse.json({
          id: data.id,
          file_name: data.file_name,
          status: 'done',
          result,
        })
      }

      if (gladiaStatus.status === 'error') {
        await admin.from('transcriptions').update({ status: 'error' }).eq('id', id)

        return NextResponse.json({
          id: data.id,
          file_name: data.file_name,
          status: 'error',
          result: null,
        })
      }
    } catch (err) {
      console.error('Gladia status check error:', err)
      // Fall through — return current DB status
    }
  }

  return NextResponse.json({
    id: data.id,
    file_name: data.file_name,
    status: data.status,
    result: null,
  })
}
