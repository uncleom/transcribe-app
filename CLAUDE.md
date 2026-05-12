# CLAUDE.md — transcribe-app (transcribo.app)

## Старт сессии
1. Найди контекст в mempalace: `mempalace_search("transcribe-app")`
2. Прочитай этот файл
3. Если сомневаешься в приоритетах — открой `.business/BACKLOG.md`
4. Скажи пользователю, на чём остановились в прошлый раз

## Команда "сохрани"
Когда пользователь пишет **"сохрани"**:
1. Сохрани ключевые решения/факты сессии в mempalace (`mempalace_kg_add` или `mempalace_add_drawer`)
2. Обнови релевантные файлы (`CLAUDE.md` — при структурных изменениях; `.business/DECISIONS.md` — при новом решении; `.business/BACKLOG.md` — при изменении задач)
3. Сделай `git add -A && git commit` с описательным сообщением на русском

## Что это
PWA для мультиязычной транскрипции аудио/видео с разделением спикеров и резюме.
Ориентирован на LATAM-рынок (es-AR, pt-BR primary). Монетизация — PAYG через MercadoPago.

**Полная спецификация продукта — в [SPECIFICATION.md](./SPECIFICATION.md).**
**Позиционирование и USP — в [.brand/positioning.md](./.brand/positioning.md).**
**Маркетинговые данные — в [.business/MARKET_RESEARCH.md](./.business/MARKET_RESEARCH.md).**

## Структура папок

```
transcribe-app/
├── src/                    ← код приложения (не трогать без причины)
│   ├── app/                ← Next.js App Router
│   ├── components/         ← React UI
│   ├── lib/                ← бизнес-логика (credits, gladia, groq, supabase)
│   ├── types/              ← TypeScript types
│   └── proxy.ts            ← Next.js 16 middleware (refresh sessions)
├── supabase/migrations/    ← SQL миграции (не трогать)
├── public/                 ← статика + PWA manifest (планируется)
├── .business/              ← бизнес-документы
│   ├── MARKET_RESEARCH.md  ← конкуренты, LATAM, USP, стратегия
│   ├── AUDIT.md            ← состояние кода на момент аудита
│   ├── BACKLOG.md          ← приоритизированные задачи (P1/P2/P3)
│   ├── DECISIONS.md        ← журнал ключевых решений
│   └── VALIDATION_PLAN.md  ← план smoke-test без интервью
├── .brand/                  ← маркетинг
│   ├── positioning.md      ← USP, персоны, tone of voice
│   └── landing_copy_es.md  ← испанский лендинг (draft, нужна вычитка)
├── docs/                   ← техническая документация
│   ├── SETUP.md            ← как поднять проект
│   └── superpowers/        ← старые планы/спеки (исторические)
├── SPECIFICATION.md        ← «что и зачем», не «как»
├── CLAUDE.md               ← этот файл
├── AGENTS.md               ← правила про Next.js 16 breaking changes
├── README.md               ← публичное описание (минимальное)
└── .env.example            ← шаблон env-переменных
```

## Стек
Next.js 16.2.3 App Router · TypeScript · Tailwind 4
Supabase (auth, storage, postgres RLS)
Gladia API v2 (транскрипция + diarization)
Groq API (резюме — модель llama-3.3-70b-versatile)
next-pwa (**в deps, но не сконфигурирован — BACKLOG A6**)

## Правила работы с кодом
- App Router, Server Components по умолчанию
- Client Components только где нужна интерактивность
- Вся бизнес-логика в `src/lib/`
- Supabase service_role key только в API routes (`createAdminClient`)
- Gladia: diarization true, polling каждые 5с, макс 60 попыток
- Тёмная тема: фон #0a0a0a, акцент #e2ff00
- Mobile-first
- **Next.js 16 breaking changes:** читай `node_modules/next/dist/docs/` перед любым Next.js-кодом

## Структура БД
```
profiles:         id, email, display_name, credits_seconds (DEFAULT 1200),
                  is_unlimited (DEFAULT false), created_at
transcriptions:   id, user_id (nullable), file_name, file_url, duration_seconds,
                  language, status, result (jsonb), gladia_result_url,
                  reserved_seconds, created_at
anonymous_usage:  ip (PK), used_seconds, updated_at
```

