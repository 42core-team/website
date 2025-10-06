# GitHub Service

NestJS microservice for GitHub repository management and user invitations.

## Overview

This service handles GitHub operations including:
- Creating team repositories
- Adding/removing users from repositories
- Managing repository permissions
- Deleting repositories

## Getting Started

### Prerequisites

Install pnpm:

```bash
corepack enable && corepack prepare pnpm@latest --activate
```

or

```bash
brew install pnpm
```

### Installation & Setup

1. Install dependencies:

   ```bash
   pnpm install
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

- **Build:** `pnpm build`
- **Start:** `pnpm start:prod`

## Environment Variables

### Required

- `RABBITMQ_URL` - RabbitMQ connection URL for message queue
- `API_SECRET_ENCRYPTION_KEY` - Key for decrypting encrypted secrets

## Architecture

This service runs as a NestJS microservice that listens to RabbitMQ events:

- `create_team_repository` - Creates a new team repository
- `add_user_to_repository` - Adds a user to a repository
- `remove_user_from_repository` - Removes a user from a repository
- `remove_write_permissions` - Changes user permissions to read-only
- `delete_repository` - Deletes a repository
