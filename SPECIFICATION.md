# SPECIFICATION — transcribo.app

**Документ «что и зачем», не «как».** Для «как» — смотреть код в `src/`, миграции в `supabase/`, setup в `docs/SETUP.md`.

**Версия:** v1.1 (2026-05-12)
**Связанные документы:**
- `business/MARKET_RESEARCH.md` — рынок и стратегия
- `business/AUDIT.md` — текущее состояние кода
- `business/BACKLOG.md` — приоритизированный список работ
- `business/DECISIONS.md` — журнал ключевых решений
- `business/VALIDATION_PLAN.md` — план smoke-test
- `brand/positioning.md` — USP, персоны, tone of voice
- `brand/landing_copy_es.md` — испанский лендинг

---

## 1. Продукт

### 1.1 Что это
Веб-приложение (PWA) для автоматической транскрипции аудио и видео в текст. Пользователь загружает файл (или шарит из WhatsApp) — получает транскрипт с разделением спикеров и кратким резюме.

### 1.2 Для кого
**Primary:** испаноязычные создатели контента в LATAM (Argentina, Mexico, Colombia, Chile) — подкастеры, журналисты, юристы-одиночки, студенты.
**Secondary:** португалоязычные creators в Brazil.
**Out of scope:** корпоративные meeting-knowledge workers (это рынок Otter), video/podcast editors (это Descript/Riverside), bureau-style human transcription buyers (Rev, GoTranscript).

### 1.3 Какую проблему решает
- Ручная расшифровка аудио занимает 3–4× длительности самого файла.
- Существующие AI-инструменты (Otter, Descript) English-first, не принимают MercadoPago, не заточены под mobile-sharing.
- Нативная транскрипция WhatsApp не сохраняет историю и работает только пo-сообщению.

### 1.4 USP (source of truth — `brand/positioning.md`)
**LATAM-first + es/pt native + WhatsApp Share Target + MercadoPago + PAYG.**

---

## 2. Пользовательские сценарии

### 2.1 Анонимный пользователь (3 минуты бесплатно)
1. Открывает `transcribo.app`.
2. Перетаскивает mp3 длиной 2 мин или открывает с телефона → Share из WhatsApp → выбирает transcribo.app.
3. Клиент определяет длительность через HTMLVideoElement → отправляет `duration_hint` на `/api/credits`.
4. Если 2 мин ≤ (180 − уже использовано по IP) → кнопка «Transcribe» активна.
5. Клик → сервер резервирует 120 сек для anon_usage по IP → upload → Gladia.
6. Redirect на `/transcription/<id>`, polling каждые 5 сек.
7. Через 10–60 сек показывается транскрипт + diarization + резюме (без watermark на экспорте для всех tiers).

### 2.2 Авторизованный пользователь (20 минут бесплатно в подарок)
1. Логинится через Google (Supabase OAuth).
2. При первом логине `profiles.credits_seconds = 1200` (приветственный подарок).
3. Загружает файл, всё как в 2.1, но кредиты списываются с `profiles.credits_seconds`.
4. Доступ к `/history` — список всех своих транскрипций.
5. Когда credits_seconds = 0 и попытка загрузить → UI показывает «Недостаточно кредитов» + ссылка на `/billing`.

### 2.3 Платящий пользователь (PAYG)
1. Кликает «Пополнить» на `/billing` (либо inline в UploadZone).
2. Выбирает один из 3 пакетов: $5 (10hr) / $10 (30hr) / $20 (80hr).
3. Кликает «Comprar» → redirect в MercadoPago preference URL.
4. Платит картой / Rapipago / Mercado Pago balance.
5. MercadoPago webhook → `/api/mercadopago/webhook` → зачисление секунд в `profiles.credits_seconds`.
6. Пользователь возвращается на `/billing?success=true` → показывается обновлённый баланс.

**Важно:** кредиты не имеют срока годности (см. DECISIONS.md). Нет подписок на первой версии.

---

## 3. Функциональные требования

Что продукт **делает**. Как — в коде.

### 3.1 Загрузка файлов
- Принимает аудио: mp3, wav, m4a, ogg, webm, flac.
- Принимает видео: mp4, webm, mov (аудиодорожка транскрибируется).
- Лимит размера: **500 MB** на файл.
- Лимит длительности: ограничен доступными кредитами пользователя (не файлом).
- Drag-drop + клик + Web Share Target (Android/iOS через PWA manifest).
- Детект длительности на клиенте до upload для точной оценки кредитов.

### 3.2 Транскрипция
- **Движок:** Gladia API v2 (async transcription).
- **Языки:** автодетект. Приоритет es (все варианты), pt-BR, en.
- **Diarization:** всегда включена (разделение спикеров).
- **Точность:** 95%+ на чистом аудио (заявление Gladia).
- **Polling:** сервер делает 1 ping за запрос, клиент polling каждые 5 сек. Max 5 мин total (60 попыток × 5 сек).
- **Результат:** список utterances (speaker, start, end, text, confidence, language) + full_transcript + detected language + duration.

