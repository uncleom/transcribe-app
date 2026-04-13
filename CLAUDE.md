# CLAUDE.md — TranscribeApp

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
profiles: id, email, display_name, created_at
transcriptions: id, user_id, file_name, file_url,
  duration_seconds, language, status, result (jsonb), created_at

## Env переменные
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GLADIA_API_KEY
GROQ_API_KEY
NEXT_PUBLIC_APP_URL

## Команды
npm run dev / build / lint
