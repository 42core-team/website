# Only allow this Tiltfile to run against the local k3d cluster.
# The kubeconfig is written to the project root by local-setup/dev-setup.sh
# and passed in via KUBECONFIG env var when running 'make dev'.
allow_k8s_contexts('k3d-core-dev')

default_registry('k3d-registry.localhost:5001')

NAMESPACE = 'core-local'

# ── Helpers ───────────────────────────────────────────────────────────────────

# Read .env.tilt for developer-specific secrets (OAuth credentials, etc.)
# Copy .env.tilt.example → .env.tilt and fill in the values.
def load_env(content):
    env = {}
    for line in content.splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, _, v = line.partition('=')
            env[k.strip()] = v.strip()
    return env

_secrets = load_env(str(read_file('.env.tilt', default = '')))

def secret(key, default = ''):
    return _secrets.get(key, default)

# ── Namespace ─────────────────────────────────────────────────────────────────
# local_resource gives a reliable named anchor that other resources can depend on.
# k8s_yaml + k8s_resource(objects=...) is flaky for plain Namespace objects.

local_resource('namespace',
    cmd    = 'kubectl --kubeconfig kubeconfig.yaml apply -f local-setup/infra/namespace.yaml',
    deps   = ['local-setup/infra/namespace.yaml'],
    labels = ['infra'],
)

# ── Persistent volumes ────────────────────────────────────────────────────────
# local_resource prevents Tilt from deleting PVCs during reconciliation.

local_resource('pvcs',
    cmd           = 'kubectl --kubeconfig kubeconfig.yaml apply -f local-setup/infra/pvcs.yaml',
    deps          = ['local-setup/infra/pvcs.yaml'],
    resource_deps = ['namespace'],
    labels        = ['infra'],
)

# ── Databases & messaging ─────────────────────────────────────────────────────

k8s_yaml([
    'local-setup/infra/postgres.yaml',
    'local-setup/infra/rabbitmq.yaml',
])

k8s_resource('postgres',
    port_forwards = ['5432:5432'],
    resource_deps = ['pvcs'],
    labels        = ['infra'],
)
k8s_resource('rabbitmq',
    port_forwards = ['5672:5672', '15672:15672'],
    resource_deps = ['namespace'],
    labels        = ['infra'],
)

# ── Object storage (SeaweedFS) ────────────────────────────────────────────────

k8s_yaml([
    'local-setup/infra/seaweedfs-config.yaml',
    'local-setup/infra/seaweedfs.yaml',
    'local-setup/infra/seaweedfs-init.yaml',
    'local-setup/infra/s3-proxy.yaml',
])

# Attach the s3 credentials ConfigMap to the seaweedfs workload so Tilt
# applies it before the pod starts (and re-applies it on changes).
k8s_resource('seaweedfs',
    port_forwards = [
        '9001:9333',  # Master UI — http://localhost:9001
        '9002:8888',  # Filer UI  — http://localhost:9002
    ],
    objects       = ['seaweedfs-s3-config:ConfigMap:' + NAMESPACE],
    resource_deps = ['pvcs'],
    labels        = ['infra'],
)

# Attach the CORS/policy ConfigMap to the init Job.
k8s_resource('seaweedfs-init',
    objects       = ['seaweedfs-cors-configs:ConfigMap:' + NAMESPACE],
    resource_deps = ['seaweedfs'],
    labels        = ['infra'],
)

# nginx proxy in front of SeaweedFS S3 — adds Access-Control-Allow-Private-Network: true
# so browsers on public HTTPS origins (e.g. the visualizer) can fetch from localhost:9000.
k8s_resource('s3-proxy',
    port_forwards = ['9000:80'],  # S3 API — http://localhost:9000
    objects       = ['s3-proxy-config:ConfigMap:' + NAMESPACE],
    resource_deps = ['seaweedfs'],
    labels        = ['infra'],
)

# ── Backend: API ──────────────────────────────────────────────────────────────