### 3.3 Резюме
- **Движок:** Groq API, модель `llama-3.3-70b-versatile`.
- **Язык ответа:** совпадает с detected language транскрипта.
- **Формат:** структурированный summary с key topics и action items (если релевантно).
- **Temperature:** 0.3 (стабильный, не творческий).
- **Max tokens:** 1024.
- Генерируется после транскрипции в том же request-handler.
- Non-blocking: если summary падает — транскрипт всё равно сохраняется.

### 3.4 Система кредитов
- **Anon:** 180 секунд суммарно на IP (таблица `anonymous_usage`).
- **Auth:** стартовый подарок 1200 сек (20 мин), флаг `is_unlimited = true` для test-accounts.
- **Резервирование:** при upload списывается `duration_hint` атомарно через Postgres RPC.
- **Корректировка:** после реального ответа Gladia — diff между reserved и actual возвращается или доначисляется.
- **Refund:** полный возврат при ошибке транскрипции.
- **Единственное место логики:** `src/lib/credits.ts` + RPC в `supabase/migrations/20260414000000_credits.sql`.

### 3.5 Экспорт (P2-задача, см. BACKLOG E1)
Планируется:
- `.txt` — plain text с именами спикеров.
- `.srt` — стандартные субтитры с timestamps.
- `.vtt` — Web Video Text Tracks для HTML5 video.

На MVP: только copy-to-clipboard (уже реализовано).

### 3.6 PWA — Installable (готово, A6)
- `public/manifest.json`: name "Transcribo", display standalone, тёмная тема.
- Service worker через next-pwa: NetworkFirst для app-shell, NetworkOnly для `/api/*`.
- `InstallBanner` компонент: Android — нативный install prompt через `beforeinstallprompt`; iOS — инструкция "Safari → Поделиться → На экран Домой".
- Баннер скрывается после установки (standalone mode) или закрытия (localStorage).

### 3.6.1 Web Share Target (P2-задача, BACKLOG A4)
Планируется отдельно:
- `share_target` action в manifest.json.
- POST `/share-target` принимает `audio/*` и `video/*` из share sheet (Android Chrome only).
- На клиенте — UploadZone с уже прикреплённым файлом из Share.
- iOS не поддерживает Web Share Target; iOS-решение — отдельно через Shortcut + API токен (BACKLOG B2).

### 3.7 Авторизация
- Google OAuth через Supabase Auth.
- Cookie-сессии через `@supabase/ssr`.
- Refresh сессий в `src/proxy.ts` (Next.js 16 middleware).
- Защищённые страницы: `/history`, `/billing`. Redirect на `/login` для неавторизованных.

### 3.8 История
- `/history` — список всех транскрипций пользователя.
- Сортировка по дате (новые сверху).
- Превью: имя файла, дата, язык, длительность, статус.
- Клик → `/transcription/<id>`.

### 3.9 Просмотр транскрипции
- `/transcription/<id>` — детальная страница.
- Цветные бейджи спикеров (6 цветов циклически).
- Timestamps в формате `m:ss`.
- Блок резюме (жёлтый accent).
- Copy-all кнопка.

---

## 4. Нефункциональные требования

### 4.1 Безопасность
- **Секреты:** все через `process.env`, `.env.local` в `.gitignore`, `.env.example` без значений.
- **Service role key:** только в API routes, никогда в client code.
- **Auth:** все защищённые endpoints проверяют `supabase.auth.getUser()` или `user_id`.
- **Storage:** приватный bucket, доступ через signed URLs (см. AUDIT A2, плановая работа).
- **Валидация файлов:** mime-type whitelist + size limit на server.
- **Санитизация путей:** имена файлов нормализуются перед сохранением (AUDIT A3).
- **Rate-limiting:** per-IP и per-user на `/api/transcribe` (P2-задача, BACKLOG A4).

### 4.2 Производительность
- **Upload:** XHR с progress bar, до 500 MB.
- **Транскрипция 10 мин аудио:** ≤ 60 сек wall-time (Gladia async).
- **Summary:** ≤ 5 сек (Groq, llama-3.3-70b).
- **Page load:** < 2 сек на 3G mobile (next/font optimization, Tailwind purging).

### 4.3 Доступность
- **Mobile-first:** вся вёрстка адаптивна, touch-friendly (min 44px tap targets).
- **PWA:** устанавливаемая, offline-fallback для статичных ассетов.
- **Keyboard:** UploadZone focus-visible, Enter/Space активация.
- **ARIA:** role="button", aria-label на интерактивных элементах.

