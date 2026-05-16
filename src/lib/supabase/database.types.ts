import type { TranscriptionResult, TranscriptionStatus } from '@/types'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          credits_seconds: number
          is_unlimited: boolean
          created_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          credits_seconds?: number
          is_unlimited?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          credits_seconds?: number
          is_unlimited?: boolean
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
          reserved_seconds: number | null
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
          reserved_seconds?: number | null
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
          reserved_seconds?: number | null
          created_at?: string
        }
        Relationships: []
      }
      anonymous_usage: {
        Row: {
          ip: string
          used_seconds: number
          updated_at: string
        }
        Insert: {
          ip: string
          used_seconds?: number
          updated_at?: string
        }
        Update: {
          ip?: string
          used_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_accounts: {
        Row: {
          telegram_id: number
          supabase_user_id: string
          telegram_username: string | null
          created_at: string
        }
        Insert: {
          telegram_id: number
          supabase_user_id: string
          telegram_username?: string | null
          created_at?: string
        }
        Update: {
          telegram_id?: number
          supabase_user_id?: string
          telegram_username?: string | null
          created_at?: string
        }
        Relationships: []
      }
      telegram_link_tokens: {
        Row: {
          token: string
          supabase_user_id: string
          expires_at: string
          used: boolean
          created_at: string
        }
        Insert: {
          token: string
          supabase_user_id: string
          expires_at: string
          used?: boolean
          created_at?: string
        }
        Update: {
          token?: string
          supabase_user_id?: string
          expires_at?: string
          used?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      reserve_user_credits: {
        Args: { p_user_id: string; p_seconds: number }
        Returns: boolean
      }
      reserve_anon_credits: {
        Args: { p_ip: string; p_seconds: number }
        Returns: boolean
      }
      adjust_user_credits: {
        Args: { p_user_id: string; p_reserved: number; p_actual: number }
        Returns: undefined
      }
      adjust_anon_credits: {
        Args: { p_ip: string; p_reserved: number; p_actual: number }
        Returns: undefined
      }
      refund_user_credits: {
        Args: { p_user_id: string; p_reserved: number }
        Returns: undefined
      }
      refund_anon_credits: {
        Args: { p_ip: string; p_reserved: number }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
  }
}
