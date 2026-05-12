# VALIDATION PLAN — transcribe-app

Цель: проверить гипотезу «LATAM-рынок готов платить $5–20 за PAYG-транскрипцию» без customer-интервью, с бюджетом ~$150–250 за 3 недели.

Источник: MARKET_RESEARCH.md §4.

---

## Этап 0 — предусловия (что должно быть готово до запуска)

- [x] Продукт работает end-to-end (upload → transcribe → summary).
- [x] Кредитная система (anon 180s, auth 1200s).
- [ ] `/billing` страница (PAYG-пакеты, заглушка до интеграции) ← фаза 6 этого спринта.
- [ ] `.env.example` и базовая security-гигиена ← фаза 5.
- [ ] MercadoPago AR developer-аккаунт, sandbox credentials.
- [ ] Домен transcribo.app работает в production, HTTPS.

---

## Этап 1 — бесплатные прокси-сигналы (4–6 часов, $0)

Делается Олегом без знания языка.

### 1.1 Keyword volume (Google Keyword Planner)
Ключи для проверки, по каждому — объём запросов по странам AR / MX / CO / BR:

| Ключ | Страна | Volume | CPC ($) |
|---|---|---|---|
| `transcribir audio a texto` | AR | | |
| `transcribir audio a texto` | MX | | |
| `pasar audio a texto` | AR | | |
| `transcripción de audio` | MX | | |
| `transcribir podcast` | AR | | |
| `transcrever áudio` | BR | | |

**Green signal:** суммарный volume ≥ 20 000/мес по всем ключам × странам.

### 1.2 App Store reviews (LATAM)
Для каждой страны (AR, MX, BR) в App Store / Play Store:
1. Поиск «transcripción» / «transcrever».
2. Топ-5 апов → 10 low-rated reviews → Google Translate → выписать 3–5 повторяющихся болей.

**Выходной артефакт:** `brand/user_pain_points.md` (создаётся позже, из записей ниже).

| Апп | Страна | Rating | Частые жалобы |
|---|---|---|---|
| | | | |

### 1.3 SimilarWeb free tier (competitor LATAM traffic)

| Сайт | Общий трафик/мес | % AR+MX+BR+CO | Abs LATAM |
|---|---|---|---|
| otter.ai | | | |
| happyscribe.com | | | |
| descript.com | | | |
| sonix.ai | | | |

**Green signal:** у минимум одного конкурента ≥ 5% LATAM traffic = рынок доказано есть; либо 0% = underserved gap в нашу пользу (это тоже сигнал, но более спекулятивный).

### 1.4 Reddit / X поиск на es-AR
- Reddit: `/r/argentina`, `/r/mexico`, `/r/podcasting`, `/r/emprendimiento` + запрос «transcribir» за последний год.
- X: `transcribir OR transcripción lang:es min_faves:3 since:2025-01-01`.

Собрать 10–20 постов → перевести → записать 5 самых острых болей.

### Gate после этапа 1
**Всё зелёное (3 из 4 подразделов дают positive signal):** → Этап 2.
**Микс-жёлтый:** попробовать другую нишу (например, юристы или студенты вместо подкастеров), вернуться на этап 1.
**Красный:** остановиться, переосмыслить продукт.

---

## Этап 2 — landing и оплата (неделя 2, ~$50)

### 2.1 Лендинг на es-AR
- Одностраничник на transcribo.app/es
- Hero: «Transcribe audios y podcasts al instante. Español latino nativo.»
- 3 PAYG-пакета ($5/10hr, $10/30hr, $20/80hr)
- CTA «Probar gratis — 20 minutos» (ведёт на transcribe, авторизация добавляет кредиты)
- Live demo 30-сек видео (скринкаст)
- Соц.-прооф placeholder: «Creators de Argentina y México ya lo usan» (ок без цифр до запуска)

Копия: Claude генерит draft → Workana-редактор вычитывает за $20–40 (асинхронно, без разговора).
Артефакт: `brand/landing_copy_es.md`.

### 2.2 MercadoPago checkout
- Sandbox → prod credentials.
- Создать 3 preference-объекта (прямой single-payment, не subscription).
- Webhook на `/api/mercadopago/webhook` → зачислить секунды в `profiles.credits_seconds`.

---

## Этап 3 — платный smoke-test (неделя 3, $150)

### 3.1 Meta Ads (Instagram + FB)
- **Бюджет:** $150 за 7 дней = ~$21/день.
- **Страны:** Argentina (primary), Mexico (secondary).
- **Интересы:** «podcast», «periodismo», «abogados jóvenes», «creación de contenido».
- **Возраст:** 25–45.
- **Креативы:** 3 варианта (подкастер, юрист, журналист). Claude генерит, редактор правит.
- **Цель:** Conversions → Purchase (через MercadoPago webhook в Pixel).

### 3.2 Метрики

| Метрика | 🟢 Go | 🟡 Итерация | 🔴 Kill |
|---|---|---|---|
| Покупок за неделю | ≥ 5 | 1–4 | 0 |
| CTR ads | ≥ 1.5% | 0.8–1.5% | < 0.8% |
| Landing → click «Comprar» | ≥ 5% | 2–5% | < 2% |
| Click → реальная оплата | ≥ 10% | 3–10% | < 3% |
| CAC | ≤ $30 | $30–150 | > $150 |

**Go decision:** все 4 метрики зелёные → влить ещё $500 для confidence + начать работу над P2-tasks в BACKLOG.md.
**Итерация:** 2+ метрики жёлтые → изменить копирайт / таргет / цены, пройти $100 раунд.
**Kill:** 2+ метрики красные → остановить монетизацию, вернуться к переосмыслению USP.

---

## Этап 4 — после go (неделя 4+)

1. Support-шаблоны на es через GPT + проверка редактором.
2. FAQ на es в `brand/faq_es.md`.
3. Первый кейс-стади с платящим клиентом (попросить короткий отзыв за 1 месяц бесплатных credits).
4. SEO: 3 статьи в блог («cómo transcribir un podcast», «transcribir audio WhatsApp», «subtítulos automáticos español»).
5. Расширение на MX (OXXO) и BR (Pix) после первых 50 платящих.

---

## Что НЕ делаем в рамках валидации

- Customer интервью (ограничение: нет языка).
- Content-маркетинг самостоятельно (только через редактора).
- Community management в Discord/Telegram.
- Подписки (только PAYG до 50+ платящих).
- Мультиязычность UI на старте (es-AR only для валидации; pt-BR после go).
