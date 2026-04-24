# BACKLOG — transcribe-app

Формат: `[P1/P2/P3]` приоритет · один-строчный title · ссылка на источник (AUDIT/DECISIONS/MARKET_RESEARCH) · статус.

---

## P1 — ближайший спринт (safety + MVP launch)

- [x] **A1** GET `/api/transcribe/[id]`: проверка владельца — AUDIT.md §1.2 → закрыто в Фазе 5.
- [x] **A2** Supabase Storage: приватный bucket + signed URLs — AUDIT.md §1.2 → закрыто в Фазе 5.
- [x] **A3** Санитизация `file.name` в storagePath — AUDIT.md §1.2 → закрыто в Фазе 5.
- [x] **A11** `/billing` заглушка со скелетом PAYG — промт фаза 6 → закрыто в Фазе 6.
- [x] **A12** `.env.example` с именами всех переменных — AUDIT.md §1.2 → закрыто в Фазе 5.
- [ ] **V1** Валидация входных данных: UUID-чек в `/api/transcribe/[id]`, числовые проверки `duration_hint` — см. AUDIT A3.
- [ ] **M1** Реальный MercadoPago checkout для $5/$10/$20 пакетов — SPECIFICATION §5, MARKET_RESEARCH §5.

## P2 — следующий месяц

- [ ] **A4** Rate-limiting на `/api/transcribe` (IP + user-scope, Upstash Redis) — AUDIT A4.
- [ ] **A5** getClientIp: учесть `cf-connecting-ip`, `x-real-ip` в приоритете — AUDIT A5.
- [ ] **A6** PWA: manifest.json + service worker + Web Share Target action — AUDIT A6, промт структура.
- [ ] **A10** Локализация UI: `es-AR` primary, `pt-BR` secondary, `en` fallback (next-intl или локальный словарь) — AUDIT A10, MARKET_RESEARCH §3.
- [ ] **L1** Лендинг `/es` для smoke-test трафика — MARKET_RESEARCH §4.1.
- [ ] **L2** `brand/landing_copy_es.md` → финальный текст после вычитки Workana-редактором — MARKET_RESEARCH §6.
- [ ] **E1** Экспорт транскрипции: `.txt`, `.srt`, `.vtt` — SPECIFICATION §3.

## P3 — позже / опционально

- [ ] **A8** Удалить `@anthropic-ai/sdk` из deps — AUDIT A8.
- [ ] **A9** Переписать `README.md` под продукт — AUDIT A9.
- [ ] **A7** Использовать `NEXT_PUBLIC_APP_URL` в Google OAuth redirects или удалить — AUDIT A7.
- [ ] **P1-obs** Мониторинг Gladia usage + alerting при скачке расходов (Posthog / плейсхолдер) — SPECIFICATION §5.
- [ ] **P2-pt** Pix-интеграция через EBANX/dLocal для Brazil — MARKET_RESEARCH §2.4.
- [ ] **P3-oxxo** OXXO Pay через MercadoPago MX — MARKET_RESEARCH §2.4.
- [ ] **UX1** Ssr для `/transcription/[id]`, чтобы начальное состояние грузилось мгновенно (сейчас чистый client-fetch) — улучшение UX.
- [ ] **UX2** Drag-and-drop индикатор при Share Target (когда пришёл файл из шаринга) — SPECIFICATION §3.

## Убито / отклонено

- ~~Подписочная модель на старте~~ — отложена до 50+ платящих (DECISIONS.md).
- ~~Open source всей кодовой базы~~ — выбрана open-core модель (MARKET_RESEARCH §5.3).
- ~~Customer интервью как фаза валидации~~ — заменено на paid smoke-test + прокси-сигналы (MARKET_RESEARCH §4).
