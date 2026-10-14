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

### Team pictures and backgrounds

Team members can upload, crop, replace, and remove artwork in **My Team → edit icon on the team picture or Edit background on the cover**, including while the roster is locked. JPEG, PNG, static WebP, and animated GIF
uploads are limited to 10 MB and 25 megapixels. The API generates square WebP
pictures (128/512 px) and a single wide cover (1600×600 px), without enlarging
small inputs. GIF animation, frame timing, and looping are preserved in WebP output.
GIFs are limited to 200 frames and 25 million total pixels across all frames,
with a 15-second processing timeout per output. Original uploads are discarded; metadata is stripped.

`make dev` / Tilt creates the `core-team-images` SeaweedFS bucket, configures
public reads of generated images, and runs the database migration on API startup.
The frontend reads images through `http://localhost:9000/core-team-images`.
Uploads go through the authenticated API; browser-to-S3 upload CORS is unnecessary.

For an API running outside Kubernetes, set:

```dotenv
MEDIA_S3_ENDPOINT=http://localhost:9000
MEDIA_S3_BUCKET=core-team-images
MEDIA_S3_REGION=local
MEDIA_S3_ACCESS_KEY_ID=core
MEDIA_S3_SECRET_ACCESS_KEY=coresecret
```

Set frontend `VITE_MEDIA_URL=http://localhost:9000/core-team-images` (also
the development fallback), and run the usual API database migrations. For hosted
environments, configure these variables with your own storage endpoint, bucket,
credentials, and public image URL. Only generated artwork should have public
read access; writes, listing, and deletion belong to the API credentials.

Images use immutable UUID keys. Replacements become visible only after all
required variants are stored. A daily 03:00 server-time cleanup removes unreferenced
objects older than 24 hours, including failed uploads and deleted-team artwork.
The `media_uploads` table stores one object key per variant, and `teams`
references those rows through `pictureSmallUploadId`, `pictureLargeUploadId`,
and `backgroundLargeUploadId` (`ON DELETE SET NULL`). Keeping `media_uploads`
owner-agnostic allows future uploads on other entities without modifying the
media table. The team API still returns `picture` and `background` objects
assembled from these rows. Replacement rows are committed together in a
transaction after storage succeeds.
Generated objects use the shared `images/` prefix. Cleanup is restricted to this
prefix and preserves all uploads referenced by active teams.
Processing is limited to two concurrent uploads per API process and one per team.

Production media storage configuration uses GitHub environment variables
`MEDIA_S3_ENDPOINT`, `MEDIA_S3_BUCKET`, `MEDIA_S3_REGION`, and
`VITE_MEDIA_URL`, plus GitHub environment secrets
`MEDIA_S3_ACCESS_KEY_ID` and `MEDIA_S3_SECRET_ACCESS_KEY`.
`MEDIA_S3_REGION` defaults to `eu01` when unset or empty; local development
explicitly uses `local`.
Set these in each deployed environment (`dev` / `prod`). The API deployment passes
storage settings to Helm. The frontend build embeds `VITE_MEDIA_URL` into
the static bundle, so changing that URL requires rebuilding the frontend image.
The bucket must already exist, with public image reads and API upload/list/delete
permissions. Cleanup uses a PostgreSQL transaction lock shared by API replicas.
