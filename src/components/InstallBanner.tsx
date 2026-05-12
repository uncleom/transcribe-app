'use client'

import { useCallback, useEffect, useState } from 'react'

type Platform = 'android' | 'ios' | 'none'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'pwa-install-dismissed'

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'none'

  // Already installed
  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  ) {
    return 'none'
  }

  // User already dismissed
  if (localStorage.getItem(DISMISSED_KEY) === 'true') {
    return 'none'
  }

  // iOS (beforeinstallprompt doesn't fire on iOS)
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    return 'ios'
  }

  return 'none' // android is set via beforeinstallprompt event
}

export default function InstallBanner() {
  const [platform, setPlatform] = useState<Platform>('none')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const ios = detectPlatform()
    if (ios === 'ios') {
      setPlatform('ios')
      return
    }

    // Android: wait for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      if (localStorage.getItem(DISMISSED_KEY) === 'true') return
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setPlatform('android')
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setPlatform('none')
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setPlatform('none')
  }, [])

  if (platform === 'none') return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl border border-white/10 bg-[#1a1a1a] p-4 shadow-xl">
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 text-white/30 transition hover:text-white/70"
        aria-label="Cerrar"
      >
        ✕
      </button>

      {platform === 'android' && (
        <div className="flex items-center gap-3 pr-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            className="h-10 w-10 shrink-0 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Instala Transcribo</p>
            <p className="text-xs text-white/45">Accede rápido desde tu pantalla de inicio</p>
          </div>
          <button
            onClick={handleInstall}
            className="shrink-0 rounded-lg bg-[#e2ff00] px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-[#d4ee00]"
          >
            Instalar
          </button>
        </div>
      )}

      {platform === 'ios' && (
        <div className="pr-4">
          <p className="text-sm font-semibold text-white">Instala Transcribo</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-white/60">
            Toca
            <span className="inline-flex items-center gap-0.5 rounded bg-white/10 px-1.5 py-0.5 text-white">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2 8 6h3v9h2V6h3L12 2zM5 16v4h14v-4h-2v2H7v-2H5z" />
              </svg>
              Compartir
            </span>
            luego
            <span className="font-medium text-white">"Agregar a inicio"</span>
          </p>
        </div>
      )}
    </div>
  )
}
