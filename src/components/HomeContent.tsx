'use client'

import { useRouter } from 'next/navigation'
import UploadZone from '@/components/UploadZone'

export default function HomeContent() {
  const router = useRouter()
  return (
    <UploadZone onUploadComplete={(id) => router.push(`/transcription/${id}`)} />
  )
}
