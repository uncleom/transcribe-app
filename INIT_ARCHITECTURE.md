# INIT_ARCHITECTURE — живая карта проекта

> Запуск: `claude INIT_ARCHITECTURE.md`  
> Цель: создать и поддерживать самообновляемую архитектурную документацию проекта.

---

## ТВОЯ ЗАДАЧА

Ты — архитектурный агент. Выполни все фазы последовательно. Не жди подтверждения между фазами. Докладывай о прогрессе коротко: "Фаза N: ✓".

---

## ФАЗА 1 — РАЗВЕДКА (не пиши ничего, только читай)

Прочитай и проанализируй следующие файлы и директории (если существуют):

**Конфиги проекта:**
- package.json / pyproject.toml / Cargo.toml / go.mod
- .env.example / .env.local (только ключи, не значения)
- docker-compose.yml / Dockerfile
- next.config.js / vite.config / tsconfig.json
- .github/workflows/

**Точки входа:**
- src/index.* / src/main.* / app/page.* / server.* / main.*
- src/app/ (Next.js App Router)
- src/pages/ (Next.js Pages Router)

**Структура:**
- Рекурсивно: src/, app/, lib/, components/, api/, services/, hooks/, utils/, types/, db/, prisma/, migrations/
- Все файлы router / routes / navigation
- Все файлы schema / models / types
- Все файлы store / context / state

**Внешние интеграции:**
- Любые fetch/axios/http вызовы к внешним URL
- Все SDK импорты (stripe, supabase, openai, etc.)
- Все MCP / webhook конфиги

После разведки составь внутреннюю модель проекта. Переходи к Фазе 2.

---

## ФАЗА 2 — ГЕНЕРАЦИЯ ФАЙЛОВ

Создай четыре файла в корне проекта:

---

### 2A — ARCHITECTURE.md

Структура файла:

```
# [Название проекта] — Architecture Index
> Последнее обновление: [дата]
> Стек: [перечисли кратко]

## Быстрый старт для агента
[3-5 предложений: что делает приложение, какова главная петля данных]

## Структура директорий
[дерево только верхнего уровня с однострочными комментариями]

## Слои архитектуры
### Frontend
- Фреймворк: 
- Точка входа: [путь]
- Компоненты: [путь]
- Стейт: [путь + технология]
- Стили: [путь + технология]

### Backend / API
- Роуты: [перечисли все эндпоинты с методами и путями]
- Middleware: [что и где]
- Auth: [механизм + файлы]

### База данных
- Технология:
- Схема: [путь]
- Миграции: [путь]
- Основные таблицы/коллекции: [перечисли с назначением]

### Внешние сервисы
[таблица: Сервис | Назначение | Файлы интеграции]

## Основные потоки данных (flows)
[3-7 самых важных сценариев, каждый: название → шаги через стрелки]
Пример: User Login → /api/auth/login → validate → JWT → cookie → redirect

## Для фокусных сессий
### Работаю только с UI/дизайном
Читай: [перечисли конкретные пути]
Не трогай: [перечисли]

### Работаю только с API
Читай: [перечисли конкретные пути]
Не трогай: [перечисли]

### Работаю только с БД
Читай: [перечисли конкретные пути]
Не трогай: [перечисли]

### Работаю только с интеграциями
Читай: [перечисли конкретные пути]
Не трогай: [перечисли]

## Известные особенности и риски
[что нестандартно, что сломается если тронуть, технический долг]
```

---

### 2B — architecture.json

Формат:

```json
{
  "project": {
    "name": "",
    "version": "",
    "stack": [],
    "last_updated": ""
  },
  "layers": {
    "frontend": {
      "framework": "",
      "entry": "",
      "components_path": "",
      "state_path": "",
      "styles_path": ""
    },
    "backend": {
      "framework": "",
      "entry": "",
      "routes_path": ""
    },
    "database": {
      "technology": "",
      "schema_path": "",
      "migrations_path": "",
      "tables": []
    }
  },
  "modules": [
    {
      "name": "",
      "path": "",
      "responsibility": "",
      "layer": "frontend|backend|database|external",
      "depends_on": [],
      "exposes": []
    }
  ],
  "external_services": [
    {
      "name": "",
      "purpose": "",
      "integration_files": [],
      "env_keys": []
    }
  ],
  "flows": [
    {
      "name": "",
      "trigger": "",
      "steps": [
        {
          "step": 1,
          "component": "",
          "action": "",
          "path": ""
        }
      ]
    }
  ],
  "focus_maps": {
    "ui_only": {
      "read": [],
      "ignore": []
    },
    "api_only": {
      "read": [],
      "ignore": []
    },
    "db_only": {
      "read": [],
      "ignore": []
    },
    "integrations_only": {
      "read": [],
      "ignore": []
    }
  }
}
```

---

### 2C — architecture.html

Создай единый самодостаточный HTML файл (без внешних зависимостей кроме D3.js с CDN).

