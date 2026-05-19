# Transcribo — Project Context for Portfolio / Job Search

Use this file as context in any AI chat to get help writing portfolio descriptions,
cover letters, LinkedIn entries, interview prep, etc.

---

## What is this project

Transcribo (transcribo.app) is a production SaaS I built solo from scratch.
It converts audio and video files into structured transcripts with automatic
speaker detection (diarization) and AI-generated summaries.

Target market: LATAM (primarily es-AR and pt-BR), where async voice communication
(WhatsApp voice notes, Telegram audio) is extremely common.

Monetization model: pay-as-you-go credits via MercadoPago (integration in progress).

---

## My role

Solo founder + sole developer. I made every decision:
- Product direction and market positioning
- System architecture
- All backend, frontend, DevOps
- Deployment and production operations

---

## Tech stack

- **Frontend:** Next.js 16.2.3 (App Router), TypeScript, Tailwind CSS 4
- **Backend/DB:** Supabase (PostgreSQL, Auth, Row Level Security)
- **Transcription:** Gladia API v2 — 99+ languages, speaker diarization
- **AI (summaries/translation):** Groq API, llama-3.3-70b-versatile
- **Telegram Bot:** Telegram Bot API (webhook, inline keyboards) — @TranscriboAppBot
- **PWA:** next-pwa 5.6.0, service worker, installable on iOS + Android
- **Deploy:** Coolify on Hetzner VPS (162.55.215.194), auto-deploy from GitHub
- **Package manager:** npm
- **Repo:** github.com/uncleom/transcribe-app (public)

---

## Key features shipped

### Web app
- Drag-and-drop upload of audio/video (any format Gladia accepts)
- Real-time polling of transcription status (5s interval)
- Transcript with color-coded speaker labels (diarization)
- AI summary with on-demand translation to EN / ES / PT / RU
- Copy transcript (full text, with timestamps, or summary)
- Transcription history page
- PWA: installable on home screen, works offline

### Telegram bot (@TranscriboAppBot)
- Send/forward any audio or voice message → get transcript in the chat
- Inline buttons: Summary, Translate
- /history — link to web history
- Account linking: connect Telegram to Google account via one-time deep link
- Full transcription history synced between bot and web app

### Credit system
- Anonymous users: 180 seconds free per IP
- Authenticated users: 1200 seconds free on signup
- Atomic PostgreSQL RPCs for reserve / adjust / refund — no race conditions
- `is_unlimited` flag for owner account (no credit checks)

### Multi-tenant API key routing
- `OWNER_USER_ID` env var separates owner traffic from public traffic
- Owner uses personal Gladia + Groq keys; public users use separate keys
- Fallback to owner keys if public keys not yet configured

### Security
- RLS policies on all tables
- Service-role key only in API routes (never client-side)
- Owner-check on transcription access (404 instead of 403)
- Filename sanitization before API calls
- Private Supabase Storage bucket

---

## Architecture highlights worth mentioning

**Shared pipeline:** `src/lib/transcription.ts` is used by both the web API routes
and the Telegram bot. Changing the pipeline affects both surfaces simultaneously.
This was a deliberate design decision to avoid code duplication and drift.

**Unified transcription flow:**
1. File → Gladia upload → async job started
2. Poll Gladia every 5s until done
3. Normalize result → generate summary via Groq
4. Save to Supabase with language, duration, full result JSONB

**Bot architecture:** Telegram webhook → Next.js API route → same pipeline.
The bot responds within 200ms (Telegram's requirement) and processes async.

**PWA:** Service worker generated via next-pwa with webpack (not Turbopack —
a known compatibility issue I diagnosed and resolved).

---

## What I solved that was non-trivial

- **Atomic credit system:** Used PostgreSQL RPCs instead of application-level logic
  to prevent race conditions under concurrent requests
- **PWA + Google OAuth:** Fixed auto-login bug on saved PWA icon by adding
  `prompt: select_account` to OAuth params
- **Docker disk exhaustion on Hetzner:** Diagnosed exit code 255 on Docker image
  export despite successful compilation; fixed by configuring Docker GC with 3GB
  build cache limit
- **Telegram + RLS mismatch:** `telegram_accounts` table was not accessible via
  the regular Supabase client due to RLS; switched to `createAdminClient()` for
  those queries
- **next-pwa + Next.js 16:** Turbopack (default in Next.js 16) breaks next-pwa's
  Workbox integration; resolved by forcing webpack via `--webpack` build flag

---

## Numbers / scale

- Languages supported: 99+ (via Gladia)
- Free tier: 3 min anonymous, 20 min for registered users
- Deployment: single Hetzner VPS (3.7GB RAM, 38GB disk)
- Build time: ~2 minutes on Coolify CI

---

## What's next (planned / in progress)

- MercadoPago checkout + webhook (P1)
- Rate limiting (P1)
- UI localization to es-AR (P2)
- Export as .txt / .srt / .vtt (P2)
- Landing page in Spanish (P2)
- Migrate next-pwa → @ducanh2912/next-pwa for better Next.js 16 support (P3)
