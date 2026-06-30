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
ARG VITE_VISUALIZER_URL
ARG VITE_FORTY_TWO_CLIENT_ID
ARG VITE_S3_REPLAYS_BUCKET_URL
ARG CURRENT_BRANCH
ENV CURRENT_BRANCH=$CURRENT_BRANCH

RUN apk add --no-cache git nodejs openssh
RUN STATIC_BUILD=true \
    VITE_BACKEND_PUBLIC_URL="${VITE_BACKEND_PUBLIC_URL}" \
    VITE_VISUALIZER_URL="${VITE_VISUALIZER_URL}" \
    VITE_FORTY_TWO_CLIENT_ID="${VITE_FORTY_TWO_CLIENT_ID}" \
    VITE_S3_REPLAYS_BUCKET_URL="${VITE_S3_REPLAYS_BUCKET_URL}" \
    node node_modules/vite/bin/vite.js build

# Production image
FROM nginx:1.29-alpine AS runner

EXPOSE 3000

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/client /usr/share/nginx/html
