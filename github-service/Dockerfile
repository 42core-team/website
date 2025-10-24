## Stage 1: Build
FROM node:25-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm run build

# Prune dev dependencies to keep only production deps
RUN pnpm prune --prod

## Stage 2: Production runtime
FROM node:25-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy production dependencies and built artifacts
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN apk update
RUN apk add --no-cache git

# Set git config for container
RUN git config --global user.name "corethegame"
RUN git config --global user.email "core@paulgrossmann.de"

# Start the microservice
CMD ["node", "dist/main.js"]
