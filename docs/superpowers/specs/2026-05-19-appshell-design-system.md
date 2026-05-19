# AppShell + Design System — Spec

**Date:** 2026-05-19  
**Status:** Approved

## Goal

Replace the inconsistent per-page headers with a single `AppShell` component, install shadcn/ui as the component foundation, and add responsive navigation (bottom tabs on mobile, thin sidebar on desktop).

## Decisions

- **Navigation mobile:** Bottom Tab Bar — New / History / Account  
- **Navigation desktop (≥768px):** Thin sidebar 52px — icon + label, same 3 tabs  
- **Component library:** shadcn/ui (Radix primitives + Tailwind)  
- **Account tab:** absorbs `/billing` page — credits display, Telegram link, sign out  
- **Outside AppShell:** `/login`, `/transcription/[id]` (drill-down, own back nav)

## Architecture

```
src/app/layout.tsx
  └── AppShell                      ← new
        ├── DesktopNav              ← new, hidden on mobile (md:hidden)
        │     ├── Logo
        │     └── NavItem × 3
        ├── <main>{children}</main>
        └── BottomNav               ← new, hidden on desktop (md:hidden)
              └── NavItem × 3
```

`AppShell` is added to `layout.tsx` but **conditionally skipped** for `/login` and `/transcription/[id]` — those pages render their own minimal chrome via a pathname check or a separate nested layout.

## Pages affected

| Route | Change |
|---|---|
| `/` | Remove standalone header; AppShell provides nav |
| `/history` | Remove standalone header |
| `/billing` | Renamed concept → Account tab content |
| `/connect-telegram` | Minor: remove header, add back link |
| `/login` | Untouched — no AppShell |
| `/transcription/[id]` | Untouched — no AppShell, keeps `← New transcription` back link |

## shadcn/ui components to install

| Component | Replaces |
|---|---|
| `Button` | Inline Tailwind button classes throughout |
| `Badge` | Language / status / credits pills |
| `Tabs` | Mode toggles (Upload/Record) and Text/Timestamps/Summary |
| `Sonner` (toast) | `copied` state → toast notification |
| `Separator` | `border-b border-white/[0.06]` dividers |

Do not install what isn't needed yet. No Dialog, no Sheet, no Command palette — YAGNI.

## DesktopNav spec

- Width: 52px fixed, full viewport height
- Background: `#111` / `border-r border-white/[0.06]`
- Logo: `T` monogram top, `#e2ff00`
- NavItem: icon (20px) + label (9px) centered; active state `bg-[#e2ff00]/10 text-[#e2ff00]`; inactive `text-white/30 hover:text-white/60`

## BottomNav spec

- Height: 56px + safe-area-inset-bottom (iOS PWA)
- Background: `#0a0a0a` / `border-t border-white/[0.06]`
- 3 items evenly spaced: icon (18px) + label (9px)
- Active: `text-[#e2ff00]`; inactive: `text-white/25`

## Account tab content

Renders inline on `/billing` route (or new `/account` route — TBD during impl):
1. Credits card — balance in big text, "Buy more →" CTA
2. Telegram connect card (hidden if already connected)
3. Sign out link

## What does NOT change

- `src/lib/credits.ts` — zero touches
- All API routes under `src/app/api/`
- `src/lib/gladia.ts`, `src/lib/groq.ts`
- Transcription result page logic
- Supabase schema and RLS
- PWA manifest and service worker

## Risks

- `next-pwa` builds with `--webpack` flag — shadcn/ui install (CLI) should not affect this; verify `npm run build` passes after install.
- iOS safe-area: `BottomNav` must use `pb-safe` / `env(safe-area-inset-bottom)` to not clip under home indicator.
