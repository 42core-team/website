# K8s Service

Go microservice for managing game execution in Kubernetes clusters.

## Overview

This Go service handles:

* Game execution as Kubernetes jobs
* Container log retrieval
* S3 integration for replay storage
* RabbitMQ message processing

## Getting Started

### Prerequisites

Install Go 1.27+:

```bash
brew install go
```

or download from https://golang.org/dl/

### Installation & Setup

1. Set up environment variables:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your configuration (see [Environment Variables](#environment-variables) below).

2. Generate API code from the OpenAPI spec:

   ```bash
   make generate
   ```

3. Run development server:

   ```bash
   make run
   ```

### Production

* **Build:** `make build`
* **Test:** `make test`
* **Clean:** `make clean`

## Environment Variables

### Required

* `RABBITMQ` - RabbitMQ connection URL
* `RABBITMQ_HTTP` - RabbitMQ HTTP management URL
* `S3_ENDPOINT` - S3-compatible storage endpoint
* `S3_BUCKET` - S3 bucket name for replay storage
* `S3_ACCESS_KEY_ID` - S3 access key
* `S3_SECRET_ACCESS_KEY` - S3 secret key

### Optional

* `ADDR` - Server address (default: :9000)
* `NAMESPACE` - Kubernetes namespace (default: coregame)
* `S3_REGION` - S3 region (default: eu)
* `KUBE_PATH` - Path to kubeconfig file
* `BOT_PORT_ISOLATION` - Bind each bot to its own game server port (default: false, see [Bot port isolation](#bot-port-isolation))

## Bot port isolation

All containers of a game pod share one network namespace, and every bot logs in
to the game server with a random numeric ID. Without isolation, a bot can try
IDs on `127.0.0.1:4444` and log in as its opponent before the opponent has
finished compiling.

With `BOT_PORT_ISOLATION=true`, the service binds each bot's identity to a TCP
port:

| Bot index | uid (bot and clone container) | Game server port |
| --------- | ----------------------------- | ---------------- |
| 0         | 2000                          | 4501             |
| 1         | 2001                          | 4502             |
| n         | 2000 + n                      | 4501 + n         |

* The game container gets `TEAM_PORTS`, comma-separated `<ID>=<port>` pairs
  keyed by the same random IDs it receives as arguments, for example
  `TEAM_PORTS=123456=4501,654321=4502`.
* The `net-guard` init container installs, for each bot uid: a drop of all
  non-loopback egress (IPv4 and IPv6), a redirect of IPv4 loopback connections
  to port 4444 to the bot's own port (nat table), and a drop of loopback
  connections to the other bots' ports. Over IPv6 nothing is redirected
  (ip6tables nat is not needed): connections to 4444 and to the other bots'
  ports are dropped. Bots keep connecting to `127.0.0.1:4444`.
* Bots cannot serve on the game server ports either: `net-guard` drops every
  bot uid's outgoing TCP packets from port 4444 or any team port (IPv4 and
  IPv6, on every interface), so a bot that binds one of these ports before the
  game server does can never answer a connection.
* Each bot and its clone container run as the bot's own uid, so the cloned
  files and the per-bot volumes stay owned by that bot. No `fsGroup` is needed.

The game server image must support `TEAM_PORTS`: listen only on the listed
ports and accept a login only when its ID matches the port it arrived on.
Older images ignore `TEAM_PORTS` and listen only on 4444, where a redirected
bot finds nothing. Only enable the flag once every event uses a game server
image that supports `TEAM_PORTS`. With the flag off (the default) the game Job
is the same as without this feature: every bot runs as uid 2000, the game
server listens on 4444 and no `TEAM_PORTS` is set.