docker_build('api', './api',
    dockerfile = './api/Dockerfile.dev',
    ignore     = ['helm', 'dist', '.env*', '*.md'],
    live_update = [
        sync('./api/src', '/app/src'),
        run(
            'cd /app && pnpm install --frozen-lockfile',
            trigger = ['./api/package.json', './api/pnpm-lock.yaml'],
        ),
    ],
)
k8s_yaml(helm(
    'api/helm',
    name      = 'api',
    namespace = NAMESPACE,
    values    = ['local-setup/local-values/api.yaml'],
    set = [
        'secrets.CLIENT_GITHUB_SECRET=' + secret('CLIENT_GITHUB_SECRET'),
        'secrets.FORTYTWO_CLIENT_SECRET=' + secret('FORTYTWO_CLIENT_SECRET'),
        'env.CLIENT_GITHUB_ID=' + secret('CLIENT_GITHUB_ID'),
        'env.FORTYTWO_CLIENT_ID=' + secret('FORTYTWO_CLIENT_ID'),
    ],
))
k8s_resource('api',
    port_forwards = ['4000:4000'],
    resource_deps = ['postgres', 'rabbitmq'],
    labels        = ['app'],
)

# ── Backend: github-service ───────────────────────────────────────────────────

docker_build('github-service', './github-service',
    dockerfile = './github-service/Dockerfile.dev',
    ignore     = ['helm', 'dist', '.env*', '*.md'],
    live_update = [
        sync('./github-service/src', '/app/src'),
        run(
            'cd /app && pnpm install --frozen-lockfile',
            trigger = ['./github-service/package.json', './github-service/pnpm-lock.yaml'],
        ),
    ],
)
k8s_yaml(helm(
    'github-service/helm',
    name      = 'github-service',
    namespace = NAMESPACE,
    values    = ['local-setup/local-values/github-service.yaml'],
))
k8s_resource('github-service',
    resource_deps = ['rabbitmq'],
    labels        = ['app'],
)

# ── Backend: k8s-service ──────────────────────────────────────────────────────
# Full Docker rebuild on any change — Go build cache keeps it fast.

docker_build('k8s-service', './k8s-service',
    dockerfile = './k8s-service/Dockerfile',
)
k8s_yaml(helm(
    'k8s-service/helm',
    name      = 'k8s-service',
    namespace = NAMESPACE,
    values    = ['local-setup/local-values/k8s-service.yaml'],
))
k8s_resource('k8s-service',
    resource_deps = ['rabbitmq', 'seaweedfs-init'],
    labels        = ['app'],
)

# ── Frontend ──────────────────────────────────────────────────────────────────

docker_build('frontend', './frontend',
    dockerfile = './frontend/Dockerfile.dev',
    ignore     = ['helm', '.next', '.env*', '*.md', 'content'],
    live_update = [
        sync('./frontend/app',        '/app/app'),
        sync('./frontend/components', '/app/components'),
        sync('./frontend/hooks',      '/app/hooks'),
        sync('./frontend/layouts',    '/app/layouts'),
        sync('./frontend/lib',        '/app/lib'),
        sync('./frontend/styles',     '/app/styles'),
        sync('./frontend/types',      '/app/types'),
        sync('./frontend/contexts',   '/app/contexts'),
        sync('./frontend/config',     '/app/config'),
        sync('./frontend/public',     '/app/public'),
        run(
            'cd /app && pnpm install --frozen-lockfile',
            trigger = ['./frontend/package.json', './frontend/pnpm-lock.yaml'],
        ),
    ],
)
k8s_yaml(helm(
    'frontend/helm',
    name      = 'frontend',
    namespace = NAMESPACE,
    values    = ['local-setup/local-values/frontend.yaml'],
    set = [
        'env.CLIENT_GITHUB_ID=' + secret('CLIENT_GITHUB_ID'),
    ],
))
k8s_resource('frontend',
    port_forwards = ['3000:3000'],
    resource_deps = ['api'],
    labels        = ['app'],
)
