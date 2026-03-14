#!/usr/bin/env bash
set -euo pipefail

# Must be run from the repository root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

CLUSTER_NAME="core-dev"
K3D_CONFIG="local-setup/k3d-config.yaml"

# ── Tool checks ───────────────────────────────────────────────────────────────
echo "==> Checking required tools..."

MISSING=()
check_tool() {
  local cmd=$1
  if ! command -v "$cmd" &>/dev/null; then
    MISSING+=("$cmd")
    echo "    $cmd: MISSING"
  else
    echo "    $cmd: OK"
  fi
}

check_tool k3d
check_tool tilt
check_tool helm
check_tool kubectl

if [ ${#MISSING[@]} -gt 0 ]; then
  echo ""
  echo "ERROR: The following tools are not installed: ${MISSING[*]}"
  echo ""
  echo "  k3d:     https://k3d.io/stable/#installation"
  echo "  tilt:    https://docs.tilt.dev/install.html"
  echo "  helm:    https://helm.sh/docs/intro/install"
  echo "  kubectl: https://kubernetes.io/docs/tasks/tools"
  echo ""
  echo "  On macOS you can install all at once with:"
  echo "    brew install k3d helm kubectl && brew install tilt-dev/tap/tilt"
  echo ""
  exit 1
fi

echo ""
echo "==> Checking Docker is running..."
if ! docker info &>/dev/null; then
  echo "ERROR: Docker is not running. Start Docker Desktop and retry."
  exit 1
fi
echo "    Docker: OK"

# ── k3d cluster ───────────────────────────────────────────────────────────────
echo ""
echo "==> Setting up k3d cluster '$CLUSTER_NAME'..."
if k3d cluster list 2>/dev/null | grep -q "^$CLUSTER_NAME"; then
  if k3d cluster list 2>/dev/null | grep "^$CLUSTER_NAME" | grep -q "0/1"; then
    echo "    Cluster '$CLUSTER_NAME' is stopped — starting it..."
    k3d cluster start "$CLUSTER_NAME"
    echo "    Cluster started."
  else
    echo "    Cluster '$CLUSTER_NAME' is already running."
  fi
else
  k3d cluster create --config "$K3D_CONFIG"
  echo "    Cluster created."
fi

echo ""
echo "==> Writing kubeconfig to project root (kubeconfig.yaml)..."
k3d kubeconfig get "$CLUSTER_NAME" > kubeconfig.yaml
echo "    Done."

# ── /etc/hosts check ─────────────────────────────────────────────────────────
echo ""
if ! grep -q "k3d-registry.localhost" /etc/hosts 2>/dev/null; then
  echo "    WARNING: 'k3d-registry.localhost' not found in /etc/hosts."
  echo "    k3d should add this automatically. If image pulls fail, add manually:"
  echo "      sudo sh -c 'echo \"127.0.0.1  k3d-registry.localhost\" >> /etc/hosts'"
else
  echo "==> Registry hostname: OK"
fi

# ── .env.tilt setup ───────────────────────────────────────────────────────────
echo ""
if [ -f ".env.tilt" ]; then
  echo "==> .env.tilt already exists — skipping setup."
else
  echo "==> No .env.tilt found."
  echo ""
  echo "    This file holds your OAuth credentials for local development."
  echo "    It is gitignored and never committed."
  echo ""
  echo "    You need at least one OAuth application:"
  echo ""
  echo "    1. GitHub OAuth App (required for GitHub login)"
  echo "       Create at: https://github.com/settings/developers → 'New OAuth App'"
  echo "         Homepage URL:   http://localhost:3000"
  echo "         Callback URL:   http://localhost:4000/auth/github/callback"
  echo ""
  echo "    2. 42 Network OAuth App (optional)"
  echo "       Create at: https://profile.intra.42.fr/oauth/applications → 'New Application'"
  echo "         Redirect URI:   http://localhost:4000/auth/42/callback"
  echo ""
  read -r -p "    Set up OAuth credentials now? [y/N]: " setup_oauth
  echo ""

  if echo "$setup_oauth" | grep -iq "^y"; then
    read -r -p "    GitHub Client ID:      " github_id
    read -r -s -p "    GitHub Client Secret: " github_secret
    echo ""
    read -r -p "    42 Client ID (leave empty to skip): " ft_id
    ft_secret=""
    if [ -n "$ft_id" ]; then
      read -r -s -p "    42 Client Secret:    " ft_secret
      echo ""
    fi

    cat > .env.tilt <<EOF
# Local dev OAuth credentials — never commit this file.
# Delete this file and run 'make dev' again to redo the setup.

CLIENT_GITHUB_ID=${github_id}
CLIENT_GITHUB_SECRET=${github_secret}

FORTYTWO_CLIENT_ID=${ft_id}
FORTYTWO_CLIENT_SECRET=${ft_secret}
EOF
    echo "    .env.tilt created."
  else
    cp .env.tilt.example .env.tilt
    echo "    Created .env.tilt with empty values."
    echo "    OAuth login will not work until you add credentials."
    echo "    Edit .env.tilt or delete it and re-run 'make dev' to go through setup again."
  fi
fi

# ── Launch ────────────────────────────────────────────────────────────────────
echo ""
echo "==> Starting Tilt..."
echo ""
echo "    Services will be available at:"
echo "      Frontend:           http://localhost:3000"
echo "      API:                http://localhost:4000"
echo "      RabbitMQ UI:        http://localhost:15672  (guest / guest)"
echo "      SeaweedFS S3:       http://localhost:9000"
echo "      SeaweedFS Master:   http://localhost:9001"
echo "      SeaweedFS Filer:    http://localhost:9002"
echo "      PostgreSQL:         localhost:5432          (postgres / postgres)"
echo "                          postgresql://postgres:postgres@localhost:5432/postgres"
echo "      K8s Service:        http://localhost:9003"
echo ""

KUBECONFIG="$REPO_ROOT/kubeconfig.yaml" tilt up
