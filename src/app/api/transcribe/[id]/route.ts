import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '@/lib/supabase/server'
import { checkTranscriptionStatus } from '@/lib/gladia'
import { finaliseGladiaResult } from '@/lib/transcription'
import { adjustCredits, refundCredits, getClientIp, type CreditSubject } from '@/lib/credits'


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('transcriptions')
    .select('id, file_name, status, result, gladia_result_url, language, user_id, reserved_seconds')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Owner check: auth transcriptions are bound to user_id; anon transcriptions
  // fall back to unguessable-UUID secrecy (no IP recorded in DB schema — see AUDIT A1).
  // Return 404 rather than 403 to avoid revealing existence.
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (data.user_id && (!user || user.id !== data.user_id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Determine credit subject from stored user_id or request IP
  const subject: CreditSubject = data.user_id
    ? { type: 'user', id: data.user_id }
    : { type: 'anon', ip: getClientIp(req) }

  // Already in terminal state — return stored data
  if (data.status === 'done' || data.status === 'error') {
    return NextResponse.json({
      id: data.id,
      file_name: data.file_name,
      status: data.status,
      result: data.result,
    })
  }

  // Still in-flight — ping Gladia once
  if (data.gladia_result_url) {
    try {
      const gladiaStatus = await checkTranscriptionStatus(data.gladia_result_url)

      if (gladiaStatus.status === 'done') {
        const result = await finaliseGladiaResult(gladiaStatus)

        await admin
          .from('transcriptions')
          .update({
            status: 'done',
            result,
            language: result.language,
            duration_seconds: result.duration,
          })
          .eq('id', id)

        // Adjust credits: reserved hint → actual Gladia duration
        const reserved = data.reserved_seconds ?? Math.ceil(result.duration)
        const actual = Math.ceil(result.duration)
        await adjustCredits(subject, reserved, actual).catch((err) =>
          console.error('adjustCredits failed:', err)
        )

        return NextResponse.json({
          id: data.id,
          file_name: data.file_name,
          status: 'done',
          result,
        })
      }

      if (gladiaStatus.status === 'error') {
        await admin.from('transcriptions').update({ status: 'error' }).eq('id', id)

        // Refund reserved seconds
        const reserved = data.reserved_seconds ?? 0
        if (reserved > 0) {
          await refundCredits(subject, reserved).catch((err) =>
            console.error('refundCredits failed:', err)
          )
        }

        return NextResponse.json({
          id: data.id,
          file_name: data.file_name,
          status: 'error',
          result: null,
        })
      }
    } catch (err) {
      console.error('Gladia status check error:', err)
    }
  }

  return NextResponse.json({
    id: data.id,
    file_name: data.file_name,
    status: data.status,
    result: null,
  })
}
