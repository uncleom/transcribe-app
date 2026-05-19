'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Upload, Mic } from 'lucide-react'
import UploadZone from '@/components/UploadZone'
import RecordZone from '@/components/RecordZone'

type Tab = 'upload' | 'record'

export default function HomeContent() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('upload')
  const [recordedFile, setRecordedFile] = useState<File | undefined>()

  function handleFileReady(file: File) {
    setRecordedFile(file)
    setActiveTab('upload')  // auto-switch to upload after recording
  }

  function handleTabChange(v: string) {
    setActiveTab(v as Tab)
    if (v === 'record') setRecordedFile(undefined)
  }

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mx-auto mb-5 flex w-fit gap-1 rounded-lg bg-white/5 p-1 h-auto">
          <TabsTrigger
            value="upload"
            className="flex items-center gap-2 rounded-md px-4 py-1.5 text-sm data-[state=active]:bg-[#e2ff00]/10 data-[state=active]:text-[#e2ff00] data-[state=inactive]:text-white/40"
          >
            <Upload size={14} />
            Upload
          </TabsTrigger>
          <TabsTrigger
            value="record"
            className="flex items-center gap-2 rounded-md px-4 py-1.5 text-sm data-[state=active]:bg-[#e2ff00]/10 data-[state=active]:text-[#e2ff00] data-[state=inactive]:text-white/40"
          >
            <Mic size={14} />
            Record
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <UploadZone
            onUploadComplete={(id) => router.push(`/transcription/${id}`)}
            initialFile={recordedFile}
          />
        </TabsContent>

        <TabsContent value="record">
          <RecordZone onFileReady={handleFileReady} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
