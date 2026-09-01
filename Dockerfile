FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt

COPY AlSaeed-Platform-V13.zip /tmp/alsaeed-v13.zip

RUN mkdir -p /opt/src /app \
    && unzip -q /tmp/alsaeed-v13.zip -d /opt/src \
    && SERVER_DIR="$(find /opt/src -type f -path '*/server/package.json' -printf '%h\n' | head -n 1)" \
    && test -n "$SERVER_DIR" \
    && cp -a "$SERVER_DIR"/. /app/ \
    && rm -rf /opt/src /tmp/alsaeed-v13.zip

WORKDIR /app
RUN npm ci --omit=dev

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
