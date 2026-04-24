# POSITIONING — transcribo.app

Источник: MARKET_RESEARCH.md §3. Этот документ — source of truth для всей маркетинговой и продуктовой коммуникации.

---

## Одно предложение (elevator)

> **Транскрипция для испаноязычных создателей контента. Шерь из WhatsApp — получи текст и резюме. Платишь через MercadoPago.**

Es-AR:
> **Transcripción para creadores de contenido en español. Compartí desde WhatsApp — recibí texto y resumen. Pagás con MercadoPago.**

Pt-BR:
> **Transcrição para criadores de conteúdo em português. Compartilhe do WhatsApp — receba texto e resumo. Pague com MercadoPago / Pix.**

---

## USP: три differentiator-слоя

### 1. LATAM-native
- Испанский и португальский — не «ещё одна галочка в 120 языках», а priority.
- UI, поддержка, копирайт, лендинг — на местных разновидностях (es-AR, es-MX, pt-BR).
- Tone of voice: разговорный, без корпоративщины («vos» в AR, не «tú»).

### 2. WhatsApp-to-transcript pipeline
- PWA с Web Share Target: пользователь делает share из WhatsApp → файл попадает сразу в transcribo.app → клик «Transcribir».
- 0 установок приложения. Работает с iPhone и Android.
- Решает боль «WhatsApp native transcription не сохраняет историю и работает по одному сообщению».

### 3. Local payments
- MercadoPago: AR, MX, CO, CL в одной интеграции.
- Pix (BR) через MercadoPago Brasil / EBANX.
- OXXO (MX) как расширение.
- Цены в local currency. Предсказуемо без cepo cambiario.

---

## Чем мы НЕ являемся (явно)

- **Не Otter.** Мы не делаем meeting-bot, не интегрируемся в Zoom/Meet, не для enterprise knowledge workers.
- **Не Descript.** Мы не audio/video editor. Мы не делаем Overdub. Мы не заменяем DAW.
- **Не Riverside.** Мы не записываем подкасты. Мы их транскрибируем.
- **Не бюро транскрипции (Rev, GoTranscript).** Мы не продаём human-accuracy, мы продаём мгновенность за $5.
- **Не WhatsApp-бот.** Мы PWA со Share Target (различие чисто техническое, но критичное).

---

## Позиционирование vs конкуренты (один слой)

| Размерность | Мы | Otter | Descript | Happy Scribe | Riverside |
|---|---|---|---|---|---|
| Primary language | es-AR / pt-BR | en-US | en-US | многое, без primary | en-US |
| Primary device | mobile PWA | desktop/web | desktop app | desktop/web | desktop/web |
| Primary payment | MercadoPago | Stripe | Stripe | Stripe | Stripe |
| Primary workflow | WhatsApp share | Zoom meeting | Upload+edit | Upload | Live recording |
| Entry price | $5 PAYG | $17/мес | $15/мес | $8.5/мес | $15/мес |
| Free tier | 20 мин без карты | 300 мин с регой | 1 час с watermark | нет | нет |

---

## Целевые персоны

### Primary — «Martín, подкастер из Буэнос-Айреса»
- 28 лет, ведёт подкаст о маркетинге с аудиторией 8k subs.
- Записывает 1 эпизод/неделю, 45 мин.
- Хочет транскрипт для show-notes и Instagram-нарезок.
- Сейчас тратит 2–3 часа на ручную правку Whisper-output.
- Бюджет: ~$10/мес, платит через MercadoPago.

### Secondary — «Lucía, фриланс-журналист из CDMX»
- 32 года, пишет для El Universal и своего блога.
- Интервью 60–90 мин/неделю, испанский + немного английского.
- Нужна diarization и точность имён.
- Бюджет: $10–15/мес.

### Tertiary — «Carlos, abogado-одиночка из Medellín»
- 40 лет, записывает консультации клиентов.
- Требование confidentiality — важно приватное хранение (P2-задача, связана с AUDIT A2).
- Готов платить больше ($20–30/мес) за гарантию приватности.

---

## Сообщения по каналам

### Лендинг (транскрибо.app/es)
Headline: **«De audio a texto en segundos. En tu español.»**
Subhead: «Subí o compartí desde WhatsApp. Recibí transcripción y resumen. Pagás con MercadoPago.»
CTA: **«Probar gratis — 20 minutos»**

### Instagram ad (подкастеры)
Hook: «Deja de perder 2 horas editando tu podcast.»
Body: «Subí el audio — recibí transcripción lista para show-notes.»
CTA: «Probá gratis»

### Instagram ad (юристы)
Hook: «¿Consultas grabadas que no te animás a transcribir?»
Body: «Privado, rápido, en tu español.»
CTA: «Empezá gratis»

---

## Red flags в коммуникации (не использовать)

- ❌ «AI-powered» — перегружено, не несёт смысла.
- ❌ «Revolucionario», «disruptivo» — cringe в es-AR.
- ❌ «Enterprise-grade» — не наш сегмент.
- ❌ Прямое сравнение с Otter / Descript в рекламе — отвлекает и не все знают их.
- ❌ Технические термины («diarization», «WhisperAI», «LLM») в user-facing копирайте.
