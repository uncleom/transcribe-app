'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import UploadZone from '@/components/UploadZone'

export default function HomePage() {
  const router = useRouter()

  function handleUploadComplete(id: string) {
    router.push(`/transcription/${id}`)
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
        <span className="text-sm font-semibold text-white">Transcribe</span>
        <Link
          href="/history"
          className="text-sm text-white/50 transition hover:text-white"
        >
          History
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Transcribe
            </h1>
            <p className="mt-2 text-white/45">
              Upload audio or video — get a transcript with speaker labels
            </p>
          </div>

          <UploadZone onUploadComplete={handleUploadComplete} />
        </div>
      </main>
    </>
  )
}
