import type { TranscriptionResult, TranscriptionStatus } from '@/types'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          created_at?: string
        }
        Relationships: []
      }
      transcriptions: {
        Row: {
          id: string
          user_id: string | null
          file_name: string
          file_url: string
          duration_seconds: number | null
          language: string | null
          status: TranscriptionStatus
          result: TranscriptionResult | null
          gladia_result_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          file_name: string
          file_url: string
          duration_seconds?: number | null
          language?: string | null
          status?: TranscriptionStatus
          result?: TranscriptionResult | null
          gladia_result_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          file_name?: string
          file_url?: string
          duration_seconds?: number | null
          language?: string | null
          status?: TranscriptionStatus
          result?: TranscriptionResult | null
          gladia_result_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
