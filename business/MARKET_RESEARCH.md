# MARKET RESEARCH — transcribe-app (transcribo.app)

**Дата:** 2026-04-23
**Автор:** Олег + Claude
**Статус:** v1 draft, требует валидации интервью (раздел 4)
**TL;DR:** Рынок большой и растёт. Прямых конкурентов-аналогов для LATAM-first + испаноязычной + дешёвой транскрипции **нет**. Честная USP у transcribe-app в его нынешнем виде — не «WhatsApp-first», а «LATAM-first Spanish/Portuguese PWA + Web Share Target». Рекомендую **монетизировать** по freemium, **не открывать исходники целиком** (open-core максимум).

**Валидация без интервью** (Олег не владеет es/pt, нет контактов в LATAM): замена на (а) прокси-сигналы из публичных данных — keyword volume, отзывы в App Store LATAM через translate, трафик конкурентов — и (б) **paid smoke-test: лендинг на испанском + $150 на Meta Ads + реальные MercadoPago-платежи**. Сильнее интервью, т.к. измеряет платёжеспособность, а не слова. Детали — раздел 4. Языковой барьер превращается в издержку ~$200–300/мес на native-редактора из Workana для копирайта и support-шаблонов (раздел 4.3–4.4).

---

## 0. Что такое transcribe-app прямо сейчас (контекст)

Это PWA-продукт на transcribo.app:
- Загрузка аудио/видео → Gladia (транскрипция + diarization) → Groq (резюме на llama-3.3-70b).
- Анонимный лимит 180 сек / IP, подарок авторизованному 1200 сек.
- Мобайл-фёрст, Web Share Target (шаринг из WhatsApp/Telegram/системного share menu).
- Нет billing-страницы, нет платежей. Domain уже куплен.

**Важная оговорка по USP в исходном промте.** «WhatsApp-first» в строгом смысле — это другой продукт (VoiceTaskBot и voxreel, см. `~/Projects/CLAUDE.md`). Сам transcribe-app — **PWA со Share Target**, то есть пользователь шарит голосовое из WhatsApp в PWA. Это **не chat-first**, это «on-ramp из мессенджера в веб-страницу». Это влияет на позиционирование (раздел 3).

---

## 1. Конкурентный анализ

### 1.1 Таблица сравнения

| Продукт | Вход. цена (USD/мес) | Что дают | Целевая аудитория | Сильные стороны | Слабые стороны |
|---|---|---|---|---|---|
| **Otter.ai** | Free 300 min → **$16.99** Pro 1200 min → $30 Business | Meeting notes, live-транскрипция Zoom/Meet, AI-чат по расшифровкам | Enterprise meetings, US knowledge workers | Интеграции с календарём, meeting bot, распознаёт говорящих по голосу | Плохой es-AR, нет Portuguese-BR как приоритета, UI на английском, US-first |
| **Descript** | Free 1hr → **$15** Creator 10hr → $30 Pro 30hr | Audio/video editor с транскрипцией, «редактируй текст — меняется звук», Overdub (AI voice) | Podcasters, YouTube creators (US/EU) | Лучший editor-first UX, studio-sound, AI-voice cloning | Тяжёлый desktop-app, дорого при большом объёме, не заточен под es/pt |
| **Happy Scribe** | **$8.50–17** Basic → $19–29 Pro → $59–89 Business | Транскрипция + субтитры, 120+ языков, human+AI гибрид | Journalists, researchers, subtitlers EU | Субтитры высокого качества, человеческая транскрипция как опция | Медленный, UI перегруженный, не mobile-first |
| **Riverside.fm** | $15–24 Standard → $24–39 Pro | Удалённая запись подкастов в студийном качестве, встроенная транскрипция | Podcast/video-интервью creators | Lossless локальная запись каждого участника, отдельные треки | Не транскрипционный продукт «на ходу», требует планирования записи |

**Gotranscript / Rev / Sonix** — human+AI bureau-style, $0.25–$1.50/мин, hardcore для СМИ и юристов.

