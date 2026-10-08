# Stack map

| Capability | Library / approach | Why |
|---|---|---|
| UI i18n (en / es / pt) | `next-intl` 4.x | Official App Router pattern; peer-deps include Next 16; uses `src/proxy.ts` (renamed from middleware) with matcher that skips `/api/*` |
| App framework | Next.js 16.3.8, build `next build --webpack` | Pinned after the image-optimizer advisory. next-pwa still needs webpack or the service worker is not emitted |
| Uploaded file length | ffprobe from the `ffmpeg` nix package | The server measures duration. The browser hint is ignored. Public uploads cap at 100 MB and require Content-Length |
| Link download | separate `downloader/` service | Only `profiles.is_unlimited`. The Next app does not ship yt-dlp. The service refuses private networks and does not start without the egress filter |
