'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { TranscriptionResult } from '@/types'
import { mergeUtterances } from '@/lib/transcription'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface TranscriptionData {
  id: string
  file_name: string
  status: 'pending' | 'processing' | 'done' | 'error'
  result: TranscriptionResult | null
}

const SPEAKER_COLORS = [
  '#e2ff00',
  '#60a5fa',
  '#f472b6',
  '#34d399',
  '#fb923c',
  '#a78bfa',
]

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}


// Renders the subset of Markdown that Groq typically produces
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Skip blank lines
    if (line.trim() === '') {
      i++
      continue
    }

    // ## Heading or ### Heading
    if (/^#{1,3} /.test(line)) {
      const content = line.replace(/^#{1,3} /, '')
      elements.push(
        <p key={i} className="mt-4 mb-1 text-sm font-semibold text-white/90">
          {inlineFormat(content)}
        </p>
      )
      i++
      continue
    }

    // Bullet list: collect consecutive - or * lines
    if (/^[-*] /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*] /, ''))
        i++
      }
      elements.push(
        <ul key={i} className="my-2 space-y-1 pl-4">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 text-sm text-white/80">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/30" />
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Numbered list: collect consecutive N. lines
    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      let n = 1
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''))
        i++
        n++
      }
      elements.push(
        <ol key={i} className="my-2 space-y-1 pl-4">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 text-sm text-white/80">
              <span className="flex-shrink-0 text-white/30">{j + 1}.</span>
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ol>
      )
      void n
      continue
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm leading-relaxed text-white/80">
        {inlineFormat(line)}
      </p>
    )
    i++
  }

  return <div className="space-y-1">{elements}</div>
}

// Handles **bold** and *italic* inline
function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-white/95">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="italic">{part.slice(1, -1)}</em>
    }
    return part
  })
}

type ViewTab = 'clean' | 'detailed' | 'summary'

