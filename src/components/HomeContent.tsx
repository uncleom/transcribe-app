'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadZone from '@/components/UploadZone'
import RecordZone from '@/components/RecordZone'

type Mode = 'upload' | 'record'

export default function HomeContent() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('upload')
  const [recordedFile, setRecordedFile] = useState<File | undefined>()

  function handleFileReady(file: File) {
    setRecordedFile(file)
    setMode('upload')
  }

  function switchMode(next: Mode) {
    setMode(next)
    if (next === 'record') setRecordedFile(undefined)
  }

  return (
    <div className="w-full">
      {/* Mode toggle */}
      <div className="mb-5 flex gap-1 rounded-lg bg-white/5 p-1 w-fit mx-auto">
        <button
          onClick={() => switchMode('upload')}
          className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm transition ${
            mode === 'upload'
              ? 'bg-[#e2ff00]/10 text-[#e2ff00] font-medium'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          <UploadIcon />
          Upload
        </button>
        <button
          onClick={() => switchMode('record')}
          className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm transition ${
            mode === 'record'
              ? 'bg-[#e2ff00]/10 text-[#e2ff00] font-medium'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          <MicIcon />
          Record
        </button>
      </div>

      {mode === 'upload' ? (
        <UploadZone
          onUploadComplete={(id) => router.push(`/transcription/${id}`)}
          initialFile={recordedFile}
        />
      ) : (
        <RecordZone onFileReady={handleFileReady} />
      )}
    </div>
  )
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}
