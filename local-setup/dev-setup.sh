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
# .env.tilt holds secrets, so only its owner may read it.
[ -f ".env.tilt" ] || cp .env.tilt.example .env.tilt
chmod 600 .env.tilt

# The value the Tiltfile reads for a key: the last assignment, trimmed.
env_value() {
  KEY="$1" awk '
    BEGIN { key = ENVIRON["KEY"] }
    { line = $0; sub(/^[ \t]+/, "", line) }
    line ~ /^#/ || index(line, "=") == 0 { next }
    {
      k = substr(line, 1, index(line, "=") - 1); gsub(/[ \t]+$/, "", k)
      if (k == key) { v = substr(line, index(line, "=") + 1); gsub(/^[ \t]+|[ \t]+$/, "", v) }
    }
    END { print v }
  ' .env.tilt
}

# Sets a key in .env.tilt, dropping its other assignments.
set_env() {
  KEY="$1" VALUE="$2" awk '
    BEGIN { key = ENVIRON["KEY"]; value = ENVIRON["VALUE"] }
    { line = $0; sub(/^[ \t]+/, "", line); k = "" }
    line !~ /^#/ && index(line, "=") > 0 {
      k = substr(line, 1, index(line, "=") - 1); gsub(/[ \t]+$/, "", k)
    }
    k == key { if (!done) print key "=" value; done = 1; next }
    { print }
    END { if (!done) print key "=" value }
  ' .env.tilt > .env.tilt.tmp && chmod 600 .env.tilt.tmp && mv .env.tilt.tmp .env.tilt
}

# Optional prompts are declined when there is no terminal or on end of input.
ask() {
  local reply=""
  if [ -t 0 ]; then read -r "$@" reply || reply=""; fi
  echo "$reply"
}

echo ""
if [ -n "$(env_value CLIENT_GITHUB_ID)" ] || [ -n "$(env_value FORTYTWO_CLIENT_ID)" ]; then
  echo "==> OAuth credentials found in .env.tilt."
else
  echo "==> No OAuth credentials in .env.tilt."
  echo ""
  echo "    .env.tilt holds your credentials for local development."
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
  setup_oauth=$(ask -p "    Set up OAuth credentials now? [y/N]: ")
  echo ""

  if echo "$setup_oauth" | grep -iq "^y"; then
    github_id=$(ask -p "    GitHub Client ID:      ")
    github_secret=$(ask -s -p "    GitHub Client Secret: ")
    echo ""
    ft_id=$(ask -p "    42 Client ID (leave empty to skip): ")
    ft_secret=""
    if [ -n "$ft_id" ]; then
      ft_secret=$(ask -s -p "    42 Client Secret:    ")
      echo ""
    fi
    set_env CLIENT_GITHUB_ID "$github_id"
    set_env CLIENT_GITHUB_SECRET "$github_secret"
    set_env FORTYTWO_CLIENT_ID "$ft_id"
    set_env FORTYTWO_CLIENT_SECRET "$ft_secret"
    echo "    Saved to .env.tilt."
  else
    echo "    Skipped. OAuth login will not work until you add credentials."
    echo "    Edit .env.tilt, or run 'make dev' again to go through setup."
  fi
fi

# ── GitHub App ────────────────────────────────────────────────────────────────
echo ""
if [ -n "$(env_value GITHUB_APP_ID)" ]; then
  echo "==> GitHub App found in .env.tilt."
else
  echo "==> No GitHub App configured in .env.tilt."
  echo ""
  echo "    Events create team repositories through the CORE GitHub App."
  echo "    The setup can create a development App on GitHub for you and"
  echo "    write its credentials to .env.tilt (see docs/github-app.md)."
  echo ""
  setup_app=$(ask -p "    Create a development GitHub App now? [y/N]: ")
  if echo "$setup_app" | grep -iq "^y"; then
    if ! command -v node &>/dev/null; then
      echo "    node is not installed; skipping. Install Node.js and run 'make github-app'."
    elif ! node local-setup/github-app-setup.mjs; then
      echo "    GitHub App setup failed; continuing without it. Run 'make github-app' to retry."
    fi
  else
    echo "    Skipped. Run 'make github-app' later to create one."
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
echo "      SeaweedFS S3:       http://localhost:9000  (nginx proxy — supports browser CORS)"
echo "      SeaweedFS Master:   http://localhost:9001"
echo "      SeaweedFS Filer:    http://localhost:9002"
echo "      PostgreSQL:         localhost:5432          (postgres / postgres)"
echo "                          postgresql://postgres:postgres@localhost:5432/postgres"
echo "      K8s Service:        http://localhost:9003"
echo ""

KUBECONFIG="$REPO_ROOT/kubeconfig.yaml" tilt up
