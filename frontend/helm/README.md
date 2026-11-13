# Frontend Helm chart

Deploys the CORE frontend Service, application workload and Traefik HTTPS routes.
Development uses `frontend-dev` in `development`; production uses `frontend-main`
in `production`. Application configuration, image and secret arguments are
supplied by the existing `.github/workflows/frontend-deploy.yml` workflow.

## Prerequisites

- Kubernetes 1.19 or newer, Helm 3, and registry access for the application image.
- Traefik with the `traefik` IngressClass, `websecure` entrypoint and Kubernetes
  Ingress/CRD providers enabled; the `Middleware` CRD must be installed.
- HTTP-to-HTTPS redirection configured on Traefik, with HTTP-01 challenge routes
  allowed to take precedence.
- cert-manager and the Ready `letsencrypt-prod` ClusterIssuer configured to solve
  HTTP-01 challenges through Traefik.

## HTTPS routes

Both environment values files select `ingress.className: traefik` and annotate the
route for `websecure` with TLS enabled. Hostnames, frontend Service port **3000**,
and existing certificate Secret names stay unchanged:

| Environment | Host | TLS Secret |
| --- | --- | --- |
| Development | `dev.coregame.sh` | `dev-coregame-de-tls` |
| Production | `coregame.sh` | `coregame-de-tls` |
| Production redirect | `www.coregame.sh` | `www-coregame-de-tls` |

The chart retains cert-manager ownership through the original Ingress names.
Enabled routes require TLS Secret references. The base values file disables
public ingress until environment values are supplied.

## Production www redirect

`ingressRedirect` creates an HTTPS Ingress and release-scoped RedirectRegex
Middleware in the same namespace. It redirects to exactly `https://coregame.sh`,
discarding the original path and query. Its regex is anchored and escapes the
source hostname. Additional explicitly configured middlewares run after the
redirect middleware.

The accepted native permanent-redirect behavior in Traefik v3.7.17 is **301 for
GET** and **308 for other methods**, including HEAD. There is no configurable
redirect status code in this chart. See the version-pinned
[redirect implementation](https://github.com/traefik/traefik/blob/v3.7.17/pkg/middlewares/redirect/redirect.go).

## Asset archive

Browsers that loaded an older `index.html` keep requesting that release's hashed
`/assets/*` chunks after a rollout. nginx serves `/assets/*` from the image and,
on a miss, proxies to the STACKIT Object Storage bucket in `env.ASSETS_ARCHIVE_URL`
(`frontend/assets-archive.sh` writes that config at container start). Bucket
403/404 responses become a plain 404. An empty URL turns the fallback off.

Before `helm upgrade`, the deploy workflow uploads the assets of every image the
running pods serve, plus the new image, to `s3://<bucket>/assets/`, then passes
the bucket URL to the chart. It never deletes objects. It needs these settings in
the GitHub environment:

| Name | Kind | Value |
| --- | --- | --- |
| `FRONTEND_ASSETS_S3_ENDPOINT` | variable | `https://object.storage.eu01.onstackit.cloud` |
| `FRONTEND_ASSETS_S3_BUCKET` | variable | `coregame-frontend-assets-dev` / `-prod` |
| `FRONTEND_ASSETS_S3_ACCESS_KEY_ID` | secret | uploader key from Terraform |
| `FRONTEND_ASSETS_S3_SECRET_ACCESS_KEY` | secret | uploader key from Terraform |

Without the variables the workflow warns and deploys with the fallback off. The
buckets, the anonymous read-only policy on `assets/*` and the 90-day expiry rule
live in the `terraform` repository (`infrastucture/modules/assets-bucket`). Every
deploy re-uploads the assets in use, which restarts their expiry clock.

Pods only get the fallback from an image that includes it. During the first
rollout to such an image, a pod without it can still answer a chunk request with
404 until that rollout finishes. After a rollback to an image without the
fallback, tabs opened on a newer release keep getting 404s for chunks they have
not loaded yet, until they reload or an image with the fallback is deployed.

## Deploy and verify

Run the existing frontend deployment workflow for the desired branch/environment.
It selects `values-dev.yaml` or `values-prod.yaml` and retains the required image,
environment and secret arguments. The platform Traefik deployment, DNS target and
shared issuer solver must be configured for the direct cutover. This chart does
not install the ingress controller or manage DNS.

From the website repository root:

```bash
helm lint ./frontend/helm --values ./frontend/helm/values-dev.yaml
helm lint ./frontend/helm --values ./frontend/helm/values-prod.yaml
ruby ./frontend/helm/tests/ingress_test.rb

kubectl get ingress,certificate -n development
kubectl get ingress,certificate -n production
curl -I https://dev.coregame.sh/
curl -I https://coregame.sh/
curl -sS -D - -o /dev/null 'https://www.coregame.sh/a/path?test=1'
bash ./frontend/scripts/test-assets-archive.sh
curl -I https://dev.coregame.sh/assets/<chunk-of-an-older-release>.js
```

The `www.coregame.sh` request uses GET: expect **301** and `Location: https://coregame.sh`,
without the original path or query. `curl -I` uses HEAD and reports 308 instead.
The asset archive smoke test needs Docker. The chunk from an older release
should return **200** from the bucket; an unknown chunk name returns **404**.
Validate browser login, OAuth callbacks, cookies and normal navigation. Do not
bypass TLS verification. Render checks verify resource configuration; live
routing and certificate issuance require the configured cluster and DNS.
