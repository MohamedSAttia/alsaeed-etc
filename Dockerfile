FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js admin.js proxy.js gateway.js pmp-engine.js v16-backend.js v18-seed.js v18-build.js ai-assistant.js ./
COPY public ./public
COPY grcp-exam.html rmp-exam.html pba-exam.html grcp-study.html rmp-study.html pba-study.html ./public/

RUN node v18-build.js
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "node v18-seed.js && exec node gateway.js"]
