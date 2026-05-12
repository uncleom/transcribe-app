# AUDIT — transcribe-app

**Дата:** 2026-04-23
**Коммит на момент аудита:** `f5c6a84` — "сохрани: система кредитов полностью реализована"
**Метод:** прочитаны все .ts/.tsx файлы в `src/`, `supabase/migrations/*`, конфиги, env-имена (без значений).

---

## 1. Карта проекта

### 1.1 Что работает (verified by code-read)

| Модуль | Статус | Примечание |
|---|---|---|
| Next.js App Router (v16.2.3) | ✅ | `src/app/` структура корректная |
| Supabase Auth (Google OAuth) | ✅ | `/login`, `/auth/callback`, cookie-sessions через `@supabase/ssr` |
| Session refresh middleware | ✅ | `src/proxy.ts` — в Next.js 16 middleware переименован в proxy (см. AGENTS.md) |
| Upload → Gladia pipeline | ✅ | `POST /api/transcribe` → Supabase Storage → Gladia v2 (`uploadAudio` + `startTranscription`, diarization) |
| Polling transcription status | ✅ | `GET /api/transcribe/[id]` делает 1 пинг в Gladia, не блокирует; клиент сам опрашивает каждые 5 сек |
| Summary via Groq | ✅ | `llama-3.3-70b-versatile`, multilingual (respects Gladia detected lang) |
| Credits system | ✅ | Atomic RPC (`reserve_*/adjust_*/refund_*`), anon по IP (180s), auth по `profiles.credits_seconds` (default 1200) |
| History page | ✅ | `/history`, auth-only, redirect на `/login` если нет сессии |
| Transcription detail | ✅ | `/transcription/[id]`, polling, copy-all |
| UploadZone | ✅ | HTMLVideoElement для detectDuration, prefetch `/api/credits`, XHR upload с прогрессом |
| DB миграции | ✅ | `0001_init.sql` + `20260414000000_credits.sql` применены (указано в CLAUDE.md) |

### 1.2 Что сломано / отсутствует

| # | Проблема | Тяжесть | Файл |
|---|---|---|---|
| A1 | **GET `/api/transcribe/[id]` не проверяет владельца** — любой знающий UUID может получить чужую транскрипцию | 🔴 High | `src/app/api/transcribe/[id]/route.ts:13-22` |
| A2 | **Supabase Storage публичный** — `getPublicUrl` + публичный bucket «audio-files». Все загруженные файлы доступны всему миру по URL | 🔴 High | `src/app/api/transcribe/route.ts:96-97` |
| A3 | **Нет санитизации `file.name` в storagePath** — возможен path traversal / unicode-коллизии | 🟡 Medium | `src/app/api/transcribe/route.ts:83` |
| A4 | **Нет rate-limiting на `/api/transcribe`** — спам + исчерпание Gladia-бюджета через смену IP | 🟡 Medium | всё API |
| A5 | **getClientIp примитивен** — trusts `x-forwarded-for` без знания proxy-топологии; тривиальная подделка anon-лимита 180s | 🟡 Medium | `src/lib/credits.ts:135-140` |
| A6 | **PWA не сконфигурирована** — `next-pwa` в deps, но `next.config.ts` пустой, нет `manifest.json`, нет service worker, нет Web Share Target target | 🟡 Medium | `next.config.ts`, `public/` |
| A7 | **`NEXT_PUBLIC_APP_URL` объявлен, не используется** | 🟢 Low | `.env.local` |
| A8 | **`@anthropic-ai/sdk` в deps, не используется** — мёртвая зависимость, ~3MB | 🟢 Low | `package.json` |
| A9 | **README = create-next-app boilerplate** — не отражает продукт | 🟢 Low | `README.md` |
| A10 | **UI-тексты смешаны en+ru** (main page en, `/login` ru, UploadZone.tsx частично ru) — некогерентно для LATAM | 🟡 Medium | `src/app/**/*.tsx` |
| A11 | **Нет `/billing` страницы** — ссылка есть в UploadZone (`href="/billing"`), ведёт в 404 | 🟡 Medium | отсутствует |
| A12 | **Нет `.env.example`** | 🟡 Medium | отсутствует |
| A13 | **`.gitignore` не исключает `.vscode/`, `.idea/`, `.antigravity/`** — при коммите может протечь локальные настройки IDE (не критично, но хорошая гигиена) | 🟢 Low | `.gitignore` |
| A14 | **В `createAdminClient` используется `process.env.NEXT_PUBLIC_SUPABASE_URL`** — само по себе ок, но стоит подтвердить, что project-level separation SB-URL от service_role сохраняется (т.е. URL публичный, key — никогда) | 🟢 Info | `src/lib/supabase/server.ts:34` |

### 1.3 Безопасность: сводка

**Критично (исправить сейчас — фаза 5):**
- A1 (владелец транскрипции)
- A2 (публичный bucket)

**Важно (плановая работа):**
- A3 (sanitize filename)
- A4 (rate-limit)
- A5 (IP spoof)

**Не-security, но нужно для MVP:**
- A6 (PWA manifest) — обещано как USP
- A11 (`/billing` заглушка) — нужна для smoke-test из MARKET_RESEARCH

---

## 2. Стек и зависимости

### Production deps (`package.json`)
- `next@16.2.3` — последний major
- `react@19.2.4`, `react-dom@19.2.4`
- `@supabase/ssr@0.10.2`, `@supabase/supabase-js@2.103.0`
- `next-pwa@5.6.0` — **не инициализирован в next.config.ts**
- `@anthropic-ai/sdk@0.88.0` — **не используется, можно удалить** (A8)
- `clsx`, `tailwind-merge`, `lucide-react`

### Dev deps
- TypeScript 5, ESLint 9 + next-config, Tailwind 4 (PostCSS plugin)

### Env (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GLADIA_API_KEY
GROQ_API_KEY
NEXT_PUBLIC_APP_URL    ← объявлен, не используется (A7)
```

---

## 3. Что делать с этим аудитом

- **Фаза 5** (safety hardening) закрывает A1, A2, A3, A11, A12. A4, A5, A6, A10 переносим в `business/BACKLOG.md`.
- A7, A8, A9, A13 — косметика, закрыть попутно в этой же реструктуризации.
- A6 (PWA) — отдельный тикет; требует решения про service-worker-стратегию, выходит за рамки «минимального» скоупа фазы 5.

---

## 4. Что НЕ трогаем (по правилам из промта)

- `src/app/**`, `src/components/**`, `src/lib/**` (бизнес-логика) — только точечные security-патчи.
- `supabase/migrations/**` — не трогаем.
- Не устанавливаем новые npm-пакеты.
