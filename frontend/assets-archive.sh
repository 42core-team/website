#!/bin/sh
# Writes the proxy settings for nginx's @assets_archive location.
# ASSETS_ARCHIVE_URL is the bucket's base URL, e.g.
# https://object.storage.eu01.onstackit.cloud/frontend-assets
set -eu

out=/etc/nginx/assets-archive.conf

if [ -z "${ASSETS_ARCHIVE_URL:-}" ]; then
  echo "return 404;" > "$out"
  exit 0
fi

# Resolve the bucket host at request time so nginx still starts if DNS is down.
resolver=$(awk '/^nameserver/ { print $2; exit }' /etc/resolv.conf)
case "$resolver" in
  *:*) resolver="[$resolver]" ;;
esac

cat > "$out" <<EOF
resolver $resolver valid=30s;
proxy_pass ${ASSETS_ARCHIVE_URL%/}\$uri;
proxy_ssl_server_name on;
proxy_ssl_verify on;
proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
proxy_ssl_verify_depth 3;
proxy_http_version 1.1;
proxy_set_header Cookie "";
proxy_set_header Authorization "";
proxy_hide_header Set-Cookie;
proxy_hide_header Cache-Control;
proxy_hide_header Expires;
EOF