export default function TranscriptionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [data, setData] = useState<TranscriptionData | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [view, setView] = useState<ViewTab>('clean')
  const [summaryLang, setSummaryLang] = useState<string | null>(null)
  const [regeneratedSummary, setRegeneratedSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const MAX_ATTEMPTS = 120

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

  async function regenerateSummary(lang: string) {
    setSummaryLang(lang)
    setSummaryLoading(true)
    setRegeneratedSummary(null)
    try {
      const res = await fetch(`/api/transcribe/${id}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      })
      if (res.ok) {
        const json = await res.json()
        setRegeneratedSummary(json.summary)
      }
    } finally {
      setSummaryLoading(false)
    }
  }

  async function copyAll() {
    if (!data?.result) return
    const r = data.result
    let text = ''
    if (view === 'clean') {
      text = mergeUtterances(r.utterances)
        .map((u) => `[Speaker ${u.speaker}] ${u.text}`)
        .join('\n\n')
    } else if (view === 'detailed') {
      text = r.utterances
        .map((u) => `[Speaker ${u.speaker}] [${formatTime(u.start)}–${formatTime(u.end)}] ${u.text}`)
        .join('\n\n')
    } else if (view === 'summary') {
      text = (regeneratedSummary ?? r.summary) ?? ''
    }
    if (!text) return
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  if (fetchError) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-400">{fetchError}</p>
        <button onClick={() => router.push('/')} className="text-sm text-white/50 underline hover:text-white/80">
          Back to home
        </button>
      </main>
    )
  }

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

  if (data.status === 'error' || !data.result) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-400">Transcription failed.</p>
        <button onClick={() => router.push('/')} className="text-sm text-white/50 underline hover:text-white/80">
          Try again
        </button>
      </main>
    )
  }

  const { result } = data
  const merged = mergeUtterances(result.utterances)
  const hasSummary = !!result.summary
  const displayedSummary = regeneratedSummary ?? result.summary

  const SUMMARY_LANGS = [
    { code: 'en', label: 'EN' },
    { code: 'es', label: 'ES' },
    { code: 'pt', label: 'PT' },
    { code: 'ru', label: 'RU' },
  ]

  return (
    <main className="flex-1 px-4 py-10">
      <div className="mx-auto max-w-2xl">

        {/* Back link — top */}
        <button
          onClick={() => router.push('/history')}
          className="mb-5 flex items-center gap-1 text-sm text-white/30 transition hover:text-white/60"
        >
          ← Transcriptions
        </button>

        {/* Header row */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-white">{data.file_name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.language && (
                <Badge className="bg-white/8 text-white/60 border-transparent uppercase tracking-wider hover:bg-white/8">
                  {result.language}
                </Badge>
              )}
              {result.duration > 0 && (
                <Badge className="bg-white/8 text-white/60 border-transparent hover:bg-white/8">
                  {formatTime(result.duration)}
                </Badge>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            onClick={copyAll}
            className="flex-shrink-0 border-white/15 text-white/60 hover:border-white/30 hover:text-white hover:bg-transparent"
          >
            Copy all
          </Button>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as ViewTab)}>
          <TabsList className="mb-6 flex w-fit gap-1 rounded-lg bg-white/5 p-1 h-auto">
            <TabsTrigger
              value="clean"
              className="rounded-md px-4 py-1.5 text-sm data-active:bg-[#e2ff00]/10 data-active:text-[#e2ff00]"
            >
              Text
            </TabsTrigger>
            <TabsTrigger
              value="detailed"
              className="rounded-md px-4 py-1.5 text-sm data-active:bg-[#e2ff00]/10 data-active:text-[#e2ff00]"
            >
              Timestamps
            </TabsTrigger>
            {hasSummary && (
              <TabsTrigger
                value="summary"
                className="rounded-md px-4 py-1.5 text-sm data-active:bg-[#e2ff00]/10 data-active:text-[#e2ff00]"
              >
                Summary
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="clean">
            <div className="flex flex-col gap-2">
              {merged.map((u, i) => {
                const color = SPEAKER_COLORS[u.speaker % SPEAKER_COLORS.length]
                return (
                  <div key={i} className="flex gap-3 rounded-lg px-3 py-2.5 -mx-3 transition hover:bg-white/[0.025]">
                    <div className="flex-shrink-0 pt-0.5">
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold text-black"
                        style={{ backgroundColor: color }}
                      >
                        S{u.speaker}
                      </span>
                    </div>
                    <p className="min-w-0 flex-1 text-sm leading-relaxed text-white/85">{u.text}</p>
                  </div>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="detailed">
            <div className="flex flex-col gap-2">
              {result.utterances.map((u, i) => {
                const color = SPEAKER_COLORS[u.speaker % SPEAKER_COLORS.length]
                return (
                  <div key={i} className="flex gap-3 rounded-lg px-3 py-2.5 -mx-3 transition hover:bg-white/[0.025]">
                    <div className="flex-shrink-0 pt-0.5">
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold text-black"
                        style={{ backgroundColor: color }}
                      >
                        S{u.speaker}
                      </span>
                    </div>
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
          </TabsContent>

          {hasSummary && (
            <TabsContent value="summary">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-xs text-white/35">Language:</span>
                <div className="flex gap-1">
                  {SUMMARY_LANGS.map(({ code, label }) => (
                    <button
                      key={code}
                      onClick={() => regenerateSummary(code)}
                      disabled={summaryLoading}
                      className={[
                        'rounded-md px-2.5 py-1 text-xs font-medium transition',
                        summaryLang === code
                          ? 'bg-[#e2ff00]/15 text-[#e2ff00]'
                          : 'text-white/40 hover:bg-white/8 hover:text-white/70',
                        summaryLoading ? 'cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {summaryLoading && (
                  <div className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/60" />
                )}
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-6">
                {summaryLoading
                  ? <p className="text-sm text-white/30 animate-pulse">Generating summary…</p>
                  : renderMarkdown(displayedSummary!)}
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Back link — bottom */}
        <div className="mt-14 text-center">
          <button
            onClick={() => router.push('/history')}
            className="text-sm text-white/25 transition hover:text-white/55"
          >
            ← Transcriptions
          </button>
        </div>

      </div>
    </main>
  )
}
