'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { TranscriptionResult } from '@/types'

interface TranscriptionData {
  id: string
  file_name: string
  status: 'pending' | 'processing' | 'done' | 'error'
  result: TranscriptionResult | null
}

// Colours cycling by speaker index
const SPEAKER_COLORS = [
  '#e2ff00', // yellow — accent
  '#60a5fa', // blue
  '#f472b6', // pink
  '#34d399', // green
  '#fb923c', // orange
  '#a78bfa', // purple
]

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TranscriptionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [data, setData] = useState<TranscriptionData | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const MAX_ATTEMPTS = 120 // 10 min at 5s intervals

    async function tick() {
      if (attempts++ >= MAX_ATTEMPTS) {
        if (!cancelled) setFetchError('Transcription timed out — please try again')
        return
      }

      try {
        const res = await fetch(`/api/transcribe/${id}`)
        if (!res.ok) {
          const json = await res.json()
          if (!cancelled) setFetchError(json.error ?? 'Failed to load transcription')
          return
        }
        const json: TranscriptionData = await res.json()
        if (cancelled) return

        setData(json)

        if (json.status !== 'done' && json.status !== 'error') {
          setTimeout(tick, 5_000)
        }
      } catch {
        if (!cancelled) setFetchError('Network error — please refresh')
      }
    }

    tick()
    return () => { cancelled = true }
  }, [id])

  async function copyAll() {
    if (!data?.result) return
    const text = data.result.utterances
      .map((u) => `[Speaker ${u.speaker}] ${u.text}`)
      .join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2_000)
  }

  // ── Error state ──────────────────────────────────────────────
  if (fetchError) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-400">{fetchError}</p>
        <button
          onClick={() => router.push('/')}
          className="text-sm text-white/50 underline hover:text-white/80"
        >
          Back to home
        </button>
      </main>
    )
  }

  // ── Loading / processing state ───────────────────────────────
  if (!data || data.status === 'pending' || data.status === 'processing') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[#e2ff00]" />
        <div className="text-center">
          <p className="text-sm font-medium text-white/70">Transcribing…</p>
          {data?.file_name && (
            <p className="mt-1 max-w-xs truncate text-xs text-white/35">{data.file_name}</p>
          )}
        </div>
      </main>
    )
  }

  // ── Failed transcription ─────────────────────────────────────
  if (data.status === 'error' || !data.result) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-400">Transcription failed.</p>
        <button
          onClick={() => router.push('/')}
          className="text-sm text-white/50 underline hover:text-white/80"
        >
          Try again
        </button>
      </main>
    )
  }

  // ── Done ─────────────────────────────────────────────────────
  const { result } = data

  return (
    <main className="flex-1 px-4 py-10">
      <div className="mx-auto max-w-2xl">

        {/* Header row */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-white">
              {data.file_name}
            </h1>
            {/* Language + duration pills */}
            <div className="mt-2 flex flex-wrap gap-2">
              {result.language && (
                <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/60">
                  {result.language}
                </span>
              )}
              {result.duration > 0 && (
                <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-medium text-white/60">
                  {formatTime(result.duration)}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={copyAll}
            className="flex-shrink-0 rounded-lg border border-white/15 px-4 py-2 text-sm text-white/60 transition hover:border-white/30 hover:text-white"
          >
            {copied ? 'Copied!' : 'Copy all'}
          </button>
        </div>

        {/* Summary */}
        {result.summary && (
          <div className="mb-8 rounded-xl border border-[#e2ff00]/25 bg-[#e2ff00]/[0.05] p-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#e2ff00]/70">
              Summary
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">
              {result.summary}
            </p>
          </div>
        )}

        {/* Utterances */}
        <div className="flex flex-col gap-5">
          {result.utterances.map((u, i) => {
            const color = SPEAKER_COLORS[u.speaker % SPEAKER_COLORS.length]
            return (
              <div key={i} className="flex gap-3">
                {/* Speaker badge */}
                <div className="flex-shrink-0 pt-0.5">
                  <span
                    className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold text-black"
                    style={{ backgroundColor: color }}
                  >
                    S{u.speaker}
                  </span>
                </div>

                {/* Text + timestamp */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-white/85">{u.text}</p>
                  <p className="mt-1 text-xs text-white/25">
                    {formatTime(u.start)}–{formatTime(u.end)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="mt-14 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-white/25 transition hover:text-white/55"
          >
            ← New transcription
          </button>
        </div>

      </div>
    </main>
  )
}