### 1.2 Почему они успешны

- **Otter**: точно решил боль корпоративных meeting-notes в эпоху Zoom-бума 2020–2022. Встроился в календари. Enterprise-контракты.
- **Descript**: перевернули редактирование подкастов — «редактируй текст, меняется звук». Это не транскрипция, это editor.
- **Happy Scribe**: ставка на локализацию (120 языков) и субтитры для медиа.
- **Riverside**: поймали волну удалённых подкастов в пандемию, lossless-запись — моат.

### 1.3 Где слабы

1. **Все — English-first.** UI английский, маркетинг английский, поддержка в часовых поясах US/EU. Даже у Happy Scribe (EU) LATAM — хвост.
2. **Цены в USD без локализации.** $17/мес = ~22 000 ARS при курсе апреля 2026 (проверить). Для аргентинского подкастера это непосильно как recurring.
3. **Платежи:** Stripe only (Descript, Otter), card-first. Нет MercadoPago/Pix/OXXO как нативных методов. Это **огромная** барьер для LATAM: у многих нет international credit card, и даже если есть — они не хотят с неё платить из-за cepo cambiario.
4. **Нет mobile-first UX.** Otter и Descript — это desktop/browser-приложения. В LATAM основной экран — телефон.
5. **Нет WhatsApp-моста.** Целый workflow «шарить голосовое из чата в транскрипцию» не покрыт ни одним из четырёх конкурентов. Есть только *нативная* транскрипция WhatsApp, которую надо жать вручную на каждое сообщение и которая не сохраняет историю.

### 1.4 Что это значит для нас

Слабости 1–5 выше = **наши потенциальные слоты**. Особенно связка (2+3+5): UI на испанском + MercadoPago + PWA со Share Target.

---

## 2. LATAM-рынок

### 2.1 Размер и темпы

- LATAM SaaS: **$21B (2024) → $45B (2030)**, CAGR 12.5%. Источник: Grand View / EBANX.
- Brazil ~45%, Mexico ~20%, Argentina ~8% регионального SaaS-спенда.
- 98% компаний — SME, цифровизация растёт.
- Подкасты LATAM 2023: **135M слушателей**, Mexico 27.5M, Argentina 10.4M. Рост listenership Chile/AR/PE/MX: **+45–80%** за последние годы.
- Глобальный рынок подкастинга 2026: ~$32–40B.

### 2.2 Кто платит за транскрипцию в Аргентине/Мексике/Колумбии/Бразилии

Ранжирую по вероятности реальной платёжеспособности за подписку $5–15/мес:

1. **Контент-создатели / подкастеры** — нужны транскрипты для показа в Spotify, YouTube chapters, блог-переупаковка. Готовы платить **$5–15/мес**, если видят ROI в часах экономии.
2. **Юристы / нотариусы (abogados)** — записывают клиентов, консультации, показания. Традиционно платят 500–2000 ARS/мин (на апрель 2026) человеческим транскрайберам. Готовы на AI за **$15–40/мес**, если есть tiers по часам.
3. **Журналисты / студенты-исследователи** — интервью на диктофон → расшифровка. Обычно soyfreelancer/gotranscript по $0.20–$1/мин. Готовы на подписку **$8–15/мес**.
4. **Бухгалтеры / аудиторы** — совещания с клиентами, юр. заседания. Enterprise-бюджеты, но длинный цикл продажи.
5. **Медиа (СМИ, YouTube-каналы)** — субтитры, быстрая расшифровка интервью. Нужен B2B pricing.

**Ненаш сегмент:** корпоративные meetings / Zoom-боты (это Otter territory, там цикл продажи 3–6 мес и нужен sales-rep).

### 2.3 Ценовая чувствительность

