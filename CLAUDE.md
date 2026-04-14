# CLAUDE.md — transcribe-app

## Старт сессии
1. Найди контекст в mempalace: `mempalace_search("transcribe-app")`
2. Прочитай этот файл
3. Скажи пользователю, на чём остановились в прошлый раз

## Команда "сохрани"
Когда пользователь пишет **"сохрани"**:
1. Сохрани ключевые решения/факты сессии в mempalace (`mempalace_kg_add` или `mempalace_add_drawer`)
2. Обнови этот файл (CLAUDE.md) если появились новые правила или структурные изменения
3. Сделай `git add -A && git commit` с описательным сообщением на русском

## Что это
PWA для мультиязычной транскрипции аудио/видео с разделением спикеров.
Пользователь загружает файл → получает текст с тегами спикеров и резюме.

## Стек
Next.js App Router · TypeScript · Tailwind
Supabase (auth, storage, postgres RLS)
Gladia API v2 (транскрипция + diarization)
Groq API (резюме — модель llama-3.3-70b-versatile)
next-pwa (Web Share Target)

## Правила
- App Router, Server Components по умолчанию
- Client Components только где нужна интерактивность
- Вся бизнес-логика в src/lib/
- Supabase service_role key только в API routes
- Gladia: diarization true, polling каждые 5с, макс 60 попыток
- Тёмная тема: фон #0a0a0a, акцент #e2ff00
- Mobile-first

## Структура БД
profiles: id, email, display_name, credits_seconds (DEFAULT 1200), is_unlimited (DEFAULT false), created_at
transcriptions: id, user_id (nullable), file_name, file_url,
  duration_seconds, language, status, result (jsonb),
  gladia_result_url, reserved_seconds, created_at
anonymous_usage: ip (PK), used_seconds, updated_at

## Система кредитов
- Аноним: лимит 180 сек по IP (таблица anonymous_usage)
- Auth: credits_seconds остаток (стартовый подарок 1200 сек = 20 мин)
- is_unlimited = true → проверки не нужны
- Паттерн: резервирование при загрузке → корректировка по факту Gladia
- Атомарность: Postgres RPC-функции (reserve/adjust/refund для user и anon)
- src/lib/credits.ts — единственное место с кредитной логикой
- UploadZone: detectDuration через HTMLVideoElement, передаёт duration_hint в FormData

## Авторизация
- Google OAuth через Supabase Auth
- Cookie-сессии через @supabase/ssr
- src/proxy.ts — refresh сессий (Next.js 16.2)
- /login — страница входа, /auth/callback — OAuth обработчик
- /history защищена (redirect на /login)

## Pending
- Миграция supabase/migrations/20260414000000_credits.sql — применить в Supabase Dashboard
- /billing страница — не создана (ссылка есть в UploadZone)

## Env переменные
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GLADIA_API_KEY
GROQ_API_KEY
NEXT_PUBLIC_APP_URL

## Команды
npm run dev / build / lint

## Память (MemPalace)
- Старт: `mempalace_search("transcribe-app")` — найти предыдущий контекст
- "сохрани": `mempalace_kg_add` / `mempalace_add_drawer` → обновить CLAUDE.md → git commit
- При compact: сохрани важный контекст до сжатия
