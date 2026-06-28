# Multi-stage build for TanStack Start/Vite production with Bun
FROM oven/bun:1-alpine AS base

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_BACKEND_PUBLIC_URL
ARG NEXT_PUBLIC_BACKEND_PUBLIC_URL
ARG VITE_VISUALIZER_URL
ARG NEXT_PUBLIC_VISUALIZER_URL
ARG CURRENT_BRANCH
ENV CURRENT_BRANCH=$CURRENT_BRANCH

RUN apk add --no-cache git nodejs openssh
RUN VITE_BACKEND_PUBLIC_URL="${VITE_BACKEND_PUBLIC_URL:-$NEXT_PUBLIC_BACKEND_PUBLIC_URL}" \
    VITE_VISUALIZER_URL="${VITE_VISUALIZER_URL:-$NEXT_PUBLIC_VISUALIZER_URL}" \
    node node_modules/vite/bin/vite.js build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S -g 1001 bunjs
RUN adduser -S -u 1001 start -G bunjs
RUN apk add --no-cache nodejs

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=builder --chown=start:bunjs /app/dist ./dist

USER start

EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", "node_modules/.bin/srvx", "serve", "--entry", "dist/server/server.js", "--static", "dist/client", "--prod"]
