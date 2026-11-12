# API ingress

Development and production use the native Traefik IngressClass `traefik`.
The chart renders one HTTPS Ingress and two release-scoped Middlewares for each
enabled API ingress. The infrastructure must provide Traefik with Kubernetes
Ingress and CRD providers, the `Middleware` CRD, HTTPS entrypoint `websecure`,
and the shared `letsencrypt-prod` issuer using Traefik's HTTP-01 solver.

| Environment | Namespace | Helm release | Host | TLS Secret |
| --- | --- | --- | --- | --- |
| Development | development | api-dev | dev.api.coregame.sh | dev-api-coregame-de-tls |
| Production | production | api-main | api.coregame.sh | api-coregame-de-tls |

The existing ingress keeps ownership of its cert-manager Certificate and TLS
Secret. Backend Services and ports remain unchanged. DNS is managed outside
Terraform; the app hostnames must resolve to Traefik's load balancer.

## Request policy

- Requests use HTTPS on `websecure`. The infrastructure redirects port 80 to
  HTTPS while allowing cert-manager HTTP-01 challenges through.
- Native HTTP-to-HTTPS redirection returns **301 for GET and 308 for other
  methods**; the previous controller returned 308 for GET too.
- Credentialed CORS allows only the explicit environment `CORS_ORIGIN`, with
  the existing method/header lists and 1,728,000-second preflight max age.
  Traefik answers valid preflight requests with **200**, rather than the former
  204. Allow-methods/allow-headers/max-age apply to preflights rather than every
  ordinary response. Nest's existing CORS configuration remains unchanged.
- HSTS remains one year with subdomains; `Vary: Origin` is enabled.
- Buffering rejects complete request bodies larger than **11 MiB**
  (11,534,336 bytes including multipart overhead) with 413. API file validation
  is unchanged. Traefik requires writable temporary storage for buffered data.
- Additional native annotations, including TLS options, are retained. Custom
  middlewares run after the required CORS and body-limit chain. TLS and the
  entrypoint remain fixed to HTTPS. Unsupported controller annotations fail
  rendering instead of being silently ignored.

## Validate and deploy

From the repository root:

```bash
helm lint api/helm -f api/helm/values-dev.yaml
helm lint api/helm -f api/helm/values-prod.yaml
helm template api-dev api/helm -n development -f api/helm/values-dev.yaml
uv run --with-requirements api/helm/tests/requirements.txt python api/helm/tests/test_ingress.py
```

Deploy through `.github/workflows/api-deploy.yml`, retaining all its current
image tags, runtime environment and secret inputs. The environment values
select Traefik directly. Infrastructure and DNS must be ready when these
values are deployed. Coordinate the direct deployment with the
[infrastructure configuration](https://github.com/42core-team/terraform/blob/main/cluster/docs/traefik.md).
Render tests do not replace runtime checks:

```bash
TRAEFIK_IP=<load-balancer-ip>
# GET, rather than HEAD, checks the redirect status and Location.
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

Check the redirect Location, valid certificate, explicit allowed origin,
credentials, methods, headers and HSTS. Repeat preflight with an untrusted
origin and ensure it is not authorized. Check browser login/cookies,
authenticated API requests, a valid upload, and an over-11-MiB upload returning
413 on the upload endpoint. Verify certificate issuance and renewal through
the shared issuer. The API middleware chain must not be attached to
cert-manager's plain-HTTP solver Ingresses.

## References

- [Traefik Ingress annotations](https://doc.traefik.io/traefik/reference/routing-configuration/kubernetes/ingress/)
- [Buffering and request-body limits](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/buffering/)
- [Headers middleware and credentialed CORS](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/headers/)
