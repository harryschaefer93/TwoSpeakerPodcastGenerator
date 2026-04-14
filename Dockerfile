# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:22-slim AS build

WORKDIR /app

# Install root dependencies (including devDependencies for tsc)
COPY package.json package-lock.json* ./
RUN npm ci

# Install client dependencies
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm ci

# Copy source and build API
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Copy client source and build frontend
COPY client/ ./client/
RUN cd client && npm run build

# ── Stage 2: Production ────────────────────────────────────────
FROM node:22-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Production-only dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts from build stage
COPY --from=build /app/dist/ ./dist/
COPY --from=build /app/client/dist/ ./client/dist/

# Create writable directories for episode store and audio processing
RUN mkdir -p data tmp \
    && addgroup --system --gid 1001 appgroup \
    && adduser --system --uid 1001 --ingroup appgroup appuser \
    && chown -R appuser:appgroup /app/data /app/tmp

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/episodes || exit 1

USER appuser

CMD ["node", "dist/index.js"]
