# API ingress migration

The default `values-dev.yaml` and `values-prod.yaml` still render the original
NGINX ingress. Traefik resources appear only with an explicit overlay. Existing
Services, hostnames, image settings, secrets, and certificate Secret names stay
unchanged.

| Environment | Namespace | Helm release | Host |
| --- | --- | --- | --- |
| Development | development | api-dev | dev.api.coregame.sh |
| Production | production | api-main | api.coregame.sh |

## Before enabling preview

Install Traefik and its `Middleware` CRD through the infrastructure PR first.
The controller must watch IngressClass `traefik`, enable the Kubernetes Ingress
and CRD providers, and expose `websecure` on 443. HTTP on port 80 must redirect
to HTTPS while leaving cert-manager's more-specific HTTP-01 solver route
reachable. Do not enable Traefik's own ACME resolver: cert-manager owns the
existing certificates.

All app subdomains currently CNAME `coregame.sh`. A development-first DNS
cutover requires pointing the development hostname independently at Traefik;
changing the apex A record moves production too. DNS is managed outside this
Terraform configuration after Cloudflare removal; this chart does not update
DNS. Preview routes strip both `external-dns.alpha.kubernetes.io/*` and
`external-dns.kubernetes.io/*` annotations so they cannot publish a new target.

Before moving development DNS, create the separate `letsencrypt-traefik`
ClusterIssuer from the [infrastructure migration guide](https://github.com/42core-team/terraform/blob/t3/add-traefik-migration/cluster/docs/traefik-migration.md), with HTTP-01
`ingressClassName: traefik`, and require it to report Ready:

```bash
export KUBECONFIG=/Users/paul/.kube/kcoregame
kubectl wait --for=condition=Ready clusterissuer/letsencrypt-traefik --timeout=120s
```

Keep the shared `letsencrypt-prod` issuer on NGINX while unmigrated hosts still
use the old load balancer. Override the issuer on the **original certificate
owner**, not the preview ingress. In the selected environment values, set:

```yaml
ingress:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-traefik
```

For operator-driven upgrades, add this exact flag to the preview and later
cutover commands below (and persist it in the pipeline's values):

```bash
--set-string 'ingress.annotations.cert-manager\.io/cluster-issuer=letsencrypt-traefik'
```

Require the issuer to be Ready and verify the existing TLS Secret still serves
a valid certificate before changing development DNS. Changing issuer can start
issuance immediately; HTTP-01 validation through Traefik cannot complete until
the hostname reaches its new load balancer. After DNS moves, require the
Certificate to become Ready with the intended issuer before removing NGINX
ownership. Do not delete or rename the existing certificate Secret. Restore
the original owner's `letsencrypt-prod` annotation when rolling DNS back to
NGINX, and verify renewal again.

The preview Ingress deliberately has no cert-manager annotations: the primary
Ingress remains the sole ingress-shim owner of the existing Certificate. Switch
the shared issuers only after the full cutover.

## Render and test offline

From the repository root:

```bash
helm lint api/helm -f api/helm/values-dev.yaml
helm lint api/helm -f api/helm/values-prod.yaml -f api/helm/values-traefik-preview.yaml
helm template api-dev api/helm -n development \
  -f api/helm/values-dev.yaml -f api/helm/values-traefik-preview.yaml
uv run --with-requirements api/helm/tests/requirements.txt python api/helm/tests/test_ingress.py
```

The render tests cover both environments, default NGINX behavior, parallel
preview routes, TLS Secret reuse and certificate ownership, final cutover,
release-safe Middleware references, the 11 MiB body limit, CORS/HSTS policy,
and invalid migration settings. They do not run Traefik or issue certificates.

## Deploy preview without dropping NGINX

Use the existing `.github/workflows/api-deploy.yml` pipeline, preserving all
its image, environment and secret inputs. Add the preview overlay **after** the
environment values to its lint, template and upgrade commands. Alternatively,
set `ingress.traefik.preview: true` in the selected environment values and use
the unchanged pipeline. Keep that choice in the deployment source while
migrating so a subsequent pipeline run cannot silently remove preview routes.

For an operator-driven upgrade, preserve effective release overrides first;
these contain deployment secrets, so keep the snapshot outside the repo with
private permissions. Example for development, run from the repository root:

```bash
export KUBECONFIG=/Users/paul/.kube/kcoregame
umask 077
API_VALUES_SNAPSHOT=$(mktemp -t api-dev-values)
helm get values api-dev -n development -o yaml > "$API_VALUES_SNAPSHOT"
helm upgrade api-dev api/helm -n development \
  -f "$API_VALUES_SNAPSHOT" -f api/helm/values-traefik-preview.yaml \
  --atomic --wait --timeout 5m
```

For production substitute `api-main`, `production`, and a separate production
snapshot. Do not use a bare `helm upgrade` with only the environment values:
the pipeline also injects the active image tag, database settings and secrets.
Keep the snapshot through the migration; delete it securely according to your
normal secret-handling process afterward. Retake the snapshot after any
pipeline redeployment before another manual upgrade, so the next command does
not restore an older image tag, environment value, or secret.

Preview creates `<release>-traefik-preview` while the original ingress remains
NGINX-owned. The native middleware chain keeps the observed NGINX policy:

- Explicit environment `CORS_ORIGIN`, credentials allowed, the existing method
  and request-header lists, and a 1,728,000-second preflight max age.
- Traefik answers matching CORS preflights and controls the response headers;
  Nest's existing CORS configuration stays unchanged. `Vary: Origin` is added.
- Additional native Traefik annotations (including TLS options) remain intact.
  User-specified middlewares are appended after the required CORS/body-limit
  chain; entrypoints and TLS are fixed to HTTPS for these API routes.
- HSTS remains one year with subdomains, on the HTTPS route.
- Requests over 11 MiB (11,534,336 bytes, including multipart overhead) are
  rejected before forwarding. Bodies above Traefik's default in-memory
  threshold spill to its temporary disk; ensure the controller has writable
  temporary storage. API-level file validation remains in effect.

Test the **new load-balancer IP**, without changing DNS:

```bash
TRAEFIK_IP=<new-load-balancer-ip>
# GET on port 80 checks the redirect status and Location; do not substitute HEAD.
curl --resolve "dev.api.coregame.sh:80:$TRAEFIK_IP" -i \
  http://dev.api.coregame.sh/health
curl --resolve "dev.api.coregame.sh:443:$TRAEFIK_IP" \
  https://dev.api.coregame.sh/health
curl --resolve "dev.api.coregame.sh:443:$TRAEFIK_IP" -i -X OPTIONS \
  https://dev.api.coregame.sh/health \
  -H 'Origin: https://dev.coregame.sh' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,content-type'
```

The controller's native HTTP-to-HTTPS redirect returns **301 for GET** and
**308 for other methods**, whereas NGINX currently returns 308 for GET too.
Traefik's CORS middleware returns **200** for an accepted preflight instead of
NGINX's 204; allow-methods/allow-headers/max-age apply to the preflight rather
than every ordinary response. These differences are browser-compatible, but
are observable and should be checked explicitly. See the infrastructure
[migration guide's HTTP/CORS parity notes](https://github.com/42core-team/terraform/blob/t3/add-traefik-migration/cluster/docs/traefik-migration.md) before cutover.

Check the redirect Location, exact allowed origin, credentials, methods,
headers and HSTS, and repeat the preflight using an untrusted origin: it must
not authorize that origin. Test browser login/cookies, authenticated API calls
and a normal upload.
On the appropriate upload endpoint, confirm an over-11-MiB request returns 413
and a valid smaller upload still works. Do not attach this middleware chain to
cert-manager's plain-HTTP solver Ingresses.

## Cut over and roll back

After testing, move the selected hostname's DNS to Traefik. Keep both ingress
controllers and preview routes serving through the previous DNS TTL/cache
window (observed TTLs: development API CNAME 300s and apex A 60s). Verify real
traffic, certificate issuance/renewal through the selected solver, and browser
flows before removing NGINX ownership.

Set `ingress.className: traefik` and `ingress.traefik.preview: false` in the
environment's deployment source, or layer `values-traefik.yaml` last in the
pipeline. For the operator-driven example:

```bash
helm upgrade api-dev api/helm -n development \
  -f "$API_VALUES_SNAPSHOT" -f api/helm/values-traefik.yaml \
  --atomic --wait --timeout 5m
```

This changes the existing primary ingress to Traefik, retaining its
cert-manager annotations and TLS Secret, and removes the temporary preview
Ingress. NGINX-only and legacy ingress-class annotations are removed from the
native route automatically. Unknown NGINX annotations fail rendering until an
explicit Traefik replacement is added, so authentication/rate-limit policies
cannot be silently dropped. The chart rejects simultaneous final-cutover and
preview flags to avoid duplicate Traefik routes for the same host.

To roll back **after** the primary was changed, first restore primary NGINX
ownership **with the preview overlay**. This keeps Traefik reachable for clients
still using its IP. Explicitly restore the original issuer as well, since a
refreshed snapshot may contain the migration issuer or final class:

```bash
helm upgrade api-dev api/helm -n development \
  -f "$API_VALUES_SNAPSHOT" -f api/helm/values-traefik-preview.yaml \
  --set ingress.className=nginx \
  --set-string 'ingress.annotations.cert-manager\.io/cluster-issuer=letsencrypt-prod' \
  --atomic --wait --timeout 5m
```

Restore DNS to the old load balancer, wait for caches to drain, and only then
repeat the upgrade with `--set ingress.traefik.preview=false` to remove preview.
Keep the explicit NGINX class and original issuer overrides during cleanup.
Restore the deployment source/pipeline settings too. Keep NGINX installed until
every application and certificate solver is migrated.

## References

- [Traefik Ingress annotations](https://doc.traefik.io/traefik/reference/routing-configuration/kubernetes/ingress/)
- [Buffering and request-body limits](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/buffering/)
- [Headers middleware and credentialed CORS](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/headers/)
