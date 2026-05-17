'use client'

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react'

interface Props {
  onUploadComplete: (id: string) => void
  initialFile?: File
}

type State =
  | 'idle'
  | 'dragging'
  | 'detecting'       // measuring duration
  | 'checking'        // calling /api/credits
  | 'selected'        // ready to upload
  | 'insufficient'    // not enough credits
  | 'uploading'
  | 'error'

export default function UploadZone({ onUploadComplete, initialFile }: Props) {
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
        setErrorMsg('Unexpected server response')
        setState('error')
        return
      }

      if (xhr.status === 202 && json.id) {
        onUploadComplete(json.id)
      } else if (xhr.status === 402 || json.code === 'credits_insufficient') {
        setState('insufficient')
      } else {
        setErrorMsg(json.error ?? `Upload failed (${xhr.status})`)
        setState('error')
      }
    })

    xhr.addEventListener('error', () => {
      setErrorMsg('Network error — check your connection')
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
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload audio or video file"
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

        {/* Icon */}
        <div
          className={[
            'flex h-14 w-14 items-center justify-center rounded-full transition-colors',
            isDragging ? 'bg-[#e2ff00]/15' : 'bg-white/8',
          ].join(' ')}
        >
          <UploadIcon className={isDragging ? 'text-[#e2ff00]' : 'text-white/40'} />
        </div>

        {/* Labels */}
        {!file ? (
          <>
            <p className="font-medium text-white/80">Drop audio or video here</p>
            <p className="text-sm text-white/35">
              or click to browse · MP3, MP4, WAV, M4A, OGG, FLAC · up to 500 MB
            </p>
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
              {isDetecting && <span className="animate-pulse">detecting…</span>}
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {isUploading && (
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs text-white/40">
            <span>Uploading…</span>
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

      {/* Error */}
      {state === 'error' && errorMsg && (
        <p className="mt-3 text-sm text-red-400">{errorMsg}</p>
      )}

      {/* Insufficient credits */}
      {state === 'insufficient' && (
        <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
          <p className="text-sm text-yellow-300">
            Not enough credits for this file
            {durationSecs != null && ` (${formatDuration(durationSecs)})`}.
          </p>
          <a
            href="/billing"
            className="mt-2 inline-block text-sm font-medium text-[#e2ff00] hover:opacity-80 transition"
          >
            Top up credits →
          </a>
        </div>
      )}

      {/* Transcribe button */}
      {state === 'selected' && (
        <button
          onClick={startUpload}
          className="mt-4 w-full rounded-xl bg-[#e2ff00] py-3.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 active:opacity-80"
        >
          Transcribe
        </button>
      )}

      {/* Retry button */}
      {state === 'error' && (
        <button
          onClick={() => { setState('selected'); setErrorMsg(null) }}
          className="mt-3 w-full rounded-xl border border-white/15 py-3 text-sm text-white/60 transition hover:border-white/25 hover:text-white/80"
        >
          Try again
        </button>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Detect audio/video duration via HTMLVideoElement (works for both media types). */
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
