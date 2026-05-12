# DECISIONS — transcribe-app

Журнал ключевых решений. Формат: `YYYY-MM-DD · заголовок · решение · почему · альтернатива`. Новые записи сверху.

---

## 2026-05-12 · Next.js 16 + next-pwa: обязательный флаг --webpack

**Решение:** добавить `--webpack` в build-скрипт: `"build": "next build --webpack"`.
**Почему:** Next.js 16 включает Turbopack по умолчанию. next-pwa v5.6 использует webpack-плагины (Workbox) и не генерирует `sw.js` при Turbopack — билд проходит без ошибок, но service worker отсутствует. Флаг принудительно переключает на webpack.
**Альтернатива:** мигрировать на `@ducanh2912/next-pwa` (поддерживает Next.js 14+) — запланировано как A15 P3.

## 2026-05-12 · PWA скоуп: только installable, без Web Share Target

**Решение:** A6 ограничен manifest + SW + InstallBanner. Web Share Target, iOS Shortcut с API-токеном — отдельные задачи (A4, B2).
**Почему:** Web Share Target работает только на Android Chrome; iOS не поддерживает. iOS Shortcut с автозагрузкой файла требует API-токен-систему — отдельный спринт. Для MVP достаточно installability.
**Альтернатива:** iOS нативное приложение — отклонено (Apple Developer $99/год, нет готового Swift-проекта).

## 2026-04-23 · Реструктуризация и фазирование работы

**Решение:** разделить репозиторий на `business/`, `brand/`, `docs/`, `src/` (код), SPECIFICATION.md в корне. Добавить `.env.example`, заглушку `/billing`, закрыть 2 критичных security-issue (A1, A2).
**Почему:** до монетизации продукт не должен иметь очевидных утечек и должен быть готов к smoke-test. Разделение бизнес-документов и кода упрощает передачу частей (например, SPECIFICATION.md для контрактора, business/ для себя).
**Альтернатива:** оставить flat-структуру — отклонена, растёт хаос.

## 2026-04-23 · Монетизация: PAYG вместо подписки на старте

**Решение:** стартовать с 3 PAYG-пакетов ($5/10hr, $10/30hr, $20/80hr). Переход на subscriptions — после 50+ платящих.
**Почему:** в LATAM recurring имеет высокий drop-off; карта у SMB часто нестабильна; Pix/OXXO — одноразовые по природе. PAYG проще в conversion и в учёте.
**Альтернатива:** сразу подписки $5/$12/$29 Pro/Studio (из MARKET_RESEARCH §5.5) — отклонена до валидации usage-паттернов.
**Ref:** MARKET_RESEARCH §5.5.

## 2026-04-23 · Open-core, не полный open source

**Решение:** открыть UI-компоненты, RPC-паттерны, Share Target boilerplate (MIT, в отдельный public-repo). Закрыть billing, production API keys, anti-abuse, marketing-страницы.
**Почему:** себестоимость Gladia не нулевая, полный OSS с BYOK отсекает 95% LATAM-ICP. Моат — distribution, не код.
**Альтернатива 1:** closed-source полностью — теряем developer-mindshare.
**Альтернатива 2:** MIT на всё — делает copycat из Бразилии тривиальным.
**Ref:** MARKET_RESEARCH §5.2–5.4.

## 2026-04-23 · Валидация без customer-интервью

**Решение:** заменить интервью на (а) прокси-сигналы (keyword volume, App Store reviews через translate, SimilarWeb по конкурентам) и (б) paid smoke-test ($150 Meta Ads + реальные MercadoPago-платежи).
**Почему:** Олег не владеет es/pt и не имеет контактов в LATAM-комьюнити. Продукт уже работает — можно пропустить pre-product фазу и мерить реальные платежи.
**Альтернатива:** нанимать LATAM-researcher — отклонено (>$500, дольше, сигнал всё равно слабее).
**Ref:** MARKET_RESEARCH §4.

## 2026-04-23 · Языковая модель: es-AR first, pt-BR second, en fallback

**Решение:** UI и маркетинг приоритезируются на es-AR (MercadoPago сильнее всего в Argentina, один из целевых рынков). Pt-BR вторым по объёму. En только для dev-сообщества и fallback.
**Почему:** без фокуса получится серый полу-англоязычный продукт без PMF ни там, ни там. MercadoPago покрывает AR/BR/MX/CO одной интеграцией.
**Альтернатива:** mx-first — отклонена из-за меньшей доли MercadoPago vs AR (но MX — второй приоритет по расширению после AR).
**Ref:** MARKET_RESEARCH §2.4, §3.2.

## 2026-04-23 · Языковой gap → издержка, не killer

**Решение:** бюджет $200–300/мес на native-редактора через Workana/Upwork для копирайта, FAQ, support-шаблонов. GPT для массового drafting, редактор для critical paths.
**Почему:** Google штрафует AI-generated контент на языке, которым автор не владеет, в SEO. Support без человека даёт низкий NPS.
**Альтернатива:** полностью AI-support — плохой user experience, отклонено.
**Ref:** MARKET_RESEARCH §4.3–4.4.

## 2026-04-23 · Storage приватный, подписанные URL

**Решение:** Supabase Storage bucket «audio-files» перевести в приватный режим. `/api/transcribe/[id]` генерирует signed URL на N часов. Gladia получает файл напрямую через upload, не через public URL.
**Почему:** загруженный файл может быть конфиденциальным (юр. консультация, медицинский разговор). Публичный URL = утечка по логам/web-archive/SEO-краулерам.
**Альтернатива:** оставить публично — отклонено: это compliance-blocker для юристов, одной из primary-персон.
**Ref:** AUDIT.md A2, фаза 5.

---

## Открытые вопросы (нужно решение позже)

1. **FAQ: где хранить?** В `docs/FAQ.md` или в `brand/` (т.к. часть маркетинга)? → по умолчанию `brand/` пока лендинг там же.
2. **CDN для загрузки файлов:** Supabase Storage или Cloudflare R2? → оставляем Supabase до 500 GB usage.
3. **Speaker naming:** как именовать спикеров? "Speaker 1" / "Hablante 1" / кастом? → см. SPECIFICATION §3.
4. **Refund policy для PAYG:** возврат неиспользованных секунд? → дефолт no-refund, кредиты не expire. Пересмотреть если будет много жалоб.
