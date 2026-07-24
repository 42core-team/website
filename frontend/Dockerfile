# syntax=docker/dockerfile:1

FROM oven/bun:1-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM oven/bun:1-alpine AS builder
WORKDIR /app

RUN apk add --no-cache git nodejs openssh

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_BACKEND_PUBLIC_URL
ARG VITE_VISUALIZER_URL
ARG VITE_FORTY_TWO_CLIENT_ID
ARG VITE_S3_REPLAYS_BUCKET_URL
ARG CURRENT_BRANCH
ENV CURRENT_BRANCH=$CURRENT_BRANCH

RUN STATIC_BUILD=true \
    VITE_BACKEND_PUBLIC_URL="${VITE_BACKEND_PUBLIC_URL}" \
    VITE_VISUALIZER_URL="${VITE_VISUALIZER_URL}" \
    VITE_FORTY_TWO_CLIENT_ID="${VITE_FORTY_TWO_CLIENT_ID}" \
    VITE_S3_REPLAYS_BUCKET_URL="${VITE_S3_REPLAYS_BUCKET_URL}" \
    bun run build

FROM nginx:1.29-alpine AS runner

EXPOSE 3000

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/client /usr/share/nginx/html
