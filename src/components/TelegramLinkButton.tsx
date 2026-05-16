'use client'

import { useState } from 'react'

interface Props {
  initialLinked: boolean
  initialUsername?: string | null
}

export default function TelegramLinkButton({ initialLinked, initialUsername }: Props) {
  const [linked, setLinked] = useState(initialLinked)
  const [username, setUsername] = useState(initialUsername)
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function generateLink() {
    setLoading(true)
    try {
      const res = await fetch('/api/telegram/connect', { method: 'POST' })
      const data = await res.json()
      if (data.already_linked) {
        setLinked(true)
        setUsername(data.telegram_username)
      } else if (data.deep_link) {
        setDeepLink(data.deep_link)
      }
    } finally {
      setLoading(false)
    }
  }

  async function unlink() {
    setLoading(true)
    try {
      await fetch('/api/telegram/connect', { method: 'DELETE' })
      setLinked(false)
      setUsername(null)
      setDeepLink(null)
    } finally {
      setLoading(false)
    }
  }

  if (linked) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-white/60">
          ✅ Connected{username ? ` · @${username}` : ''}
        </span>
        <button
          onClick={unlink}
          disabled={loading}
          className="text-xs text-white/25 transition hover:text-white/50 disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
    )
  }

  if (deepLink) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-white/45">
          Open the link below in Telegram to complete the connection:
        </p>
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-[#e2ff00] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 w-fit"
        >
          Open @TranscriboAppBot →
        </a>
        <p className="text-xs text-white/25">Link expires in 15 minutes</p>
      </div>
    )
  }

  return (
    <button
      onClick={generateLink}
      disabled={loading}
      className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-50"
    >
      {loading ? 'Generating link…' : 'Link Telegram account'}
    </button>
  )
}
