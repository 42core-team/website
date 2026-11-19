#!/usr/bin/env bash
# Smoke test for the nginx asset archive fallback (nginx.conf + assets-archive.sh).
# Runs the production nginx image against a fake bucket; needs Docker.
set -euo pipefail

frontend=$(cd "$(dirname "$0")/.." && pwd)
image=$(sed -n 's/^FROM \(nginx:[^ ]*\).*/\1/p' "$frontend/Dockerfile")
run_id="assets-archive-test-$$"
work=$(mktemp -d)

cleanup() {
  docker rm -f "$run_id-bucket" "$run_id-on" "$run_id-off" > /dev/null 2>&1 || true
  docker network rm "$run_id" > /dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

mkdir -p "$work/html/assets" "$work/bucket/core/assets"
echo 'app' > "$work/html/index.html"
echo 'current()' > "$work/html/assets/current-abc.js"
echo 'old()' > "$work/bucket/core/assets/old-123.js"
# The local file must win over a bucket copy with the same name.
echo 'stale()' > "$work/bucket/core/assets/current-abc.js"
# Like a private bucket, answer 403 for this key.
cat > "$work/bucket.conf" << 'EOF'
server {
  listen 80;
  root /srv;
  location = /core/assets/forbidden.js { return 403; }
  add_header Cache-Control "no-cache";
}
EOF
chmod -R a+rX "$work"

docker network create "$run_id" > /dev/null
docker run -d --name "$run_id-bucket" --network "$run_id" \
  -v "$work/bucket:/srv:ro" -v "$work/bucket.conf:/etc/nginx/conf.d/default.conf:ro" \
  "$image" > /dev/null

start_frontend() {
  docker run -d --name "$1" --network "$run_id" -p 127.0.0.1::3000 \
    -e ASSETS_ARCHIVE_URL="$2" \
    -v "$frontend/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
    -v "$frontend/assets-archive.sh:/docker-entrypoint.d/40-assets-archive.sh:ro" \
    -v "$work/html:/usr/share/nginx/html:ro" \
    "$image" > /dev/null
}
# Trailing slash on purpose: the script must not produce a double slash.
start_frontend "$run_id-on" "http://$run_id-bucket/core/"
start_frontend "$run_id-off" ""

failures=0
check() {
  local container=$1 path=$2 want_status=$3 want_body=${4:-}
  local port body status
  port=$(docker port "$container" 3000 | head -n 1 | sed 's/.*://')
  for _ in $(seq 1 50); do
    curl -s -o /dev/null "http://127.0.0.1:$port/healthz" && break
    sleep 0.1
  done
  status=$(curl -s -o "$work/body" -w '%{http_code}' "http://127.0.0.1:$port$path")
  body=$(cat "$work/body")
  if [ "$status" = "$want_status" ] && { [ -z "$want_body" ] || [ "$body" = "$want_body" ]; }; then
    echo "ok   $container $path -> $status"
  else
    echo "FAIL $container $path -> $status '$body' (want $want_status ${want_body:+'$want_body'})"
    failures=$((failures + 1))
  fi
}

check "$run_id-on" /teams/123 200 app
check "$run_id-on" /assets/current-abc.js 200 'current()'
check "$run_id-on" /assets/old-123.js 200 'old()'
check "$run_id-on" /assets/missing.js 404
check "$run_id-on" /assets/forbidden.js 404
check "$run_id-off" /assets/current-abc.js 200 'current()'
check "$run_id-off" /assets/old-123.js 404

cache_control=$(curl -s -D - -o /dev/null \
  "http://127.0.0.1:$(docker port "$run_id-on" 3000 | head -n 1 | sed 's/.*://')/assets/old-123.js" \
  | tr -d '\r' | grep -i '^cache-control:' || true)
if echo "$cache_control" | grep -qi 'no-cache'; then
  echo "FAIL bucket Cache-Control leaked through: $cache_control"
  failures=$((failures + 1))
else
  echo "ok   archived asset keeps nginx cache headers"
fi

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed"
  docker logs "$run_id-on" 2>&1 | tail -n 20
  exit 1
fi
