export type TranscriptionStatus = 'pending' | 'processing' | 'done' | 'error'

export interface Profile {
  id: string
  email: string
  display_name: string | null
  created_at: string
}

export interface Transcription {
  id: string
  user_id: string
  file_name: string
  file_url: string
  duration_seconds: number | null
  language: string | null
  status: TranscriptionStatus
  result: TranscriptionResult | null
  created_at: string
}

// Gladia result structures
export interface TranscriptionUtterance {
  speaker: number
  start: number
  end: number
  text: string
  confidence: number
  language: string
}

export interface TranscriptionResult {
  utterances: TranscriptionUtterance[]
  full_transcript: string
  summary: string | null
  language: string
  duration: number
}

// Gladia API types
export interface GladiaTranscriptionRequest {
  audio_url: string
  diarization: boolean
  diarization_config?: {
    number_of_speakers?: number
    min_speakers?: number
    max_speakers?: number
  }
  language_config?: {
    languages?: string[]
    code_switching?: boolean
  }
}

export interface GladiaPollingResult {
  id: string
  status: 'queued' | 'processing' | 'done' | 'error'
  result?: {
    transcription: {
      full_transcript: string
      utterances: Array<{
        speaker: number
        start: number
        end: number
        text: string
        confidence: number
        language: string
      }>
      languages: string[]
    }
    metadata: {
      audio_duration: number
      number_of_distinct_channels: number
      billing_time: number
    }
  }
  error?: {
    message: string
  }
}
