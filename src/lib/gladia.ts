import type {
  GladiaTranscriptionRequest,
  GladiaPollingResult,
  TranscriptionResult,
  TranscriptionUtterance,
} from '@/types'

const BASE_URL = 'https://api.gladia.io/v2'
const POLL_INTERVAL_MS = 5_000
const MAX_POLL_ATTEMPTS = 60

function headers() {
  return {
    'x-gladia-key': process.env.GLADIA_API_KEY!,
    'Content-Type': 'application/json',
  }
}

/** Upload a file to Gladia and return its hosted audio_url */
export async function uploadAudio(file: File | Blob, fileName: string): Promise<string> {
  const form = new FormData()
  form.append('audio', file, fileName)

  const res = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: { 'x-gladia-key': process.env.GLADIA_API_KEY! },
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gladia upload failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.audio_url as string
}

/** Start an async transcription job and return the result_url to poll */
export async function startTranscription(
  request: GladiaTranscriptionRequest
): Promise<string> {
  const res = await fetch(`${BASE_URL}/transcription`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(request),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gladia transcription start failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.result_url as string
}

/** Check status of a transcription job once — no retry loop */
export async function checkTranscriptionStatus(resultUrl: string): Promise<GladiaPollingResult> {
  const res = await fetch(resultUrl, { headers: headers() })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gladia status check failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<GladiaPollingResult>
}

/** Poll result_url until done or error, then return the raw Gladia result */
export async function pollTranscription(resultUrl: string): Promise<GladiaPollingResult> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS)

    const res = await fetch(resultUrl, { headers: headers() })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Gladia polling failed (${res.status}): ${text}`)
    }

    const data: GladiaPollingResult = await res.json()

    if (data.status === 'done') return data
    if (data.status === 'error') {
      throw new Error(`Gladia transcription error: ${data.error?.message ?? 'unknown'}`)
    }
  }

  throw new Error(`Gladia transcription timed out after ${MAX_POLL_ATTEMPTS} attempts`)
}

/** Full pipeline: upload → start → poll → normalise result */
export async function transcribeFile(
  file: File | Blob,
  fileName: string
): Promise<TranscriptionResult> {
  const audioUrl = await uploadAudio(file, fileName)

  const request: GladiaTranscriptionRequest = {
    audio_url: audioUrl,
    diarization: true,
  }

  const resultUrl = await startTranscription(request)
  const gladiaResult = await pollTranscription(resultUrl)

  return normaliseResult(gladiaResult)
}

export function normaliseResult(raw: GladiaPollingResult): TranscriptionResult {
  const transcription = raw.result!.transcription
  const metadata = raw.result!.metadata

  const utterances: TranscriptionUtterance[] = transcription.utterances.map((u) => ({
    speaker: u.speaker,
    start: u.start,
    end: u.end,
    text: u.text,
    confidence: u.confidence,
    language: u.language,
  }))

  return {
    utterances,
    full_transcript: transcription.full_transcript,
    summary: null,
    language: transcription.languages[0] ?? 'unknown',
    duration: metadata.audio_duration,
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
