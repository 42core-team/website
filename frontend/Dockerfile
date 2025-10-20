# Multi-stage build for Next.js production with pnpm
FROM node:25-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_FORTY_TWO_CLIENT_ID
ENV NEXT_PUBLIC_FORTY_TWO_CLIENT_ID=$NEXT_PUBLIC_FORTY_TWO_CLIENT_ID
ARG NEXT_PUBLIC_BACKEND_PUBLIC_URL
ENV NEXT_PUBLIC_BACKEND_PUBLIC_URL=$NEXT_PUBLIC_BACKEND_PUBLIC_URL
ARG NEXT_PUBLIC_VISUALIZER_URL
ENV NEXT_PUBLIC_VISUALIZER_URL=$NEXT_PUBLIC_VISUALIZER_URL
ARG CURRENT_BRANCH
ENV CURRENT_BRANCH=$CURRENT_BRANCH

RUN apk add --no-cache git openssh
RUN --mount=type=secret,id=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY \
    export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY)" && \
    pnpm build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/content ./content

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
