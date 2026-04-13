'use client'

import { useRouter } from 'next/navigation'
import UploadZone from '@/components/UploadZone'

export default function HomePage() {
  const router = useRouter()

  function handleUploadComplete(id: string) {
    router.push(`/transcription/${id}`)
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Header */}
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
  )
}
