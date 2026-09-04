'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  onFileReady: (file: File) => void
}

type RecordState = 'idle' | 'requesting' | 'recording' | 'done' | 'error'

/** Virtual/loopback devices produce timed silence — Gladia returns empty transcripts. */
const VIRTUAL_MIC_RE =
  /blackhole|soundflower|loopback|vb-?audio|cable\b|aggregate|multi-?output|virtual/i

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    // Require AAC explicitly — bare audio/mp4 can be Opus-in-MP4 on Chrome (unplayable).
    'audio/mp4;codecs=mp4a.40.2',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ]
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

function mimeToExt(mime: string): string {
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function isVirtualMic(label: string): boolean {
  return VIRTUAL_MIC_RE.test(label)
}

/** Prefer a real mic over BlackHole / Loopback / etc. */
function pickPreferredMicId(inputs: MediaDeviceInfo[]): string | undefined {
  const real = inputs.filter((d) => d.deviceId && d.deviceId !== 'default' && !isVirtualMic(d.label))
  const builtIn = real.find((d) =>
    /built-?in|macbook|internal|microphone|микрофон/i.test(d.label)
  )
  return builtIn?.deviceId ?? real[0]?.deviceId
}

/**
 * Open a mic stream, skipping virtual loopback devices when a real mic exists.
 * Permission probe is required so enumerateDevices() returns labels.
 */
async function openMicStream(): Promise<{ stream: MediaStream; label: string }> {
  const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
  probe.getTracks().forEach((t) => t.stop())

  const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === 'audioinput'
  )
  const preferredId = pickPreferredMicId(inputs)

  const stream = await navigator.mediaDevices.getUserMedia(
    preferredId
      ? { audio: { deviceId: { exact: preferredId } } }
      : { audio: true }
  )
  const label = stream.getAudioTracks()[0]?.label || 'Microphone'

  if (isVirtualMic(label) && inputs.some((d) => !isVirtualMic(d.label))) {
    stream.getTracks().forEach((t) => t.stop())
    throw new Error(
      'Browser selected a virtual audio device (e.g. BlackHole). Choose your real microphone in system/browser settings.'
    )
  }

  return { stream, label }
}

/** Opus with speech is typically >5 KB/s; virtual silence is ~0.3 KB/s. */
function isLikelySilent(blobSize: number, durationSecs: number): boolean {
  const secs = Math.max(1, durationSecs)
  return blobSize / secs < 1000
}

export default function RecordZone({ onFileReady }: Props) {
  const [state, setState] = useState<RecordState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null)
  const [supported] = useState(() => typeof MediaRecorder !== 'undefined' && !!pickMimeType())

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef(0)

  function startTimer() {
    setElapsed(0)
    elapsedRef.current = 0
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
    }, 1000)
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      stopTimer()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function startRecording() {
    setErrorMsg(null)
    setDeviceLabel(null)
    setState('requesting')

    let stream: MediaStream
    let label: string
    try {
      ;({ stream, label } = await openMicStream())
    } catch (err) {
      const msg =
        err instanceof Error && !/NotAllowedError|PermissionDenied/i.test(err.name + err.message)
          ? err.message
          : 'Microphone access denied. Please allow microphone and try again.'
      setErrorMsg(msg)
      setState('error')
      return
    }

    streamRef.current = stream
    chunksRef.current = []
    setDeviceLabel(label)

    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const mime = recorder.mimeType || mimeType || 'audio/webm'
      const ext = mimeToExt(mime)
      const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
      // Strip codec params from File.type — some servers are picky.
      const fileType = mime.split(';')[0].trim()
      const blob = new Blob(chunksRef.current, { type: fileType })

      if (isLikelySilent(blob.size, elapsedRef.current)) {
        setErrorMsg(
          `Recording is silent (got “${label}”). Pick your real microphone — not BlackHole or another virtual device.`
        )
        setState('error')
        return
      }

      const file = new File([blob], `recording_${ts}.${ext}`, { type: fileType })
      onFileReady(file)
      setState('done')
    }

    recorder.start(250) // collect chunks every 250ms
    setState('recording')
    startTimer()
  }

  function stopRecording() {
    stopTimer()
    mediaRecorderRef.current?.stop()
  }

  function reset() {
    setState('idle')
    setElapsed(0)
    setErrorMsg(null)
    setDeviceLabel(null)
  }

  if (!supported) {
    return (
      <div className="rounded-2xl border border-white/10 px-8 py-12 text-center">
        <p className="text-sm text-white/40">
          Audio recording is not supported in this browser.
        </p>
        <p className="mt-1 text-xs text-white/25">Please use Chrome, Firefox, or Safari 14+.</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex flex-col items-center gap-5 rounded-2xl border-2 border-dashed border-white/20 px-8 py-14 text-center">

        {/* Idle */}
        {state === 'idle' && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/8">
              <MicIcon className="text-white/40" />
            </div>
            <div>
              <p className="font-medium text-white/80">Record audio</p>
              <p className="mt-1 text-sm text-white/35">Tap to start — uses your microphone</p>
            </div>
            <button
              onClick={startRecording}
              className="rounded-xl bg-[#e2ff00] px-8 py-3 text-sm font-semibold text-black transition hover:opacity-90 active:opacity-80"
            >
              Start recording
            </button>
          </>
        )}

        {/* Requesting permission */}
        {state === 'requesting' && (
          <p className="text-sm text-white/50 animate-pulse">Requesting microphone…</p>
        )}

        {/* Recording */}
        {state === 'recording' && (
          <>
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span className="absolute h-full w-full animate-ping rounded-full bg-red-500/20" />
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                <span className="h-3.5 w-3.5 rounded-full bg-red-500" />
              </span>
            </div>
            <div>
              <p className="text-2xl font-mono font-semibold text-white tabular-nums">
                {formatTime(elapsed)}
              </p>
              <p className="mt-1 text-xs text-white/35">Recording…</p>
              {deviceLabel && (
                <p className="mt-1 max-w-xs truncate text-[11px] text-white/25" title={deviceLabel}>
                  {deviceLabel}
                </p>
              )}
            </div>
            <button
              onClick={stopRecording}
              className="rounded-xl border border-white/15 px-8 py-3 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Stop
            </button>
          </>
        )}

        {/* Done — parent switches away, but show brief state */}
        {state === 'done' && (
          <p className="text-sm text-white/50 animate-pulse">Processing…</p>
        )}

        {/* Error */}
        {state === 'error' && (
          <>
            <p className="text-sm text-red-400">{errorMsg}</p>
            <button
              onClick={reset}
              className="text-sm text-white/40 underline hover:text-white/70 transition"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}
