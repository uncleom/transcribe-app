# ARCHITECTURE.md

Техническая архитектура transcribe-app (transcribo.app).

---

## Общая схема

```
Browser / PWA                Telegram Bot
     │                            │
     ▼                            ▼
Next.js App Router ──── /api/telegram/webhook
     │                            │
     ├── /api/transcribe          │
     │   POST  → upload + start   │
     │   GET   → poll status      │
     │                            │
     └────────────────────────────┘
              │
        src/lib/transcription.ts   ← единственный пайплайн
              │
       ┌──────┴──────┐
       ▼             ▼
  Gladia API      Groq API
  (транскрипция)  (саммари/перевод)
       │
  Supabase DB
```

Ключевой принцип: **один пайплайн для двух клиентов**. `src/lib/transcription.ts` используется и веб-маршрутами, и Telegram-ботом. Изменение здесь затрагивает оба фронтенда.

---

## Транскрипционный пайплайн

### Веб-путь (два шага из-за async Gladia)

1. **POST `/api/transcribe`** — принимает файл, валидирует тип/размер, резервирует кредиты, загружает файл в Gladia (`uploadAudio`), стартует задачу (`startTranscription`), сохраняет запись в БД со статусом `processing`, возвращает `{id}`.

2. **GET `/api/transcribe/[id]`** — клиент поллит каждые 5 секунд. Один запрос к Gladia (`checkTranscriptionStatus`). Когда `done` → `finaliseGladiaResult` (нормализация + Groq summary) → обновляет БД, корректирует кредиты.

### Бот-путь (один шаг, синхронный)

`processFile(file, name, userId)` → загружает + поллит Gladia синхронно (`pollTranscription` с циклом) → нормализует → Groq summary → возвращает результат. Всё в одном вызове, потому что бот может ждать.

### Shared pipeline (`src/lib/transcription.ts`)

```
processFile()          ← бот
finaliseGladiaResult() ← веб
  └── addSummary()
        └── summariseTranscript() [groq]
formatTranscriptText() ← бот + "Copy all" на сайте
mergeUtterances()      ← объединяет реплики одного спикера
```

---

## Система кредитов (`src/lib/credits.ts`)

Два типа субъекта: `{ type: 'user', id }` и `{ type: 'anon', ip }`.

Атомарный паттерн через Postgres RPC — **не** application-level:
1. `reserveCredits(subject, estimatedSeconds)` — резервирует по оценке длительности
2. Gladia возвращает реальную длину
3. `adjustCredits(subject, reserved, actual)` — корректирует разницу
4. `refundCredits(subject, reserved)` — при ошибке транскрипции

Таблица `anonymous_usage(ip PK, used_seconds)` — лимит 180 сек по IP.
Таблица `profiles.credits_seconds` — остаток для авторизованных.
`profiles.is_unlimited = true` → все проверки пропускаются.

---

## Роутинг API-ключей (`src/lib/api-keys.ts`)

```
resolveGladiaKey(userId?) → GLADIA_API_KEY_PUBLIC ?? GLADIA_API_KEY
resolveGroqKey(userId?)   → GROQ_API_KEY_PUBLIC  ?? GROQ_API_KEY
```

Если `userId === OWNER_USER_ID` (env) → всегда личные ключи.
Иначе → публичные (fallback на личные пока `*_PUBLIC` не заданы).

Вызывается в трёх местах: `POST /api/transcribe`, `GET /api/transcribe/[id]`, `webhook/route.ts`. В `transcription.ts` ключ передаётся параметром — библиотечные функции не читают env напрямую.

---

## Supabase-клиенты

- `createServerClient()` — пользовательский RLS-контекст, cookie-сессии, Server Components / API routes с аутентификацией
- `createAdminClient()` — service_role, bypasses RLS. **Только в API routes.** Обязателен для `telegram_accounts`, `telegram_link_tokens`, операций с кредитами

`src/proxy.ts` — Next.js middleware, refresh сессий на каждый запрос.

---

## Telegram-бот (`src/app/api/telegram/webhook/route.ts`)

Webhook отвечает `200 OK` немедленно, обработка идёт в `void processUpdate()` — это критично, Telegram требует ответ < 5 сек. Работает только на persistent-сервере (Coolify/VPS), **не на serverless**.

**Actions:**
- `sum:id` → генерирует summary, добавляет кнопку перевода если язык ≠ язык пользователя TG
- `trs:id:lang` → пересоздаёт summary на целевом языке через Groq
- `trl:id:lang` → переводит транскрипцию

Linking: one-time deep link через `telegram_link_tokens` (TTL 15 мин) → `/start link_TOKEN` в боте → `telegram_accounts` upsert.

`stripMarkdown()` в webhook — убирает `**bold**`, `## headers` перед отправкой (Groq возвращает Markdown, Telegram ожидает plain text без parse_mode).

---

## PWA / запись аудио

`RecordZone.tsx` — кросс-браузерная запись через `MediaRecorder API`:
- Определяет поддерживаемый codec: `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4` → `audio/ogg`
- После Stop эмитит `File`, `HomeContent` переключает в режим Upload с `initialFile`
- `UploadZone` принимает `initialFile?: File` и вызывает `selectFile()` через `useEffect`

`InstallBanner.tsx` — показывает A2HS-подсказку (Android) и iOS-инструкцию.

---

## Безопасность

- **Owner-check**: `GET /api/transcribe/[id]` возвращает 404 (не 403) если `transcription.user_id` ≠ текущий пользователь
- **Filename sanitization**: `[^a-zA-Z0-9._-]` → `_` перед передачей в Gladia
- **MIME validation**: стриппим codec params (`audio/webm; codecs=opus` → `audio/webm`) перед проверкой allowlist
- **Telegram webhook**: валидация `x-telegram-bot-api-secret-token` header
- **Storage**: private bucket, публичного доступа нет (файлы идут напрямую в Gladia, не через Supabase Storage)

---

## Деплой

- Push в `main` → GitHub App `om-dev-github` → Coolify → Hetzner VPS
- Build: `next build --webpack` (флаг обязателен — Turbopack ломает next-pwa/Workbox)
- **Перед пушем**: `ssh root@162.55.215.194 "docker builder prune -af && docker image prune -af"` — иначе диск (38GB) заполняется build cache
