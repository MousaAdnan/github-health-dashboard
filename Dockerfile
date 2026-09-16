# Single image: React build + Express API + Python ingest, one service, one URL.

# ── Stage 1 — build the React client ─────────────────────────────────────────
FROM node:20-alpine AS client
WORKDIR /client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 2 — compile the API ────────────────────────────────────────────────
FROM node:20-alpine AS api
WORKDIR /api
COPY api/package*.json ./
RUN npm ci
COPY api/ ./
RUN npm run build

# ── Stage 3 — runtime: Node and Python in one image ──────────────────────────
FROM node:20-alpine
WORKDIR /app

# python3 runs ingest.py; ca-certificates + py3-certifi give it a trusted
# CA bundle so GitHub requests are verified.
RUN apk add --no-cache python3 ca-certificates py3-certifi

COPY api/package*.json ./
RUN npm ci --omit=dev

COPY --from=api    /api/dist    ./dist
COPY --from=client /client/dist ./public
COPY ingest/ingest.py ./ingest/ingest.py

# Render's free tier has no persistent disk — the SQLite file lives in /tmp and
# is rebuilt on demand by ingest, so it behaves as a cache.
ENV NODE_ENV=production \
    DB_PATH=/tmp/health.db \
    INGEST_SCRIPT=/app/ingest/ingest.py \
    CLIENT_DIST=/app/public \
    TRUST_PROXY=1 \
    PORT=3001

EXPOSE 3001
CMD ["node", "dist/index.js"]