### 4.4 Локализация
- **Primary:** es-AR (Argentina). Все main-path копии на нём.
- **Secondary:** es-MX, es-CO, pt-BR, en — через тот же словарь, но с локальными вариантами модальных глаголов и pronouns.
- **Implementation:** next-intl или локальный i18n словарь (P2-задача, BACKLOG A10).
- **Текущее состояние:** смешанный ru/en в UI (см. AUDIT A10) — чинится в P2.

---

## 5. Монетизация

### 5.1 Модель
**PAYG (pay-as-you-go)**, не подписка. Решение и обоснование — `DECISIONS.md` 2026-04-23.

### 5.2 Пакеты

| Пакет | Цена USD | Часы | Эквивалент в секундах |
|---|---|---|---|
| Ensayo | $5 | 10 hr | 36 000 |
| Creador | $10 | 30 hr | 108 000 |
| Pro | $20 | 80 hr | 288 000 |

**Кредиты не expire.** Купленные секунды хранятся в `profiles.credits_seconds` до использования.

### 5.3 Платёжные системы

**На MVP:** MercadoPago AR (покрывает Argentina, Mexico, Colombia, Chile single integration).
**Fallback:** Stripe для пользователей из US/EU (там где MercadoPago не работает).
**Расширения (P3, см. BACKLOG):**
- Pix через MercadoPago Brasil или EBANX (P2).
- OXXO Pay через MercadoPago MX (P3).

### 5.4 Себестоимость (unit economics)

| Компонент | Тариф | На $10 пакет (30 часов) |
|---|---|---|
| Gladia Starter | $0.61/hr | $18.30 (убыток — не использовать) |
| Gladia Growth (volume commit) | $0.20/hr | $6.00 |
| Groq (summary) | ~$0.10/час audio | ~$3.00 |
| Supabase Storage | $0.021/GB | ~$0.05 per 500MB |
| **Total COGS** | | **~$9.05 на $10 пакет** |
| **Gross margin** | | **~9.5% на Gladia Growth** |

**Вывод:** pricing тонок. Чтобы масштабироваться — нужны volume-commits у Gladia (после 50+ платящих). До этого — убыток, это часть валидационного бюджета.

### 5.5 Процессинг
- Webhook от MercadoPago → `/api/mercadopago/webhook` (P1, see BACKLOG M1).
- Idempotency: payment_id в webhook → проверка что уже не обработан.
- Зачисление: RPC `credit_purchased(p_user_id, p_seconds, p_payment_id)` — добавляет секунды атомарно.

---

## 6. Границы MVP

### 6.1 Входит в MVP
- ✅ Upload + transcription + summary (готово).
- ✅ Credits system anon + auth (готово).
- ✅ Google OAuth (готово).
- ✅ `/billing` заглушка (готово).
- ✅ Security-хардёнинг: auth-check, private storage, filename sanitize (готово).
- ✅ PWA installable: manifest + SW + InstallBanner Android/iOS (готово — BACKLOG A6).
- 🔨 Реальный MercadoPago checkout + webhook (следующий спринт — BACKLOG M1).
- 📅 Web Share Target Android (BACKLOG A4).
- 📅 iOS Shortcut с API-токеном (BACKLOG B2).
- 📅 Локализация UI на es-AR (BACKLOG A10).
- 📅 Экспорт `.txt/.srt/.vtt` (BACKLOG E1).

### 6.2 НЕ входит в MVP (явно)

- ❌ Meeting-bot / Zoom integration.
- ❌ Desktop audio/video editor.
- ❌ Team seats / multi-user workspaces.
- ❌ Public API для третьих лиц.
- ❌ Real-time / live transcription.
- ❌ Voice cloning / TTS.
- ❌ Subscription billing (пока PAYG).
- ❌ Human-in-the-loop editing / professional transcription service.
- ❌ Mobile native apps (остаёмся PWA).

---

## 7. Open-core стратегия

**Решение:** `DECISIONS.md` 2026-04-23. Мотивация — `MARKET_RESEARCH.md` §5.2–5.4.

### 7.1 Open (MIT, отдельный public repo — планируется)

- UI-компоненты: `UploadZone`, `LogoutButton` (без бизнес-обвязки).
- Supabase RPC-паттерны: atomic credit reservation (generic template).
- PWA Share Target boilerplate + Next.js 16 proxy.ts setup.
- Postgres migrations — generic версия без бизнес-constants (180, 1200).
- Примеры интеграции Gladia + Groq.

### 7.2 Closed (private repo — текущий)

- Production integrations с Gladia/Groq (retry, error handling, polling optimizations).
- Billing/MercadoPago/Stripe webhooks + idempotency.
- Anti-abuse: rate-limits, IP heuristics, anomaly detection.
- Onboarding flows, localization, marketing copy.
- SEO / landing pages / ads creatives.
- Partnerships, discount codes.

### 7.3 Никогда не в git
- Все API keys, service_role keys.
- MercadoPago credentials.
- Google OAuth client_secret.
- Любой `.env*` кроме `.env.example`.
