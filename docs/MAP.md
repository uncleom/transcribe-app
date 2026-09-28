# Stack map

| Capability | Library / approach | Why |
|---|---|---|
| UI i18n (en / es / pt) | `next-intl` 4.x | Official App Router pattern; peer-deps include Next 16; uses `src/proxy.ts` (renamed from middleware) with matcher that skips `/api/*` |
