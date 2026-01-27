<a href="https://coregame.sh">
<img src="https://status.coregame.sh/badge/web/status?labelColor=&color=&style=for-the-badge&label=coregame.sh"/>
</a>

The CORE Game website built with Next.js, NestJS, and Go microservices for managing tournaments, teams, and game execution.

## Architecture Overview

This project consists of multiple microservices:

* **[Frontend](frontend/README.md)** - Next.js web application
* **[API Service](api/README.md)** - Main backend API (NestJS + PostgreSQL)
* **[GitHub Service](github-service/README.md)** - Repository management microservice
* **[K8s Service](k8s-service/README.md)** - Game execution in Kubernetes clusters

## Quick Start

### Option 1: DevContainer (slower in execution but easier)

The easiest way to get started is using the provided DevContainer:

1. Open the project in VS Code
2. Install the "Dev Containers" extension
3. Press `Ctrl+Shift+P` → "Dev Containers: Reopen in Container"
4. Wait for the container to build and start

The DevContainer includes all necessary tools and services pre-configured.

### Option 2: Manual Setup (faster but more complex)

If you prefer to install everything locally:

#### Prerequisites

* **Node.js 18+** with pnpm
* **Go 1.25+**
* **PostgreSQL** (or use Docker Compose)
* **RabbitMQ** (or use Docker Compose)
* **Kubernetes cluster** (for game execution)
* **S3-compatible storage** (for replay storage)

#### Quick Infrastructure Setup

For PostgreSQL and RabbitMQ, you can use the provided Docker Compose:

```bash
cd .devcontainer && docker compose up -d postgres rabbitmq
```

This starts:

* **PostgreSQL** on `localhost:5432` (user: `postgres`, password: `postgres`, db: `postgres`)
* **RabbitMQ** on `localhost:5672` (management UI: `http://localhost:15672`, user: `guest`, password: `guest`)

The default environment variables in each service are configured to work with these settings.

#### Basic Setup (Website Only)

For basic website functionality:

1. **Start infrastructure** (PostgreSQL + RabbitMQ)
2. **Configure Frontend** - See [frontend/README.md](frontend/README.md)
3. **Configure API** - See [api/README.md](api/README.md)
4. **Start services:** - See individual READMEs for details

#### Full Setup (All Features)

For complete functionality including GitHub integration and game execution:

1. **Start PostgreSQL**
2. **Start RabbitMQ**
3. **Set up Kubernetes cluster** (recommended: [kind](https://kind.sigs.k8s.io/))
4. **Configure S3 storage** for replay storage
5. **Configure all services:**
   * [Frontend](frontend/README.md) - Web interface
   * [API Service](api/README.md) - Main backend
   * [GitHub Service](github-service/README.md) - Repository management
   * [K8s Service](k8s-service/README.md) - Game execution
6. **Start all services**

## Service Dependencies

### Core Services (Required)

* **Frontend** ← **API Service** ← **PostgreSQL**

### Extended Features

* **GitHub Integration** requires **RabbitMQ** + **GitHub Service**
* **Game Execution** requires **Kubernetes** + **K8s Service** + **S3 Storage**

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally using the DevContainer or manual setup
5. Submit a pull request

## Support

For issues and questions:

* Check individual service READMEs for specific setup issues
* Open an issue in this repository
