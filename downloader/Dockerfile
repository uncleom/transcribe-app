FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates ffmpeg iptables util-linux \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY fetch-yt-dlp.mjs private-net.mjs proxy.mjs server.mjs entrypoint.sh ./
RUN node fetch-yt-dlp.mjs && chmod 755 entrypoint.sh

ENV YT_DLP_BIN=/app/bin/yt-dlp
ENV DOWNLOAD_ROOT=/downloads
EXPOSE 8090

ENTRYPOINT ["./entrypoint.sh"]
