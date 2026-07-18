<a href="https://coregame.sh">
  <img src="https://status.coregame.sh/badge/web/status?labelColor=&color=&style=for-the-badge&label=coregame.sh" alt="coregame.sh status" />
</a>

# CORE Game

The CORE Game website is a tournament, team, and game-execution platform built with a React frontend, NestJS services, and a Go Kubernetes service.

## Architecture overview

This monorepo contains four application services:

- **[Frontend](frontend/README.md)** — React application powered by TanStack Start and Vite
- **[API service](api/README.md)** — Main NestJS API backed by PostgreSQL
- **[GitHub service](github-service/README.md)** — NestJS microservice for repository and team management
- **[K8s service](k8s-service/README.md)** — Go service for running games in Kubernetes and storing replays

Local development also runs PostgreSQL, RabbitMQ, and SeaweedFS inside a k3d cluster.

## Quick start

### Prerequisites

- **Docker** — installed and running
- **[k3d](https://k3d.io/stable/#installation)**
- **[Tilt](https://docs.tilt.dev/install.html)**
- **[Helm](https://helm.sh/docs/intro/install)**
- **[kubectl](https://kubernetes.io/docs/tasks/tools)**

On macOS, install the command-line prerequisites with:

```bash
brew install k3d helm kubectl
brew install tilt-dev/tap/tilt
```

Docker Desktop must be installed and started separately.

### Start the development environment

From the repository root, run:

```bash
make
```

This command:

1. Configures the repository's Git hooks.
2. Creates the `core-dev` k3d cluster, or starts it if it already exists.
3. Writes the cluster configuration to `kubeconfig.yaml`.
4. Guides you through creating `.env.tilt` for local OAuth credentials.
5. Starts Tilt, which builds and deploys the services into the cluster.

Once Tilt reports the resources as ready, the local services are available at:

| Service | URL or address |
| --- | --- |
| Frontend | <http://localhost:3000> |
| API | <http://localhost:4000> |
| RabbitMQ | `localhost:5672` |
| RabbitMQ management UI | <http://localhost:15672> (`guest` / `guest`) |
| SeaweedFS S3 API | <http://localhost:9000> |
| SeaweedFS master UI | <http://localhost:9001> |
| SeaweedFS filer UI | <http://localhost:9002> |
| K8s service | <http://localhost:9003> |
| PostgreSQL | `localhost:5432` (`postgres` / `postgres`) |

The local PostgreSQL connection string is:

```text
postgresql://postgres:postgres@localhost:5432/postgres
```

### OAuth setup

The application can start without OAuth credentials, but login will not work until at least one provider is configured. On the first `make dev`, the setup script can collect the credentials and save them in the gitignored `.env.tilt` file.

For GitHub login, create a [GitHub OAuth App](https://github.com/settings/developers) with:

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:4000/auth/github/callback`

For optional 42 Network login, create an OAuth application with this redirect URI:

```text
http://localhost:4000/auth/42/callback
```

To change the credentials later, edit `.env.tilt`, or delete it and run `make dev` again.

### Other commands

```bash
make stop     # Stop the cluster while preserving its data
make cluster  # Create the cluster without starting Tilt
make clean    # Delete the cluster and generated kubeconfig
```

## Service dependencies

### Core application

```text
Frontend -> API service -> PostgreSQL
```

### Extended features

- GitHub integration requires RabbitMQ and the GitHub service.
- Game execution requires RabbitMQ, the K8s service, Kubernetes, and S3-compatible storage.

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make and verify your changes.
4. Test the application locally with `make dev`.
5. Submit a pull request.

## Support

For issues and questions:

- Check the individual service READMEs for service-specific setup and commands.
- Open an issue in this repository.
