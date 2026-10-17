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
| Complete social posts | `downloader/post-media.mjs`, `video-media.mjs`, `process.mjs` | Bounded yt-dlp metadata, original caption, ordered photos/videos, JPEG normalization through the protected proxy; silent videos and per-slide failures |
| Shared post files | `src/lib/link-post.mjs`, `link-download.ts` | Validates UUID, ordered item schema and real paths; legacy downloader replies remain readable; cleanup owns only its UUID workspace |
| Telegram post delivery | `src/lib/post-delivery.mjs`, `process-post.mjs` | Ordered albums of 2-10 or single media, lossless plain-text chunks, measured video geometry, bounded retry_after handling; caption, image results and audio transcripts remain distinct |
| Image text / descriptions | `src/lib/image-analysis.mjs`, `@google/genai` | Explicit Vertex project and external ADC; trial expiry guard, one structured OCR-or-description request per photo, no alternate provider fallback |
| Post regression checks | `scripts/*.test.mjs`, `downloader/*.test.mjs` | Local HTTP Bot API probes, mixed/text-only posts, Unicode, secret-safe failures, image bytes, metadata bounds and proxy/path protections |
| Secret checks | `.github/workflows/check.yml`, `.gitleaksignore` | Gitleaks history job; only three reviewed historical model-name false positives are ignored, never a general key rule |