- **Аргентина 2026**: гиперинфляция + cepo → стратегия **цены в USD** (как и советует EBANX). Реально работают $3–7/мес entry-level, $10–15 paid, $25+ уже премиум.
- **Бразилия**: Pix доминирует (70%+ населения), люди охотнее платят в BRL. BRL 15–30/мес entry, BRL 50–80 premium. Pix снижает churn vs карточных подписок.
- **Мексика**: OXXO Pay cash-digital растёт (>$6B в 2024). Карты работают хуже у SMB, много unbanked. $5–12/мес USD, либо MXN 100–250.
- **Колумбия**: card penetration средняя, Nequi/PSE для локалов. USD $4–10/мес.

**Общая эвристика:** Netflix LATAM заряжает ~$7–10 эквивалент — это психологический benchmark. Наш продукт должен быть **≤$10/мес** для entry tier, чтобы не биться с Netflix/Spotify за кошелёк.

### 2.4 Платежи: что реально использовать

| Страна | Must-have | Nice-to-have |
|---|---|---|
| Argentina | **MercadoPago** (preapproval/subscriptions) | Stripe (для иностранцев) |
| Brazil | **Pix** (через EBANX / dLocal / MercadoPago Brasil) | Boleto, Stripe |
| Mexico | **OXXO Pay** + карты (через MercadoPago MX / dLocal) | Stripe |
| Colombia | **PSE** + Nequi | Stripe |

Для старта: **MercadoPago** покрывает AR/BR/MX/CO/CL в одной интеграции + subscriptions API есть (`/developers/en/docs/subscription-plans/overview`). Stripe — для gringos. Этого для MVP достаточно.

---

## 3. USP (честно)

### 3.1 Что уникально у нас сегодня

Сравнение слоёв:

| Слой | Otter | Descript | Happy Scribe | Riverside | **transcribo.app** |
|---|---|---|---|---|---|
| Spanish/Portuguese как 1st-class | ✗ | ✗ | ✓ (один из 120) | ✗ | **✓ (native focus)** |
| UI на es-AR/pt-BR | ✗ | ✗ | частично | ✗ | **✓** (планируется) |
| MercadoPago / Pix | ✗ | ✗ | ✗ | ✗ | **✓** (планируется) |
| Mobile PWA со Share Target | ✗ | ✗ | ✗ | ✗ | **✓ (уже есть)** |
| Free tier 20 min без карты | частично | частично | нет | нет | **✓ (уже есть)** |
| Anonymous 3 min без регистрации | ✗ | ✗ | ✗ | ✗ | **✓ (уже есть)** |
| Desktop editor (аудио/видео) | ✗ | ✓✓ | ✗ | ✓ | ✗ |
| Meeting-bot (Zoom/Meet) | ✓✓ | ✗ | ✗ | ✗ | ✗ |

### 3.2 Итоговая USP-формулировка

> **«Испаноязычная транскрипция голосовых и интервью для LATAM-создателей контента. Работает с телефона. Шерь из WhatsApp → получи текст и резюме. Платишь через MercadoPago.»**

Не «WhatsApp-bot», не «Otter для LATAM». Более фокусированно:
- **Языки:** es (AR, MX, CO, CL, regional), pt-BR — first-class. En — supported but not primary.
- **Сценарий входа:** мобильный Share Target из WhatsApp/Telegram/диктофона.
- **Оплата:** MercadoPago по умолчанию.
- **Цена:** $5–7/мес entry, $12–15/мес pro.

### 3.3 Есть ли gap на рынке?

**Да, гибридный gap:**
1. Языковой gap (никто из big-4 не заточен на es-AR/pt-BR как primary).
2. Payment gap (никто не принимает MercadoPago/Pix нативно).
3. UX gap (никто не сделал PWA для шаринга голосовых из чата).
4. Price gap (даже Happy Scribe Basic $8.50 — это ~$11 с налогами в LATAM, а с US card — проблема).

**Risk:** гэп не значит что там есть рынок. 10.4M слушателей подкастов в AR ≠ 10.4M потенциальных клиентов. Нужна валидация (раздел 4).

---

## 4. Валидация БЕЗ интервью

**Constraint (важно, учтено в планировании):** Олег не владеет es/pt и не имеет прямых контактов в LATAM-комьюнити. Значит customer-discovery через разговоры отпадает. Ниже — только количественные сигналы и публичные данные, которые можно собрать в одиночку, не говоря ни с кем.

