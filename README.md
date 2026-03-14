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

### Prerequisites

* **Docker** (running)
* **k3d** — [k3d.io](https://k3d.io/stable/#installation)
* **Tilt** — [docs.tilt.dev/install.html](https://docs.tilt.dev/install.html)
* **Helm** — [helm.sh/docs/intro/install](https://helm.sh/docs/intro/install)
* **kubectl** — [kubernetes.io/docs/tasks/tools](https://kubernetes.io/docs/tasks/tools)

On macOS you can install all at once:
```bash
brew install k3d helm kubectl && brew install tilt-dev/tap/tilt
```

### Start

```bash
make dev
```

This will:
1. Create a local k3d cluster (or start it if it already exists)
2. Guide you through setting up OAuth credentials in `.env.tilt`
3. Launch Tilt, which builds and deploys all services into the cluster

Once running, services are available at:

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:4000 |
| RabbitMQ UI | http://localhost:15672 (guest / guest) |
| SeaweedFS S3 | http://localhost:9000 |
| PostgreSQL | localhost:5432 (postgres / postgres) |

### OAuth Setup

On first run, `make dev` will ask for OAuth credentials and save them to `.env.tilt` (gitignored).
You need at least a **GitHub OAuth App**:

* Create one at: https://github.com/settings/developers → "New OAuth App"
* Homepage URL: `http://localhost:3000`
* Callback URL: `http://localhost:4000/auth/github/callback`

42 Network OAuth is optional.

### Other commands

```bash
make stop    # Stop the cluster (preserves data)
make clean   # Delete the cluster entirely
```

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
4. Test locally using `make dev`
5. Submit a pull request

## Support

For issues and questions:

* Check individual service READMEs for specific setup issues
* Open an issue in this repository
