# SETUP — transcribe-app

Как поднять проект локально с нуля. macOS / Linux. Node 22+.

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
| `GLADIA_API_KEY` | https://app.gladia.io → API keys. Проверить актуальные credits/billing; прежние 10 бесплатных часов в месяц заменены разовым кредитом |
| `GROQ_API_KEY` | https://console.groq.com → API keys (free tier есть) |
| `NEXT_PUBLIC_APP_URL` | локально: `http://localhost:3000`, prod: ваш домен |
| `TELEGRAM_BOT_TOKEN` | @BotFather → /newbot, токен вашего бота |
| `TELEGRAM_SECRET_TOKEN` | `openssl rand -hex 32` |
| `TELEGRAM_BOT_USERNAME` | имя бота без `@`. Ссылка «подключить» ведёт на него |
| `OWNER_USER_ID` | необязательно. UUID вашего пользователя в Supabase, если личные ключи Gladia/Groq должны идти только ему. Остальные берут `*_PUBLIC`, а если их нет — те же ключи |

### Анализ фотографий через Vertex AI

Бот получает доступные публичные фото, видео и карусели по ссылкам, передаёт авторскую подпись отдельно и сохраняет порядок слайдов. Для изображений Gemini либо переписывает надписи на исходном языке, либо описывает изображение по-русски. Фото не отправляются в сервис распознавания речи.

Задать **только в серверном окружении**:

| Переменная | Назначение |
|---|---|
| `VERTEX_PROJECT_ID` | Проект Google Cloud с действующим trial и включённым Vertex AI |
| `VERTEX_LOCATION` | Регион модели; по умолчанию `global` |
| `VERTEX_MODEL` | По умолчанию `gemini-3.8-flash`; доступная модель Gemini с image input и structured output |
| `GOOGLE_APPLICATION_CREDENTIALS` | Абсолютный путь к внешнему файлу ADC, смонтированному read-only в контейнер приложения |
| `VERTEX_TRIAL_EXPIRES` | Дата `YYYY-MM-DD`: анализ прекращается с начала этой даты по UTC |

Файл авторизации содержит секреты. Он должен находиться **вне checkout/build context**, подключаться secret mount при запуске и не попадать в Docker image, `public/`, git или клиентские переменные `NEXT_PUBLIC_*`. Загрузчик не получает credentials Vertex. Для сервера использовать отдельную учётную запись с минимальными правами на вызов Vertex; пользовательский ADC разработчика не включать в образ.

Наличие файла на компьютере разработчика не настраивает контейнер автоматически. Перед выкладкой отдельно проверить серверный mount и доступ к выбранному проекту. Дата trial защищает от использования просроченной настройки, но не является проверкой денежного остатка кредита. При отсутствии настройки/отказе сервиса бот всё равно отдаёт скачанные медиа и подпись, сообщая о недоступности анализа; резервный платный провайдер не включается.

### Проверка секретов

Перед коммитом и публикацией:

```bash
gitleaks git --redact --no-banner .
gitleaks dir --redact --no-banner src
gitleaks dir --redact --no-banner downloader
gitleaks dir --redact --no-banner scripts
```

CI сканирует всю историю. `.gitleaksignore` содержит только конкретные проверенные fingerprints ложных срабатываний на публичный ID модели, а не разрешение хранить ключи. `.env.local`, `.secrets/`, `credentials/` и типовые имена файлов ADC исключены из git. `.gitignore` не удаляет уже опубликованные секреты из истории.

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
node --test scripts/*.test.mjs downloader/*.test.mjs
uv run --script downloader/test-threads.py
```

## 8. Структура проекта

См. `docs/MAP.md` — актуальная карта модулей и проверок.

## 9. Деплой

Приложение и downloader развёртываются отдельными службами на Coolify + Hetzner. У них общий каталог outgoing для локального Telegram Bot API; секреты приложения и Vertex не передаются downloader. Серверная авторизация Vertex задаётся при развёртывании, а не в репозитории.