## Система кредитов
- Аноним: лимит **180 сек** по IP (`anonymous_usage`)
- Auth: `credits_seconds` остаток, стартовый подарок **1200 сек** (20 мин)
- `is_unlimited = true` → проверки не нужны
- Паттерн: резервирование при загрузке → корректировка по факту Gladia
- Атомарность: Postgres RPC (`reserve_*/adjust_*/refund_*`) для user и anon
- `src/lib/credits.ts` — единственное место с кредитной логикой
- `UploadZone`: `detectDuration` через HTMLVideoElement, передаёт `duration_hint` в FormData

## Авторизация
- Google OAuth через Supabase Auth
- Cookie-сессии через `@supabase/ssr`
- `src/proxy.ts` — refresh сессий (Next.js 16.2)
- `/login` — страница входа, `/auth/callback` — OAuth обработчик
- `/history` защищена (redirect на `/login`)
- `/billing` защищена (то же)

## Статус

### Готово
- ✅ Upload → Gladia → Groq pipeline (файл идёт напрямую в Gladia, Supabase Storage не используется)
- ✅ Google OAuth
- ✅ Кредитная система (anon + auth) с atomic RPC
- ✅ `/history`, `/transcription/[id]`
- ✅ Миграции применены
- ✅ `/billing` страница-заглушка (визуал, без реального checkout)
- ✅ Security-хардёнинг: владелец-check на `/api/transcribe/[id]`, санитизация filename, private storage bucket (public=false, public read policy удалена), RLS на `anonymous_usage`, `adjustCredits`/`refundCredits` awaited
- ✅ `.env.example` создан

### Pending (см. `.business/BACKLOG.md`)
- 🔨 P1: реальный MercadoPago checkout + webhook (M1)
- 🔨 P1: валидация duration_hint числовые границы (V1, UUID уже есть)
- 📅 P2: rate-limiting (A4), локализация UI es-AR (A10), PWA manifest + Share Target (A6), лендинг `/es` (L1), экспорт `.txt/.srt/.vtt` (E1)
- 📅 P3: удалить `@anthropic-ai/sdk` (A8), переписать README (A9)

## Env переменные
Полный список с описаниями — `.env.example`. Краткий:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GLADIA_API_KEY
GROQ_API_KEY
NEXT_PUBLIC_APP_URL
```
(`NEXT_PUBLIC_APP_URL` пока не используется в коде — BACKLOG A7.)

## Деплой
- **URL:** https://transcribe.om-dev.uk
- **Coolify:** coolify.om-dev.uk (Hetzner om-dev-vps 162.55.215.194)
- **Автодеплой:** push в `main` → GitHub App `om-dev-github` → Coolify
- **Домен продакшн:** transcribo.app (ещё не подключён)

## Команды
```bash
npm run dev      # dev сервер
npm run build    # продакшн build
npm run lint     # ESLint
```
Setup с нуля — см. [docs/SETUP.md](./docs/SETUP.md).

## Инструкции для следующей сессии Claude Code

1. Начни с `mempalace_search("transcribe-app")` и чтения этого файла.
2. Если задача в P1 из `.business/BACKLOG.md` — бери её первой.
3. При любом продуктовом решении — сверяйся с `.brand/positioning.md` (что мы делаем / не делаем).
4. При монетизационных решениях — `.business/DECISIONS.md` + `SPECIFICATION.md §5`.
5. При изменении API / flow — обновляй `SPECIFICATION.md`.
6. При добавлении задач — пиши в `.business/BACKLOG.md`, не в коде и не в комментариях.
7. **Не создавай новые .md-документы в корне.** Клади в `.business/`, `.brand/`, `docs/`.

## Память (MemPalace)
- Старт: `mempalace_search("transcribe-app")` — найти предыдущий контекст
- "сохрани": `mempalace_kg_add` / `mempalace_add_drawer` → обновить соответствующие .md → git commit
- При compact: сохрани важный контекст до сжатия