Сильный сигнал → слабый сигнал:

### 4.1 Настоящий platinum-сигнал: реальные платежи (paid smoke-test)

Продукт уже работает. Вместо теоретической валидации — **запустить платную версию и посмотреть, покупают ли**. Это сильнее любого интервью.

**Конфигурация:**
1. Прикрутить **MercadoPago PAYG-пакеты** ($5 = 10hr, $10 = 30hr, $20 = 80hr). Sandbox → production.
2. Лендинг на испанском (AR-вариант первый, т.к. MercadoPago там сильнее всего). Копирайт генерит Claude/GPT, UX-copy проверяется через обратный перевод + native-review через Upwork ($20 за 1 час вычитки es-AR носителя — **это разовое, без разговора, только правки в документе**).
3. **Бюджет: $150 на Meta Ads** (Instagram/FB), таргет: AR + MX, интересы «podcast», «periodismo», «abogados jóvenes», возраст 25–45.
4. **Период:** 7 дней.

**Что смотрим (в порядке важности):**
| Метрика | Зелёный сигнал | Жёлтый | Красный |
|---|---|---|---|
| **Платящих за $5** | ≥5 за неделю ($0.71 CAC отлично) | 1–4 (CAC $30–150, плохо но есть PMF) | 0 (нет спроса или не та аудитория) |
| CTR ads → landing | ≥1.5% | 0.8–1.5% | <0.8% |
| Landing → клик «Suscribirme» | ≥5% | 2–5% | <2% |
| Click → реальная оплата | ≥10% | 3–10% | <3% |

**Решающее правило:** если за $150 ты получил **0 платящих**, монетизировать рано. Если получил ≥3 — есть signal, вливай ещё $500 для confidence.

Этот единственный эксперимент заменяет 20 интервью и даёт более честный ответ.

### 4.2 Прокси-сигналы из публичных данных (бесплатно, за 4–6 часов)

**A. SEO keyword-volume (Google Keyword Planner / Ahrefs free):**
- `transcribir audio a texto` — объём по AR/MX/CO/BR
- `pasar audio a texto` (LATAM-friendly формулировка)
- `transcripción WhatsApp`
- `subtítulos español automáticos`
- `transcribir podcast`

Высокий объём (>10k/мес по региону) = спрос есть. Низкий CPC (<$0.50) = покупатели не горячие. Высокий объём + высокий CPC (>$1) = деньги крутятся.

**B. App Store / Play Store charts (бесплатно, язык не нужен):**
- Искать «transcripción» / «transcriber» в AR / MX / BR App Store.
- Смотреть **топ-20 апов по категории Productivity / Business**: количество отзывов (proxy на usage), средний рейтинг, ценники.
- Читать 1-star отзывы через Google Translate — это **чистое золото**: пользователи сами пишут про боли и лимиты. Не нужен живой язык.

**C. Reddit / Twitter поиск на испанском (Google Translate в помощь):**
- Reddit: `/r/argentina`, `/r/podcasting`, `/r/emprendimiento` — поиск по «transcribir», «transcripción».
- Twitter/X: advanced search `transcribir OR transcripción lang:es min_faves:5` — тред с жалобами = тред с болью.

**D. Конкурентный трафик (SimilarWeb free / Semrush trial):**
- Otter.ai traffic из AR/MX/BR vs total — покажет, насколько LATAM игнорируется.
- Happy Scribe то же самое.
- Если Otter имеет 2% LATAM-трафика при 10% LATAM-населения интернета — есть underserved gap.

**E. Product Hunt LATAM launches:**
- Фильтр по tag «LatAm», «Spanish». Смотреть upvotes и комменты в темах транскрипции.

**Что делать с этими данными:** если 3 из 5 методов показывают positive signal (есть объём, есть жалобы на конкурентов, LATAM-трафик у них низкий) → переходить к 4.1. Если не показывают — переосмыслить проект.

