# Stage 0: Base with pnpm
FROM node:25-alpine AS base
RUN npm install -g pnpm

# Stage 1: Build
FROM base AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# Prune dev dependencies to keep only production deps
RUN pnpm prune --prod

# Stage 2: Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy production dependencies and built artifacts
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Run database migrations before starting the service
CMD ["sh", "-lc", "pnpm run migration:run && node dist/src/main.js"]
