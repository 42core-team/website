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
```

The last command uses GET: expect **301** and `Location: https://coregame.sh`,
without the original path or query. `curl -I` uses HEAD and reports 308 instead.
Validate browser login, OAuth callbacks, cookies and normal navigation. Do not
bypass TLS verification. Render checks verify resource configuration; live
routing and certificate issuance require the configured cluster and DNS.