### 4.3 Что НЕ пытаться делать без языка

- **Customer support на es/pt сам.** Придётся либо нанимать part-time support из Аргентины ($3–5/час через Workana), либо использовать GPT-помощник с human-проверкой, либо делать support только через FAQ + канал (асинхронно). На первых 10 клиентов — GPT + проверка.
- **Content-маркетинг (блог на испанском) в одиночку.** AI-generated испанский контент Google сейчас наказывает. Нужен native editor ($30–50 за пост через Upwork/Workana). Планируй это в budget.
- **Community-management в Discord/Telegram LATAM-групп.** Не пытаться — выйдет фальшиво.

### 4.4 Почему это честный constraint, а не killer

Язык можно купить. Язык нельзя сфейкать. Решение: **превратить языковой gap в структурный издержковый элемент** — $200–300/мес на фрилансера-носителя для review копирайта, support-шаблонов и критичных постов. Это 30–40 платящих клиентов в месяц для break-even на локализацию. Укладывается в модель 5.5.

### 4.5 Anti-patterns (что НЕ валидирует)

- Email signups без payment = 30% полезности. Только реальные платежи.
- Friends & family feedback = 0.
- ChatGPT / Claude «рынок есть» без данных = 0. (Именно поэтому раздел 4.2 про прокси-данные, а не про LLM-оценку.)
- Upvotes на ProductHunt = бесполезно.

---

## 5. Стратегический вывод: монетизировать или Open Source?

### 5.1 Рекомендация: **монетизировать** (freemium SaaS), **не open-source в целом**.

### 5.2 Почему не pure open source

1. **Себестоимость не нулевая.** Gladia Starter = $0.61/hr, значит 20 минут (welcome gift) стоят нам ~$0.20 без учёта Groq. При 1000 анонимных юзеров/день это $200/день = $6k/мес — неподъёмно для побочного проекта. Open source с «bring your own API key» отсекает 95% LATAM-аудитории (некому зарегать Gladia + Groq credit card). Оставшиеся 5% — техлиды US/EU, которые НЕ наш ICP.
2. **Моат продукта — не код, а distribution.** Код Next.js + Gladia API = любой может повторить за неделю. Моат: лендинг на испанском, MercadoPago-интеграция, SEO «transcribir audio español», партнёрство с подкастерами. Ни одно из этого open-source не помогает.
3. **LATAM рынок платит за готовое удобство**, не за self-hosted. 98% SME не поднимают docker-compose.

### 5.3 Почему и не полный closed-source

1. Репутационный плюс быть open в developer-community (особенно мелкого ДОМЕНА типа Gladia-клиентов).
2. Можно выложить отдельные куски (UI-компоненты, Web Share Target recipes, credit-reservation RPC-паттерн) для PR и рекрутинга без ущерба бизнесу.

### 5.4 Предлагаемая модель: **open-core**

**Open (MIT, на GitHub):**
- UI-киты компонентов (UploadZone, результат транскрипции).
- Supabase RPC-паттерны для credit reservation (это полезно другим, но не даёт преимущества copycat).
- Postgres migrations схемы.
- PWA Share Target boilerplate.

**Closed (private repo):**
- Production integration с Gladia/Groq (ключи, retry-логика, polling, error-handling).
- Billing/MercadoPago/Stripe webhooks.
- Anti-abuse/rate-limit/anti-bot эвристики.
- Onboarding, localization, копирайт.
- SEO/marketing landing pages.

**Что скрыть обязательно:**
- Все API-ключи и webhook secrets (как всегда).
- Логика billing и кредитов в production (чтобы нельзя было клонировать для freeloading).
- Partnerships и discount codes.
- Google OAuth client_secret (.env.local — никогда в git).

### 5.5 Монетизационная стратегия (tiers)

Предварительно, до валидации:

