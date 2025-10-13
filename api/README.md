# API Service

Main backend API service for the CORE game website.

## Overview

This NestJS service serves as the primary backend, handling:

* User authentication and management
* Team and event/tournament management
* Match results and statistics
* Database operations (PostgreSQL)
* RabbitMQ microservice communication

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

3. Run database migrations:

   ```bash
   pnpm migration:run-local
   ```

4. Run development server:

   ```bash
   pnpm start:dev
   ```

### Production

* **Build:** `pnpm build`
* **Start:** `pnpm start:prod`

## Environment Variables

### Database (Required)

* `DB_HOST` - PostgreSQL host
* `DB_PORT` - PostgreSQL port
* `DB_USER` - Database username
* `DB_PASSWORD` - Database password
* `DB_NAME` - Database name
* `DB_SCHEMA` - Database schema
* `DB_URL` - Alternative database connection URL overwrites the other database connection variables
* `DB_SSL_REQUIRED` - Enable SSL connection (true/false)

### External Services (Required)

* `RABBITMQ_URL` - RabbitMQ connection URL
* `API_SECRET_ENCRYPTION_KEY` - Key for encrypting sensitive data

### Optional

* `PORT` - Server port (default: 4000)
* `NODE_ENV` - Environment (development/production)

## Database Management

### Migrations

* **Generate:** `pnpm migration:generate --name=migration_name`
* **Create:** `pnpm migration:create --name=migration_name`
* **Run:** `pnpm migration:run-local` (local) / `pnpm migration:run` (production)
* **Revert:** `pnpm migration:revert`

## API Documentation

When running in development mode, Swagger documentation is available at:
`http://localhost:4000/api`

## Architecture

This service runs as both:

* **REST API** - HTTP endpoints for frontend communication
* **Microservice** - RabbitMQ message consumer for:
  * `game_results` - Match result processing
  * `github-service-results` - GitHub operation results
