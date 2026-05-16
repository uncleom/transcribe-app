// Shared transcription processing pipeline.
// Used by both the web API routes and the Telegram bot — any change here affects both.

import { normaliseResult, transcribeFile, type GladiaPollingResult } from '@/lib/gladia'
import { summariseTranscript } from '@/lib/groq'
import type { TranscriptionResult, TranscriptionUtterance } from '@/types'

export interface MergedUtterance {
  speaker: number
  text: string
  start: number
  end: number
}

// ─── Core pipeline steps ──────────────────────────────────────────────────────

/**
 * Step 1 (website): called after Gladia returns done status.
 * Normalises the raw Gladia result and generates a summary.
 */
export async function finaliseGladiaResult(raw: GladiaPollingResult): Promise<TranscriptionResult> {
  const result = normaliseResult(raw)
  await addSummary(result)
  return result
}

/**
 * Step 1 (bot): full pipeline — upload file to Gladia, poll, normalise, summarise.
 */
export async function processFile(file: File | Blob, fileName: string): Promise<TranscriptionResult> {
  const result = await transcribeFile(file, fileName)
  await addSummary(result)
  return result
}

async function addSummary(result: TranscriptionResult): Promise<void> {
  try {
    result.summary = await summariseTranscript(result.full_transcript, result.language)
  } catch (err) {
    console.error('Summary generation failed (non-fatal):', err)
  }
}

// ─── Formatting utilities ─────────────────────────────────────────────────────

/**
 * Merge consecutive utterances from the same speaker.
 * Used by the web frontend and the bot when formatting transcript text.
 */
export function mergeUtterances(utterances: TranscriptionUtterance[]): MergedUtterance[] {
  return utterances.reduce<MergedUtterance[]>((acc, u) => {
    const last = acc[acc.length - 1]
    if (last && last.speaker === u.speaker) {
      last.text += ' ' + u.text
      last.end = u.end
    } else {
      acc.push({ speaker: u.speaker, text: u.text, start: u.start, end: u.end })
    }
    return acc
  }, [])
}

/**
 * Format a transcript as plain text with speaker labels.
 * Used by the bot and the "Copy all" action on the Text tab.
 */
export function formatTranscriptText(utterances: TranscriptionUtterance[]): string {
  return mergeUtterances(utterances)
    .map(u => `[Speaker ${u.speaker}] ${u.text}`)
    .join('\n\n')
}
