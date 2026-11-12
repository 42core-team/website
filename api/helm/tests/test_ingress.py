#!/usr/bin/env python3
"""Render real chart combinations and check migration traffic/certificate contracts.

Run: uv run --with-requirements api/helm/tests/requirements.txt python api/helm/tests/test_ingress.py
"""
import subprocess
import unittest
from pathlib import Path

import yaml

CHART = Path(__file__).resolve().parents[1]


def render(env="dev", overlay=None, flags=(), release=None):
    release = release or ("api-dev" if env == "dev" else "api-main")
    namespace = "development" if env == "dev" else "production"
    cmd = ["helm", "template", release, str(CHART), "--namespace", namespace,
           "--kube-version", "1.36.5", "-f", str(CHART / f"values-{env}.yaml")]
    if overlay:
        cmd += ["-f", str(CHART / f"values-{overlay}.yaml")]
    result = subprocess.run(cmd + list(flags), capture_output=True, text=True)
    if result.returncode:
        raise ValueError(result.stderr)
    return [doc for doc in yaml.safe_load_all(result.stdout) if doc]


def resources(docs, kind):
    return [doc for doc in docs if doc["kind"] == kind]


class IngressMigrationTests(unittest.TestCase):
    def test_defaults_keep_nginx_without_traefik_resources(self):
        for env in ("dev", "prod"):
            with self.subTest(env=env):
                docs = render(env)
                self.assertEqual(resources(docs, "Middleware"), [])
                ingress, = resources(docs, "Ingress")
                self.assertEqual(ingress["spec"]["ingressClassName"], "nginx")
                self.assertEqual(ingress["metadata"]["annotations"]["nginx.ingress.kubernetes.io/proxy-body-size"], "11m")
                self.assertEqual(ingress["metadata"]["annotations"]["cert-manager.io/cluster-issuer"], "letsencrypt-prod")

    def test_preview_reuses_backends_and_secrets_without_certificate_ownership(self):
        for env in ("dev", "prod"):
            with self.subTest(env=env):
                docs = render(env, "traefik-preview")
                ingresses = resources(docs, "Ingress")
                self.assertEqual(len(ingresses), 2)
                primary = next(i for i in ingresses if i["spec"]["ingressClassName"] == "nginx")
                preview = next(i for i in ingresses if i["spec"]["ingressClassName"] == "traefik")
                self.assertNotEqual(primary["metadata"]["name"], preview["metadata"]["name"])
                for field in ("rules", "tls"):
                    self.assertEqual(primary["spec"][field], preview["spec"][field])
                self.assertFalse(any("cert-manager.io/" in k or "nginx.ingress" in k or k == "kubernetes.io/ingress.class"
                                     for k in preview["metadata"]["annotations"]))
                self.check_middlewares(docs, preview, env)

    def test_final_primary_keeps_certificate_ownership_and_uses_native_annotations(self):
        for env in ("dev", "prod"):
            with self.subTest(env=env):
                docs = render(env, "traefik")
                ingress, = resources(docs, "Ingress")
                self.assertEqual(ingress["spec"]["ingressClassName"], "traefik")
                annotations = ingress["metadata"]["annotations"]
                self.assertEqual(annotations["cert-manager.io/cluster-issuer"], "letsencrypt-prod")
                self.assertFalse(any(k.startswith("nginx.") or k == "kubernetes.io/ingress.class" for k in annotations))
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

    def test_preview_excludes_all_issuer_and_legacy_annotations(self):
        docs = render(overlay="traefik-preview", flags=("--set-string", "ingress.annotations.kubernetes\\.io/ingress\\.class=nginx", "--set-string", "ingress.annotations.acme\\.cert-manager\\.io/http01-ingress-class=nginx"))
        preview = next(i for i in resources(docs, "Ingress") if i["spec"]["ingressClassName"] == "traefik")
        self.assertFalse(any("cert-manager.io/" in k or k == "kubernetes.io/ingress.class" for k in preview["metadata"]["annotations"]))

    def test_traefik_issuer_override_stays_on_original_certificate_owner(self):
        for overlay in ("traefik-preview", "traefik"):
            with self.subTest(overlay=overlay):
                docs = render(overlay=overlay, flags=("--set-string", "ingress.annotations.cert-manager\\.io/cluster-issuer=letsencrypt-traefik"))
                ingresses = resources(docs, "Ingress")
                owners = [i for i in ingresses if "cert-manager.io/cluster-issuer" in i["metadata"]["annotations"]]
                self.assertEqual(len(owners), 1)
                self.assertEqual(owners[0]["metadata"]["name"], "api-dev")
                self.assertEqual(owners[0]["metadata"]["annotations"]["cert-manager.io/cluster-issuer"], "letsencrypt-traefik")
                self.assertEqual(owners[0]["spec"]["tls"][0]["secretName"], "dev-api-coregame-de-tls")

    def test_preview_cannot_send_primary_route_to_traefik_via_legacy_annotation(self):
        flags = ("--set-string", "ingress.annotations.kubernetes\\.io/ingress\\.class=traefik")
        with self.assertRaisesRegex(ValueError, "conflicting legacy annotation"):
            render(overlay="traefik-preview", flags=flags)
        # Preserve legacy compatibility when migration is not enabled.
        default, = resources(render(flags=flags), "Ingress")
        self.assertEqual(default["metadata"]["annotations"]["kubernetes.io/ingress.class"], "traefik")
        final, = resources(render(overlay="traefik", flags=("--set-string", "ingress.annotations.kubernetes\\.io/ingress\\.class=nginx")), "Ingress")
        self.assertNotIn("kubernetes.io/ingress.class", final["metadata"]["annotations"])
        self.check_middlewares(render(overlay="traefik"), final, "dev")

    def test_preview_does_not_publish_external_dns_records(self):
        keys = ("external-dns.alpha.kubernetes.io/hostname", "external-dns.kubernetes.io/target")
        flags = ("--set-string", "ingress.annotations.external-dns\\.alpha\\.kubernetes\\.io/hostname=dev.api.coregame.sh",
                 "--set-string", "ingress.annotations.external-dns\\.kubernetes\\.io/target=188.34.94.183")
        docs = render(overlay="traefik-preview", flags=flags)
        original = next(i for i in resources(docs, "Ingress") if i["metadata"]["name"] == "api-dev")
        preview = next(i for i in resources(docs, "Ingress") if i["spec"]["ingressClassName"] == "traefik")
        self.assertTrue(all(key in original["metadata"]["annotations"] for key in keys))
        self.assertTrue(all(key not in preview["metadata"]["annotations"] for key in keys))
        final, = resources(render(overlay="traefik", flags=flags), "Ingress")
        self.assertTrue(all(key in final["metadata"]["annotations"] for key in keys))

    def test_additional_native_middleware_and_tls_options_are_preserved(self):
        docs = render(overlay="traefik-preview", flags=("--set-string", "ingress.annotations.traefik\\.ingress\\.kubernetes\\.io/router\\.middlewares=development-auth@kubernetescrd", "--set-string", "ingress.annotations.traefik\\.ingress\\.kubernetes\\.io/router\\.tls\\.options=development-strict@kubernetescrd"))
        preview = next(i for i in resources(docs, "Ingress") if i["spec"]["ingressClassName"] == "traefik")
        annotations = preview["metadata"]["annotations"]
        self.assertTrue(annotations["traefik.ingress.kubernetes.io/router.middlewares"].endswith(",development-auth@kubernetescrd"))
        self.assertEqual(annotations["traefik.ingress.kubernetes.io/router.tls.options"], "development-strict@kubernetescrd")

    def test_long_release_names_remain_distinct_and_valid(self):
        names = []
        for release in ("a" * 47 + "one", "a" * 47 + "two"):
            docs = render(overlay="traefik-preview", release=release)
            objs = resources(docs, "Middleware") + [i for i in resources(docs, "Ingress") if i["spec"]["ingressClassName"] == "traefik"]
            self.assertTrue(all(len(o["metadata"]["name"]) <= 63 for o in objs))
            names.append({o["metadata"]["name"] for o in objs})
        self.assertFalse(names[0] & names[1])

    def test_unsafe_or_incomplete_settings_fail(self):
        for flags in (
            ("--set", "ingress.traefik.maxRequestBodyBytes=0"),
            ("--set", "ingress.traefik.maxRequestBodyBytes=11534337"),
            ("--set", "ingress.enabled=false"),
            ("--set", "ingress.tls=null"),
            ("--set-string", "env.CORS_ORIGIN=*"),
            ("--set-string", "env.CORS_ORIGIN=https://example.com/path"),
            ("--set", "ingress.className=traefik"),
            ("--set-string", "ingress.annotations.nginx\\.ingress\\.kubernetes\\.io/auth-type=basic"),
        ):
            with self.subTest(flags=flags), self.assertRaises(ValueError):
                render(overlay="traefik-preview", flags=flags)


if __name__ == "__main__":
    unittest.main()
