# GitHub Service

NestJS microservice for GitHub repository management and user invitations.

## Overview

This service handles GitHub operations including:

* Creating team repositories
* Adding/removing users from repositories
* Managing repository permissions
* Deleting repositories

## Getting Started

### Prerequisites

Use Node.js 26 (Docker and CI use 26.10.0) and pnpm 12.8.1:

Install pnpm:

```bash
corepack enable && corepack prepare pnpm@12.8.1 --activate
```

or

```bash
npm install -g pnpm@12.8.1
```

### Installation & Setup

1. Install dependencies:

   ```bash
   pnpm install --frozen-lockfile
   ```

2. Set up environment variables:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your configuration (see [Environment Variables](#environment-variables) below).

3. Run development server:

   ```bash
   pnpm start:dev
   ```

### Production

* **Build:** `pnpm build`
* **Start:** `pnpm start:prod`

### Dependency compatibility

TypeScript stays on `~6.0.3`: TypeScript 7.0.2 does not expose the JavaScript
compiler API required by Nest CLI and ts-jest, and is outside the supported
range of typescript-eslint. Revisit this pin when those tools support TypeScript 7.
Jest scripts enable VM modules to load the ESM packages introduced in NestJS 12.

### Production Docker image

From the repository root:

```bash
docker build --pull --platform linux/amd64 -t github-service:local ./github-service
docker run --rm --platform linux/amd64 --env-file github-service/.env github-service:local
```

Set `RABBITMQ_URL` to a broker reachable from the container. Successful startup
logs `Nest microservice successfully started` and creates a consumer on the
`github_service` quorum queue. This is a RabbitMQ worker and has no HTTP port.
Local dependencies, build output, and environment files are excluded from the
Docker build context.

## Environment Variables

### Required

* `RABBITMQ_URL` - RabbitMQ connection URL for message queue
* `API_SECRET_ENCRYPTION_KEY` - Key for decrypting encrypted secrets

## Architecture

This service runs as a NestJS microservice that listens to RabbitMQ events:

* `create_team_repository` - Creates a new team repository
* `add_user_to_repository` - Adds a user to a repository
* `remove_user_from_repository` - Removes a user from a repository
* `remove_write_permissions` - Changes user permissions to read-only
* `delete_repository` - Deletes a repository
