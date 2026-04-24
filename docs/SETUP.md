# SETUP — transcribe-app

Как поднять проект локально с нуля. macOS / Linux. Node 20+.

---

## 1. Клон и зависимости

```bash
git clone <repo-url> transcribe-app
cd transcribe-app
npm install
```

## 2. Environment

Скопировать шаблон и заполнить реальные значения:

```bash
cp .env.example .env.local
```

Затем открыть `.env.local` и проставить:

| Переменная | Где взять |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | там же → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | там же → service_role key (**секрет, никогда в git**) |
| `GLADIA_API_KEY` | https://app.gladia.io → API keys (есть free tier 10h/мес) |
| `GROQ_API_KEY` | https://console.groq.com → API keys (free tier есть) |
| `NEXT_PUBLIC_APP_URL` | локально: `http://localhost:3000`, prod: `https://transcribo.app` |

## 3. Supabase

### 3.1 Создать проект
Supabase → New project. Регион: желательно `us-east-1` или `sa-east-1` для latency LATAM.

### 3.2 Применить миграции

**Вариант A — SQL Editor в Dashboard:**
1. Открыть каждый файл из `supabase/migrations/` по очереди (сначала `0001_init.sql`, потом `20260414000000_credits.sql`).
2. Скопировать содержимое → SQL Editor → Run.

**Вариант B — Supabase CLI** (если установлен):
```bash
supabase link --project-ref <your-ref>
supabase db push
```

### 3.3 Storage bucket
1. Storage → Create bucket → имя `audio-files`.
2. **Public = OFF** (приватный — см. AUDIT A2, фаза 5 фиксов).
3. В Policies добавить policy «authenticated users can upload to own path», если нужно. Для service_role доступа policies не нужны.

### 3.4 Google OAuth
1. Authentication → Providers → Google → Enable.
2. В Google Cloud Console создать OAuth 2.0 Client:
   - Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Paste Client ID + Client Secret в Supabase.

## 4. Запуск

```bash
npm run dev
```

Открыть http://localhost:3000.

## 5. Проверка работоспособности

1. Зайти на `/` — должна появиться dropzone.
2. Drag-drop короткий mp3 (10–20 сек).
3. После детекта duration — нажать Transcribe.
4. Должен быть redirect на `/transcription/<id>`.
5. Через 10–30 сек — результат с текстом и резюме.

Если сломалось — смотреть консоль браузера и терминал с `npm run dev`.

## 6. Частые проблемы

| Проблема | Причина | Решение |
|---|---|---|
| «Failed to reserve credits» | Миграция `credits.sql` не применена | Применить миграцию (шаг 3.2) |
| «Gladia upload failed 401» | Неверный или пустой `GLADIA_API_KEY` | Проверить `.env.local` |
| «Storage upload error» | Bucket `audio-files` не создан | Шаг 3.3 |
| Google OAuth redirect loop | Неверный redirect URI в Google Console | Должен быть `<supabase-url>/auth/v1/callback` |
| Транскрипция зависает в «processing» | Gladia не отвечает или timeout | Проверить статус в https://app.gladia.io; подождать до 5 мин |

## 7. Скрипты

```bash
npm run dev       # dev сервер
npm run build     # продакшн build
npm run start     # запуск prod build локально
npm run lint      # ESLint
```

## 8. Структура проекта

См. `CLAUDE.md` в корне — там актуальная карта папок и бизнес-логики.

## 9. Деплой

Не описан здесь. Пока продукт деплоится на Coolify + Hetzner (см. `~/Projects/CLAUDE.md`).
