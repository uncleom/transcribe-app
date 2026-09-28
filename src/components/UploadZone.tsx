'use client'

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

interface Props {
  onUploadComplete: (id: string) => void
  initialFile?: File
}

type State =
  | 'idle'
  | 'dragging'
  | 'detecting'
  | 'checking'
  | 'selected'
  | 'insufficient'
  | 'uploading'
  | 'error'

export default function UploadZone({ onUploadComplete, initialFile }: Props) {
  const t = useTranslations('Upload')
  const [state, setState] = useState<State>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [durationSecs, setDurationSecs] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialFile && state === 'idle') selectFile(initialFile)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile])

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setState('dragging')
  }

  function handleDragLeave() {
    setState(file ? 'selected' : 'idle')
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) selectFile(f)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) selectFile(f)
  }

  async function selectFile(f: File) {
    setFile(f)
    setState('detecting')
    setErrorMsg(null)
    setDurationSecs(null)

    let duration: number | null = null
    try {
      duration = await detectDuration(f)
      setDurationSecs(duration)
    } catch {
      // Duration detection failed — proceed without it, server uses fallback
    }

    setState('checking')
    try {
      const durationParam = duration != null ? `?duration=${Math.ceil(duration)}` : ''
      const res = await fetch(`/api/credits${durationParam}`)
      if (res.ok) {
        const json: { sufficient: boolean } = await res.json()
        setState(json.sufficient ? 'selected' : 'insufficient')
        return
      }
    } catch {
      // If credits check fails, allow upload (graceful degradation)
    }
    setState('selected')
  }

  function startUpload() {
    if (!file) return
    setState('uploading')
    setProgress(0)
    setErrorMsg(null)

    const form = new FormData()
    form.append('file', file)
    if (durationSecs != null) {
      form.append('duration_hint', String(Math.ceil(durationSecs)))
    }

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      let json: { id?: string; error?: string; code?: string }
      try {
        json = JSON.parse(xhr.responseText)
      } catch {
        setErrorMsg(t('unexpectedResponse'))
        setState('error')
        return
      }

      if (xhr.status === 202 && json.id) {
        onUploadComplete(json.id)
      } else if (xhr.status === 402 || json.code === 'credits_insufficient') {
        setState('insufficient')
      } else {
        setErrorMsg(json.error ?? t('uploadFailed', { status: xhr.status }))
        setState('error')
      }
    })

    xhr.addEventListener('error', () => {
      setErrorMsg(t('networkError'))
      setState('error')
    })

    xhr.open('POST', '/api/transcribe')
    xhr.send(form)
  }

  const isDragging = state === 'dragging'
  const isUploading = state === 'uploading'
  const isDetecting = state === 'detecting' || state === 'checking'

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        aria-label={t('ariaLabel')}
        onClick={() => !isUploading && !isDetecting && inputRef.current?.click()}
        onKeyDown={(e) =>
          e.key === 'Enter' && !isUploading && !isDetecting && inputRef.current?.click()
        }
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'relative flex flex-col items-center justify-center gap-4',
          'rounded-2xl border-2 border-dashed px-8 py-16 text-center',
          'transition-all duration-150 select-none outline-none',
          isUploading || isDetecting
            ? 'cursor-default border-white/10'
            : 'cursor-pointer focus-visible:ring-2 focus-visible:ring-[#e2ff00]/50',
          isDragging
            ? 'border-[#e2ff00] bg-[#e2ff00]/5 shadow-[0_0_40px_rgba(226,255,0,0.08)]'
            : !isUploading && !isDetecting
            ? 'border-white/20 hover:border-white/35 hover:bg-white/[0.02]'
            : 'border-white/10',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,video/*,.mp3,.mp4,.m4a,.wav,.ogg,.opus,.flac,.aac,.webm,.mov"
          className="hidden"
          onChange={handleChange}
          disabled={isUploading || isDetecting}
        />

        <div
          className={[
            'flex h-14 w-14 items-center justify-center rounded-full transition-colors',
            isDragging ? 'bg-[#e2ff00]/15' : 'bg-white/8',
          ].join(' ')}
        >
          <UploadIcon className={isDragging ? 'text-[#e2ff00]' : 'text-white/40'} />
        </div>

        {!file ? (
          <>
            <p className="font-medium text-white/80">{t('dropHere')}</p>
            <p className="text-sm text-white/35">{t('browseHint')}</p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <p className="max-w-xs truncate font-medium text-white">{file.name}</p>
            <div className="flex items-center gap-2 text-sm text-white/40">
              <span>{formatBytes(file.size)}</span>
              {durationSecs != null && (
                <>
                  <span className="text-white/20">·</span>
                  <span>{formatDuration(durationSecs)}</span>
                </>
              )}
              {isDetecting && <span className="animate-pulse">{t('detecting')}</span>}
            </div>
          </div>
        )}
      </div>

      {isUploading && (
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs text-white/40">
            <span>{t('uploading')}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#e2ff00] transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {state === 'error' && errorMsg && (
        <p className="mt-3 text-sm text-red-400">{errorMsg}</p>
      )}

      {state === 'insufficient' && (
        <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
          <p className="text-sm text-yellow-300">
            {durationSecs != null
              ? t('notEnoughCreditsWithDuration', { duration: formatDuration(durationSecs) })
              : t('notEnoughCredits')}
          </p>
          <Link
            href="/billing"
            className="mt-2 inline-block text-sm font-medium text-[#e2ff00] hover:opacity-80 transition"
          >
            {t('topUp')}
          </Link>
        </div>
      )}

      {state === 'selected' && (
        <Button
          onClick={startUpload}
          className="mt-4 w-full rounded-xl bg-[#e2ff00] py-3.5 text-sm font-semibold text-black hover:opacity-90 hover:bg-[#e2ff00] active:opacity-80"
        >
          {t('transcribe')}
        </Button>
      )}

      {state === 'error' && (
        <Button
          variant="outline"
          onClick={() => { setState('selected'); setErrorMsg(null) }}
          className="mt-3 w-full rounded-xl border-white/15 py-3 text-white/60 hover:border-white/25 hover:text-white/80 hover:bg-transparent"
        >
          {t('tryAgain')}
        </Button>
      )}
    </div>
  )
}

function detectDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement('video')
    el.preload = 'metadata'

    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      if (isFinite(el.duration) && el.duration > 0) {
        resolve(el.duration)
      } else {
        reject(new Error('Could not determine duration'))
      }
    }

    el.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Media load error'))
    }

    el.src = url
  })
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}
