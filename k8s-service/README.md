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

Install Go 1.25+:

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
