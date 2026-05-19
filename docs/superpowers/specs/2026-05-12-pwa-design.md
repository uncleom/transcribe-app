# PWA Design — Transcribo (A6)

**Date:** 2026-05-12  
**Status:** Approved  
**Scope:** Installable PWA with smart install banner (Android + iOS)

---

## Goal

Make transcribo.app installable as a home screen app on Android and iOS. Users get an app-like experience without needing the App Store. Install prompt appears once, disappears after install or dismissal.

Out of scope: Web Share Target, iOS Shortcuts with file upload, batch upload. These go to backlog.

---

## Architecture

### 1. Web App Manifest (`public/manifest.json`)

Standard PWA manifest:
- `name`: "Transcribo"
- `short_name`: "Transcribo"
- `start_url`: "/"
- `display`: "standalone"
- `background_color`: "#0a0a0a"
- `theme_color`: "#0a0a0a"
- `icons`: 192×192, 512×512, 512×512 maskable (PNG, from provided logo)

### 2. Icons (`public/icons/`)

Source: user-provided 1024×1024 PNG (microphone + waveform, #0a0a0a bg, #e2ff00 accent).

Generated sizes:
- `icon-192.png` — standard
- `icon-512.png` — standard
- `icon-512-maskable.png` — with safe zone padding for Android adaptive icons
- `apple-touch-icon.png` — 180×180 for iOS Safari

### 3. Service Worker (next-pwa)

`next-pwa` v5.6.0 is already in deps. Configure in `next.config.ts`:
- Cache strategy: NetworkFirst for API routes, CacheFirst for static assets
- Offline fallback: serve cached shell (the app loads, shows upload UI)
- SW registered only in production (`disable: process.env.NODE_ENV === 'development'`)

### 4. Meta Tags (`src/app/layout.tsx`)

Add to `<head>`:
- `<link rel="manifest" href="/manifest.json">`
- `<meta name="theme-color" content="#0a0a0a">`
- `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- `<meta name="apple-mobile-web-app-title" content="Transcribo">`

Update `metadata.title` from "Transcribe" → "Transcribo".

### 5. InstallBanner Component (`src/components/InstallBanner.tsx`)

Client component. Shown on the home page (`src/app/page.tsx`), below the upload zone.

#### Detection logic (priority order):

```
1. window.matchMedia('(display-mode: standalone)').matches  → already installed, show nothing
2. window.navigator.standalone === true                      → iOS standalone, show nothing  
3. localStorage.getItem('pwa-install-dismissed') === 'true' → user dismissed, show nothing
4. deferredPrompt captured (beforeinstallprompt event)      → show Android banner
5. /iphone|ipad|ipod/i.test(navigator.userAgent)           → show iOS instructions
6. else                                                      → show nothing (desktop without prompt)
```

#### Android variant:
- Small banner at bottom of screen
- Text: "Instala Transcribo en tu pantalla de inicio"
- Button "Instalar" → calls `deferredPrompt.prompt()` → native Chrome dialog
- After user accepts/rejects → hide banner + set localStorage

#### iOS variant:
- Same banner style
- Text: "Para instalar: toca" + Share icon + "→ 'Agregar a inicio'"
- Visual: inline SVG of iOS Share icon so user knows exactly what to tap
- X button → set `localStorage['pwa-install-dismissed'] = 'true'` → hide

#### Shared UX rules:
- Position: fixed bottom, full width on mobile / max-w-sm centered on desktop
- Style: bg `#1a1a1a`, border `#2a2a2a`, accent `#e2ff00` for CTA button
- Dismissible: X button in top-right corner
- Does not block content (not a modal, not full-screen)
- Shown max once per session after dismissal is cleared

---

## Data Flow

```
User opens transcribo.app
  ↓
layout.tsx serves manifest link + apple meta tags
  ↓
Browser registers SW (production only)
  ↓
InstallBanner mounts (client-side)
  ↓
Detection logic runs → correct variant shown or nothing
  ↓
Android: user taps Install → native prompt → app added
iOS: user follows instructions → Safari "Add to Home Screen" → app added
  ↓
Next visit: standalone mode → banner never shows again
```

---

## Error Handling

- `beforeinstallprompt` not firing (browser doesn't support): banner simply not shown
- SW registration failure: logged to console, app works normally without offline support
- Icons missing: browser falls back to favicon

---

## Files Changed

| File | Change |
|---|---|
| `public/manifest.json` | New |
| `public/icons/icon-192.png` | New |
| `public/icons/icon-512.png` | New |
| `public/icons/icon-512-maskable.png` | New |
| `public/icons/apple-touch-icon.png` | New |
| `next.config.ts` | Add withPWA wrapper |
| `src/app/layout.tsx` | Add meta tags, fix title |
| `src/components/InstallBanner.tsx` | New |
| `src/app/page.tsx` | Mount InstallBanner |

---

## Out of Scope (Backlog)

- `B1 (P3)` — Batch upload (multiple files from WhatsApp/share)
- `B2 (P2)` — iOS Shortcut with API token for automatic file upload
- `A4 (P2)` — Web Share Target for Android (receive files from share sheet)
