# Stack map

| Capability | Library / approach | Why |
|---|---|---|
| UI i18n (en / es / pt) | `next-intl` 4.x | Official App Router pattern; peer-deps include Next 16; uses `src/proxy.ts` (renamed from middleware) with matcher that skips `/api/*` |
| App framework | Next.js 16.3.8, build `next build --webpack` | Pinned after the image-optimizer advisory. next-pwa still needs webpack or the service worker is not emitted |
| Uploaded file length | ffprobe from the `ffmpeg` nix package | The server measures duration. The browser hint is ignored. Public uploads cap at 100 MB and require Content-Length |
| Link download | separate `downloader/` service | Only `profiles.is_unlimited`. The Next app does not ship yt-dlp. The service refuses private networks and does not start without the egress filter |
| Long-running HTTP | `src/lib/long-request.mjs`, undici 7 | Explicit headers/body deadlines for downloads and local Bot API video sends; an AbortSignal alone leaves the default five-minute headers timeout |
| Telegram video geometry | `src/lib/local-video.mjs`, ffprobe | Send measured display dimensions and duration explicitly, including SAR and rotation. H.264 conversion normalizes pixels to SAR 1:1 |
| Download failures | `downloader/failures.mjs` | Distinguish unsupported URLs, image-only posts, source anti-bot/login restrictions and timeouts; logs contain stage, host and code |
| Threads videos | `downloader/plugins/threads/yt_dlp_plugins/extractor/threads.py` | Bundled yt-dlp extractor, anonymous browser impersonation via the binary's curl_cffi. Selects only the requested post, with HTTPS Meta CDN media; uses the same protected proxy |
| Link regression checks | `scripts/link-media.test.mjs` | Real delayed HTTP responses and generated video fixtures; run with `node --test scripts/link-media.test.mjs` (ffmpeg/ffprobe required) |
| Threads regression checks | `downloader/test-threads.py` | `uv run --script downloader/test-threads.py`; packaged plugin discovery, share links, exact post selection and CDN URL validation |