| Tier | Цена | Минут/мес | Фичи |
|---|---|---|---|
| **Free** | $0 | 20 мин (текущий 1200 сек) | Базовая транскрипция + резюме. Watermark на экспорте. |
| **Creator** | $5/мес (~USD в AR, BRL 25 в BR, MXN 99 в MX) | 10 часов (600 мин) | Без водяного знака, экспорт srt/vtt, keyword highlights. |
| **Pro** | $12/мес | 50 часов (3000 мин) | Speaker naming, AI-chat по транскрипту, API. |
| **Studio** | $29/мес | 200 часов | Team seats (3), приоритетная поддержка на es/pt. |

**Себестоимость sanity-check:**
- Pro $12/мес × 50hr × $0.20/hr (Gladia Growth) = **$10 COGS.** Margin 17%. **Плохо.**
- Если откатиться на Gladia Starter $0.61 → $30.5 COGS на $12 → **убыток.** Нельзя.
- **Вывод:** Pro tier экономически работает только при Gladia Growth (volume commit). Первые 100 юзеров = убыток, planning for it.

**Альтернатива — pay-as-you-go:**
- $0.50/hour credits (покупаешь пакеты 10/50/200 часов).
- Нет подписки → проще conversion в LATAM (люди не любят recurring).
- Хуже predictable revenue, но лучше product-market fit на старте.

**Моя рекомендация:** **начать с PAYG-пакетов**, мигрировать на subscriptions после 100 платящих (когда есть данные по usage).

### 5.6 Go-to-market последовательность

1. **Неделя 1–2:** 20 интервью (раздел 4.1).
2. **Неделя 3:** решение go/no-go. Если go:
   - Landing на es-AR + pt-BR.
   - MercadoPago sandbox + Stripe fallback.
   - PAYG-пакеты $5/10/20.
3. **Неделя 4–5:** smoke-test с $100 ad spend (раздел 4.3).
4. **Неделя 6:** first 10 paying customers (через тёплые лиды из интервью + реклама).
5. **Месяц 2–3:** органика через SEO («transcribir audio a texto español», «cómo transcribir podcast»), партнёрства с 2–3 подкастерами (бесплатные credits → промо).
6. **Месяц 4+:** если MRR растёт — subscription tiers + teamss.

### 5.7 Главные риски

1. **CAC > LTV** в LATAM из-за высокой ценовой чувствительности и низких tickets. Митигация: органика + вирусность (Share Target = вирусный канал).
2. **Gladia меняет цены** или закрывает доступ. Митигация: абстрагировать транскрипцию за своим API, иметь бэкап (Deepgram, AssemblyAI).
3. **WhatsApp native transcription улучшится** и убьёт use-case «шарни в PWA». Митигация: глубже уйти в edit/summary/search/export, а не только в raw transcription.
4. **Copycat из Бразилии** с лучшим Pix-integration. Митигация: скорость + partnerships.

---

## 6. Что делать (action items, без интервью)

**Неделя 1 — бесплатные прокси-сигналы (4–6 часов, без денег):**
- [ ] Олег: Google Keyword Planner по 5 ключам из 4.2-A, записать объёмы AR/MX/CO/BR в этот файл (раздел 4.2).
- [ ] Олег: открыть AR+MX App Store, найти топ-5 «transcripción» апов, прочитать 10 low-rated отзывов через Google Translate, записать 3–5 повторяющихся болей сюда.
- [ ] Олег: SimilarWeb free → otter.ai, happyscribe.com, descript.com → % трафика LATAM.
- [ ] Claude: если данные из предыдущих пунктов positive → подготовить текст испанского лендинга (AR-вариант) + 3 варианта Instagram/FB ads-креатива в `business/landing_copy_es.md`.

**Неделя 2 — setup paid smoke-test (если сигналы неделя 1 зелёные):**
- [ ] Олег: зарегистрировать MercadoPago developer account (AR), sandbox → credentials.
- [ ] Claude: реализовать минимальный checkout-flow PAYG ($5 / $10 / $20 пакеты) + webhook для зачисления секунд в `credits_seconds`.
- [ ] Олег: нанять на Upwork/Workana es-AR редактора, дать лендинг + ads-копию на вычитку ($20–40, разово, асинхронно, без разговора).
- [ ] Олег: Meta Business account + $150 budget на 7-дневную кампанию.

