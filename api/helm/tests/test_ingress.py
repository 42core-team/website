#!/usr/bin/env python3
"""Render real API charts and check native Traefik routing and request policy.

Run: uv run --with-requirements api/helm/tests/requirements.txt python api/helm/tests/test_ingress.py
"""
import base64
import subprocess
import unittest
from pathlib import Path

import yaml

CHART = Path(__file__).resolve().parents[1]


def render(env="dev", flags=(), release=None):
    release = release or ("api-dev" if env == "dev" else "api-main")
    namespace = "development" if env == "dev" else "production"
    cmd = ["helm", "template", release, str(CHART), "--namespace", namespace,
           "--kube-version", "1.36.5"]
    if env:
        cmd += ["-f", str(CHART / f"values-{env}.yaml")]
    result = subprocess.run(cmd + list(flags), capture_output=True, text=True)
    if result.returncode:
        raise ValueError(result.stderr)
    return [doc for doc in yaml.safe_load_all(result.stdout) if doc]


def resources(docs, kind):
    return [doc for doc in docs if doc["kind"] == kind]


class TraefikIngressTests(unittest.TestCase):
    def test_environment_routes_keep_hosts_services_and_certificate_owners(self):
        for env in ("dev", "prod"):
            with self.subTest(env=env):
                docs = render(env)
                ingress, = resources(docs, "Ingress")
                release = "api-dev" if env == "dev" else "api-main"
                host = "dev.api.coregame.sh" if env == "dev" else "api.coregame.sh"
                secret = "dev-api-coregame-de-tls" if env == "dev" else "api-coregame-de-tls"
                self.assertEqual(ingress["apiVersion"], "networking.k8s.io/v1")
                self.assertEqual(ingress["metadata"]["name"], release)
                self.assertEqual(ingress["spec"]["ingressClassName"], "traefik")
                self.assertEqual(ingress["spec"]["tls"], [{"hosts": [host], "secretName": secret}])
                self.assertEqual(ingress["metadata"]["annotations"]["cert-manager.io/cluster-issuer"], "letsencrypt-prod")
                self.assertFalse(any(k.startswith("nginx.") or k == "kubernetes.io/ingress.class"
                                     for k in ingress["metadata"]["annotations"]))
                self.assertEqual(ingress["spec"]["rules"], [{"host": host, "http": {"paths": [{
                    "path": "/", "pathType": "Prefix", "backend": {"service": {"name": release, "port": {"number": 80}}}
                }]}}])
                self.check_middlewares(docs, ingress, env)

    def check_middlewares(self, docs, ingress, env):
        annotations = ingress["metadata"]["annotations"]
        self.assertEqual(annotations["traefik.ingress.kubernetes.io/router.entrypoints"], "websecure")
        self.assertEqual(annotations["traefik.ingress.kubernetes.io/router.tls"], "true")
        middleware = resources(docs, "Middleware")
        self.assertEqual(len(middleware), 2)
        headers = next(m for m in middleware if "headers" in m["spec"])
        buffer = next(m for m in middleware if "buffering" in m["spec"])
        namespace = "development" if env == "dev" else "production"
        refs = ",".join(f"{namespace}-{m['metadata']['name']}@kubernetescrd" for m in (headers, buffer))
        self.assertEqual(annotations["traefik.ingress.kubernetes.io/router.middlewares"], refs)
        self.assertEqual(buffer["spec"]["buffering"]["maxRequestBodyBytes"], 11 * 1024 * 1024)
        policy = headers["spec"]["headers"]
        self.assertEqual(policy["accessControlAllowOriginList"], ["https://dev.coregame.sh" if env == "dev" else "https://coregame.sh"])
        self.assertTrue(policy["accessControlAllowCredentials"])
        self.assertEqual(policy["accessControlAllowMethods"], ["GET", "PUT", "POST", "DELETE", "PATCH", "OPTIONS"])
        self.assertEqual(policy["accessControlAllowHeaders"], ["DNT", "Keep-Alive", "User-Agent", "X-Requested-With", "If-Modified-Since", "Cache-Control", "Content-Type", "Range", "Authorization"])
        self.assertEqual(policy["accessControlMaxAge"], 1728000)
        self.assertTrue(policy["addVaryHeader"])
        self.assertEqual(policy["stsSeconds"], 31536000)
        self.assertTrue(policy["stsIncludeSubdomains"])

    def test_disabled_ingress_has_no_route_or_middlewares(self):
        docs = render(env=None)
        self.assertEqual(resources(docs, "Ingress"), [])
        self.assertEqual(resources(docs, "Middleware"), [])

    def test_application_resources_keep_pipeline_image_environment_and_secrets(self):
        for env in ("dev", "prod"):
            with self.subTest(env=env):
                release = "api-dev" if env == "dev" else "api-main"
                docs = render(env, flags=("--set-string", "image.repository=ghcr.io/42core-team/website-api",
                                          "--set-string", "image.tag=test-sha", "--set-string", "env.DB_HOST=db.internal",
                                          "--set-string", "secrets.DB_PASSWORD=test-only"))
                service, = resources(docs, "Service")
                deployment, = resources(docs, "Deployment")
                secret, = resources(docs, "Secret")
                self.assertEqual(service["metadata"]["name"], release)
                self.assertEqual(service["spec"]["ports"][0]["port"], 80)
                self.assertEqual(service["spec"]["selector"], deployment["spec"]["selector"]["matchLabels"])
                container, = deployment["spec"]["template"]["spec"]["containers"]
                self.assertEqual(container["image"], "ghcr.io/42core-team/website-api:test-sha")
                self.assertIn({"name": "DB_HOST", "value": "db.internal"}, container["env"])
                self.assertEqual(container["envFrom"], [{"secretRef": {"name": release + "-secrets"}}])
                self.assertEqual(base64.b64decode(secret["data"]["DB_PASSWORD"]).decode(), "test-only")

    def test_additional_native_middleware_and_tls_options_are_preserved(self):
        docs = render(flags=("--set-string", "ingress.annotations.traefik\\.ingress\\.kubernetes\\.io/router\\.middlewares=development-auth@kubernetescrd", "--set-string", "ingress.annotations.traefik\\.ingress\\.kubernetes\\.io/router\\.tls\\.options=development-strict@kubernetescrd"))
        ingress, = resources(docs, "Ingress")
        annotations = ingress["metadata"]["annotations"]
        self.assertTrue(annotations["traefik.ingress.kubernetes.io/router.middlewares"].endswith(",development-auth@kubernetescrd"))
        self.assertEqual(annotations["traefik.ingress.kubernetes.io/router.tls.options"], "development-strict@kubernetescrd")

    def test_required_policy_cannot_be_disabled_by_ingress_annotations(self):
        docs = render(flags=("--set-string", "ingress.annotations.traefik\\.ingress\\.kubernetes\\.io/router\\.entrypoints=web",
                             "--set-string", "ingress.annotations.traefik\\.ingress\\.kubernetes\\.io/router\\.tls=false"))
        ingress, = resources(docs, "Ingress")
        self.check_middlewares(docs, ingress, "dev")

    def test_long_release_names_remain_distinct_and_valid(self):
        names = []
        for release in ("a" * 47 + "one", "a" * 47 + "two"):
            docs = render(release=release)
            objs = resources(docs, "Middleware")
            self.assertTrue(all(len(o["metadata"]["name"]) <= 63 for o in objs))
            ingress, = resources(docs, "Ingress")
            self.check_middlewares(docs, ingress, "dev")
            names.append({o["metadata"]["name"] for o in objs})
        self.assertFalse(names[0] & names[1])

    def test_unsafe_or_incomplete_settings_fail(self):
        for flags in (
            ("--set", "ingress.maxRequestBodyBytes=0"),
            ("--set", "ingress.maxRequestBodyBytes=11534337"),
            ("--set", "ingress.tls=null"),
            ("--set-string", "ingress.tls[0].secretName="),
            ("--set-string", "env.CORS_ORIGIN=*"),
            ("--set-string", "env.CORS_ORIGIN=https://example.com/path"),
            ("--set-string", "ingress.className=other-controller"),
            ("--set-string", "ingress.annotations.kubernetes\\.io/ingress\\.class=nginx"),
            ("--set-string", "ingress.annotations.nginx\\.ingress\\.kubernetes\\.io/auth-type=basic"),
        ):
            with self.subTest(flags=flags), self.assertRaises(ValueError):
                render(flags=flags)


if __name__ == "__main__":
    unittest.main()
