# syntax=docker/dockerfile:1

# Image whose assets this build keeps serving. See docs/adr/0004.
ARG PREVIOUS_IMAGE

FROM oven/bun:1.4.4-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM oven/bun:1.4.4-alpine AS builder
WORKDIR /app

RUN apk add --no-cache git nodejs openssh

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_BACKEND_PUBLIC_URL
ARG VITE_VISUALIZER_URL
ARG VITE_FORTY_TWO_CLIENT_ID
ARG VITE_MEDIA_URL
ARG VITE_S3_REPLAYS_BUCKET_URL
ARG CURRENT_BRANCH
ENV CURRENT_BRANCH=$CURRENT_BRANCH

# A secret mount keeps the token out of the public image and its history.
RUN --mount=type=secret,id=github_token \
    GITHUB_TOKEN="$(cat /run/secrets/github_token 2>/dev/null || true)" \
    STATIC_BUILD=true \
    VITE_BACKEND_PUBLIC_URL="${VITE_BACKEND_PUBLIC_URL}" \
    VITE_VISUALIZER_URL="${VITE_VISUALIZER_URL}" \
    VITE_FORTY_TWO_CLIENT_ID="${VITE_FORTY_TWO_CLIENT_ID}" \
    VITE_S3_REPLAYS_BUCKET_URL="${VITE_S3_REPLAYS_BUCKET_URL}" \
    VITE_MEDIA_URL="${VITE_MEDIA_URL}" \
    bun run build

FROM ${PREVIOUS_IMAGE:-nginx:1.31.8-alpine} AS previous

# The previous image is only read, nothing from it runs during this build.
FROM nginx:1.31.8-alpine AS previous-assets

# Bound the image size: assets drop out 14 days after the build that made them.
RUN --mount=type=bind,from=previous,source=/usr/share/nginx/html,target=/previous \
    mkdir -p /carried-assets && \
    if [ -d /previous/assets ]; then cp -a /previous/assets/. /carried-assets/; fi && \
    find /carried-assets -type f -mtime +14 -delete

FROM nginx:1.31.8-alpine AS runner

EXPOSE 3000

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=previous-assets /carried-assets /usr/share/nginx/html/assets
COPY --from=builder /app/dist/client /usr/share/nginx/html