**Неделя 3 — запуск и замеры:**
- [ ] Запуск ads, мониторинг ежедневно.
- [ ] В конце недели: заполнить таблицу метрик из 4.1 прямо в этот файл → решение go/iterate/kill.

**Неделя 4+ (условно, если go):**
- [ ] Support-шаблоны на es через GPT + проверка редактором.
- [ ] Переход от PAYG к subscription после 50+ платящих.
- [ ] Расширение на MX через OXXO (MercadoPago MX) и BR через Pix.

**Что Claude может делать самостоятельно параллельно (не блокирует Олега):**
- [ ] Wireframe billing/pricing страницы (плейсхолдер в UploadZone уже есть).
- [ ] Research fallback-провайдеров транскрипции (Deepgram, AssemblyAI pricing) на случай проблем с Gladia.
- [ ] Подготовить текст FAQ на es (базовый, далее редактор правит).

---

## 7. Sources

### Конкуренты / pricing
- [Otter.ai vs Descript 2026 (thesoftwarescout)](https://thesoftwarescout.com/otter-ai-vs-descript-2026-which-ai-transcription-tool-wins/)
- [Happy Scribe Review 2026 (CreatorStackClub)](https://creatorstackclub.com/software/happy-scribe)
- [AI Transcription Pricing 2026 Guide (VOCAP)](https://vocap.io/en/blog/ai-transcription-pricing-cost-comparison-guide)
- [15 best transcription software 2026 (Guideflow)](https://www.guideflow.com/blog/transcription-software)

### LATAM SaaS / рынок
- [Latin America SaaS market outlook 2030 (Grand View)](https://www.grandviewresearch.com/horizon/outlook/software-as-a-service-saas-market/latin-america)
- [LatAm SaaS accelerating toward doubling by 2027 (EBANX)](https://business.ebanx.com/en/press-room/press-releases/latin-americas-saas-sector-is-accelerating-toward-doubling-by-2027-reveals-ebanx)
- [LatAm SaaS Expansion 2025 Playbook (Kairos Aureum)](https://kairosaureum.com/latam-saas-expansion-2025-growth-playbook/)
- [Localize SaaS Pricing Internationally (SBI Growth)](https://sbigrowth.com/insights/market-localization-saas-pricing-internationally)
- [Creator economics Mexico/Brazil/Colombia/Argentina (Holy Marketing)](https://community.holymarketing.agency/t/country-specific-creator-economics-how-different-are-mexico-brazil-colombia-and-argentina-really/27706)

### Подкасты LATAM
- [State of Podcasting in Latin America (Podnews)](https://podnews.net/article/podcasting-in-latin-america)
- [Podcasting Market Size 2031 (Mordor Intelligence)](https://www.mordorintelligence.com/industry-reports/podcast-market)

### Платежи
- [Payment gateways in Argentina 2026 (Rebill)](https://www.rebill.com/en/blog/payment-gateways-argentina)
- [MercadoPago Subscriptions overview](https://www.mercadopago.com.ar/developers/en/docs/subscription-plans/overview)
- [Stripe — How to accept payments in Argentina](https://stripe.com/resources/more/payments-in-argentina)
- [LatAm SME demand powers SaaS growth (Antom)](https://knowledge.antom.com/latin-america-on-the-rise-sme-demand-powers-saas-growth)

### WhatsApp transcription
- [Top 5 Spanish LATAM Transcription Services 2026 (GoTranscript)](https://gotranscript.com/en/blog/top-5-spanish-latin-america-transcription-services-2026)
- [How to Transcribe WhatsApp voice (Notta)](https://www.notta.ai/en/blog/transcribe-whatsapp-audio)

### Инфра
- [Gladia Pricing](https://www.gladia.io/pricing)
- [Gladia vs OpenAI Whisper API](https://www.gladia.io/blog/openai-whisper-api-vs-gladia-a-technical-comparison-for-production-speech-to-text)
