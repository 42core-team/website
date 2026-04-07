## Stage 1: Build
FROM oven/bun:1.3.11-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source and build
COPY . .
RUN bun run build

## Stage 2: Production runtime
FROM oven/bun:1.3.11-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy production dependencies and built artifacts
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=builder /app/dist ./dist

RUN apk add --no-cache git

# Set git config for container
RUN git config --global user.name "corethegame"
RUN git config --global user.email "core@paulgrossmann.de"

# Start the microservice
CMD ["bun", "dist/main.js"]
