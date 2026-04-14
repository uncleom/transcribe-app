# Credits System — Design Spec

**Date:** 2026-04-14  
**Status:** Approved

## Overview

Prepaid credits system for transcription. Auth users get 1200 seconds (20 min) on signup. Anonymous users share a 180-second (3 min) pool per IP. Credits are reserved at upload time using the client-measured duration hint, then adjusted to actual Gladia-reported duration on completion.

## Database Changes

### profiles (ALTER TABLE)
- `credits_seconds INT NOT NULL DEFAULT 1200` — remaining balance in seconds
- `is_unlimited BOOLEAN NOT NULL DEFAULT false` — bypasses all credit checks

### transcriptions (ALTER TABLE)
- `reserved_seconds INT` — seconds reserved for this job (needed for post-completion adjustment)

### anonymous_usage (CREATE TABLE)
```sql
ip          TEXT PRIMARY KEY
used_seconds INT NOT NULL DEFAULT 0
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

## Credit Logic

### Limits
- Auth user: available = `credits_seconds` (is_unlimited bypasses checks)
- Anonymous: available = `180 - used_seconds`

### Reservation (at upload)
- Auth: `UPDATE profiles SET credits_seconds = credits_seconds - hint WHERE id = ? AND (is_unlimited OR credits_seconds >= hint)`
- Anon: `INSERT INTO anonymous_usage ... ON CONFLICT DO UPDATE SET used_seconds = used_seconds + hint WHERE used_seconds + hint <= 180`
- If 0 rows affected → 402 Payment Required

### Adjustment (at Gladia done)
- Auth: `credits_seconds += (reserved - actual)` — positive = refund, negative = extra charge (floor at 0)
- Anon: `used_seconds = used_seconds - reserved + actual` (floor at 0, cap at 180)

### Refund (at Gladia error)
- Auth: `credits_seconds += reserved`
- Anon: `used_seconds = GREATEST(0, used_seconds - reserved)`

## API

### GET /api/credits?duration=X
Returns: `{ is_unlimited, remaining_seconds, sufficient, limit_seconds }`  
Auth: reads profiles. Anon: reads anonymous_usage by IP (0 if no row).

### POST /api/transcribe (changes)
- Accepts `duration_hint` (int seconds) in form data
- Server-side reserveCredits before Gladia upload
- Stores `reserved_seconds` in transcriptions record
- On Gladia error: refundCredits

### GET /api/transcribe/[id] (changes)
- On status=done: adjustCredits(reserved, actual=result.duration)
- On status=error: refundCredits(reserved)

## src/lib/credits.ts

Four functions, server-only:
- `checkCredits(type, id, duration)` → `{ sufficient, remaining }`
- `reserveCredits(type, id, hint)` → throws on insufficient
- `adjustCredits(type, id, reserved, actual)` → void
- `refundCredits(type, id, reserved)` → void

`type`: `'user'` | `'anon'`; `id`: userId or IP string.

## UploadZone.tsx Changes

1. `detectDuration(file)` — HTMLVideoElement.loadedmetadata, returns seconds
2. Show duration pill next to file size
3. After file select: GET /api/credits?duration=X
4. New state `insufficient`: show warning + "Пополнить баланс" button (href='/billing')
5. On submit: include `duration_hint` in FormData

## IP Extraction
`request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'`

## Out of Scope
- Billing/Stripe integration
- /billing page (stub only if needed for button href)
- Per-transcription credit history log