Требования:
- Граф узлов из architecture.json, цветовое кодирование по слоям:
  - frontend → синий (#3b82f6)
  - backend → зелёный (#22c55e)  
  - database → оранжевый (#f97316)
  - external → фиолетовый (#a855f7)
- Панель справа: список всех flows из architecture.json
- Клик на flow → подсвечивает только задействованные узлы и рёбра
- Клик на узел → показывает детали: path, responsibility, depends_on, exposes
- Кнопка "Reset" → сбрасывает подсветку
- Поиск по узлам
- Весь JS и CSS встроены в один файл, данные из architecture.json встроены как JS переменная

---

### 2D — CONTEXT_MAPS.md

```
# Context Maps — фокусные карты для агентов

## Как использовать
В начале сессии напиши агенту:
"Read ARCHITECTURE.md, then read the relevant section of CONTEXT_MAPS.md, then proceed"

---

## MAP: UI / Design
**Цель:** работа с визуальной частью без риска сломать логику

### Читать обязательно:
[конкретные пути]

### Можно трогать:
[конкретные пути]

### Не трогать никогда:
[конкретные пути]

### Паттерны компонентов в этом проекте:
[как здесь принято писать компоненты — naming, структура файла, импорты]

### Дизайн-система:
[что используется, где tokens/variables, как применять]

---

## MAP: API / Backend
[аналогично]

---

## MAP: Database
[аналогично]

---

## MAP: Integrations
[аналогично]

---

## MAP: Auth / Security
[аналогично]
```

---

## ФАЗА 3 — САМООБНОВЛЕНИЕ

Создай файл `.git/hooks/pre-commit` (или добавь в существующий):

```bash
#!/bin/sh
# Architecture auto-update hook

CHANGED=$(git diff --cached --name-only)

NEEDS_UPDATE=false

# Проверяем изменения по слоям
if echo "$CHANGED" | grep -qE "^(src/components|src/app|src/pages|components)"; then
  echo "🏗 Architecture: UI changes detected"
  NEEDS_UPDATE=true
fi

if echo "$CHANGED" | grep -qE "^(src/api|api|routes|server)"; then
  echo "🏗 Architecture: API changes detected"  
  NEEDS_UPDATE=true
fi

if echo "$CHANGED" | grep -qE "^(prisma|migrations|schema|db)"; then
  echo "🏗 Architecture: DB changes detected"
  NEEDS_UPDATE=true
fi

if echo "$CHANGED" | grep -qE "package\.json|pyproject\.toml|docker-compose"; then
  echo "🏗 Architecture: Config changes detected"
  NEEDS_UPDATE=true
fi

if [ "$NEEDS_UPDATE" = true ]; then
  echo "📝 Updating architecture docs..."
  echo "Run: claude 'Read the changed files: $CHANGED. Update only the relevant sections of ARCHITECTURE.md, architecture.json, and CONTEXT_MAPS.md to reflect these changes. Do not regenerate from scratch — patch only what changed.'"
fi
```

Сделай hook исполняемым: `chmod +x .git/hooks/pre-commit`

---

## ФАЗА 3B — GITHUB PAGES

Создай файл `.github/workflows/architecture.yml`:

```yaml
name: Publish Architecture Map

on:
  push:
    branches: [main, master]
    paths:
      - 'architecture.html'
      - 'architecture.json'

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - id: deployment
        uses: actions/deploy-pages@v4
```

После создания файла выведи инструкцию:

```
⚙️  Включи GitHub Pages вручную (один раз):
    GitHub repo → Settings → Pages → Source: GitHub Actions
    
После первого пуша architecture.html будет доступен по адресу:
    https://YOUR_USERNAME.github.io/YOUR_REPO/architecture.html
```

Добавь в .gitignore (если не добавлено):
```
# Architecture source data — не коммитим (содержит пути и структуру)
# architecture.html НЕ добавляем в gitignore — он должен коммититься для GitHub Pages
```

Добавь в README.md секцию:
```markdown
## Architecture

[![Architecture Map](https://img.shields.io/badge/architecture-live%20map-blue?style=flat-square&logo=github)](https://YOUR_USERNAME.github.io/YOUR_REPO/architecture.html)

- `ARCHITECTURE.md` — индекс проекта для агентов, читать первым
- `CONTEXT_MAPS.md` — фокусные карты по доменам
- `architecture.json` — машиночитаемый граф
- [`architecture.html`](https://YOUR_USERNAME.github.io/YOUR_REPO/architecture.html) — интерактивная схема ↗

Обновление: автоматически через pre-commit hook.
Принудительное обновление: `claude INIT_ARCHITECTURE.md`
```

**Замени** `YOUR_USERNAME` и `YOUR_REPO` на значения из GitHub URL репозитория.

---

## ФАЗА 4 — ОТЧЁТ

После завершения выведи:

```
✅ ARCHITECTURE.md                    — [N строк]
✅ architecture.json                  — [N модулей, N flows]
✅ architecture.html                  — [N узлов]
✅ CONTEXT_MAPS.md                    — [N карт]
✅ pre-commit hook                    — установлен
✅ .github/workflows/architecture.yml — создан

Открой схему локально: open architecture.html

После пуша на GitHub:
1. Включи Pages: Settings → Pages → Source: GitHub Actions
2. Схема будет доступна по адресу:
   https://YOUR_USERNAME.github.io/YOUR_REPO/architecture.html

Для фокусной сессии по UI напиши:
"Read ARCHITECTURE.md, then CONTEXT_MAPS.md section UI, then [твоя задача]"
```

---

## ПРАВИЛА РАБОТЫ

- Если файл уже существует — обновляй, не перезаписывай с нуля
- Если не можешь определить назначение модуля — помечай `"responsibility": "UNCLEAR — needs review"`
- Пути всегда относительные от корня проекта
- Flows называй глаголами с точки зрения пользователя: "User creates invoice", "Webhook updates status"
- В CONTEXT_MAPS.md пиши конкретные пути, не абстракции
