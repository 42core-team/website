# 0004 – Zero-downtime rollouts

- Status: Accepted
- Date: 2026-11-07

## Context

The Deployments already roll one pod at a time and never drop below the desired
count. Pods can still be healthy and give a visitor a broken page, because a
rollout briefly runs two releases behind one hostname:

- The frontend is a static SPA with content-hashed assets, and each image only
  contains its own. The shell from one release can request assets from a pod of
  the other release and get a 404. Tabs opened before a rollout hit the same 404
  once the old pods are gone.
- `index.html` had no `Cache-Control`, so browsers could reuse a stale shell
  after the assets it points to had disappeared.

## Decision

**Frontend assets**

- Each image carries the assets of the previous image for its branch, dropping
  files 14 days after they were built. New pods can serve every recent release.
  The build pins the previous image by digest and fails if the registry can't
  say whether it exists, so a registry outage can't silently drop the assets.
- A 404 is retried on another pod. This covers a new shell requesting its assets
  from a pod still on the old release. Only `/assets/` can return a 404, because
  all other paths fall back to the shell.
- A session cookie (`core_route`) keeps a visitor on one pod, so the shell and
  its assets usually come from the same release. This is an optimisation that
  makes those retries rarer, not a guarantee: pods go away and scaling moves
  some sessions.
- `index.html` is sent with `Cache-Control: no-cache`.
- After the 14 days, TanStack Router reloads a tab whose route chunk is missing.

**All request-serving pods**

- `preStop` sleeps 10s, to give the ingress time to stop routing to a pod before
  it gets SIGTERM. This is a time budget, not a guarantee.
- A PodDisruptionBudget and best-effort topology spread keep a node drain from
  taking out every replica. This needs at least two replicas: a single-replica
  deployment, such as dev, can still be fully evicted.

## Alternatives

- **Upload assets to shared object storage before the rollout.** This is the
  cleaner long-term option, and it also solves rollbacks. It needs a bucket,
  credentials and a deploy step, which this problem doesn't justify yet.
- **Retries without carried-over assets.** Once the old pods are gone, no pod has
  the old assets, so tabs opened before the rollout would still break.

**Queue consumers (API and github-service)**

- Messages are acknowledged after their handler finishes, so a message whose pod
  dies is redelivered rather than lost. Delivery is therefore at-least-once.
- On SIGTERM a pod stops consuming and waits for running handlers, up to 30s for
  the API and 100s for github-service, before closing.

**Deploys**

- A new push cancels lint and build jobs, but not a running deploy, so `helm
  upgrade` can't be stopped midway.

## Rules for changes

Old and new releases run side by side during a rollout, and migrations run
before the old API pods stop. Every release must therefore work with its
neighbours:

- **Migrations are expand/contract.** Don't drop or rename a column or table that
  the running release still uses. Add the new shape, ship code that uses it, and
  remove the old shape in a later release. `api/scripts/check-migrations.mjs`
  fails CI on destructive statements in new migrations. A release that really is
  safe can say why with a `zero-downtime:` comment in the migration.
- **API changes stay backward compatible.** The frontend and API deploy
  independently, so neither can rely on the other having rolled out first.
- **Queue handlers must tolerate running twice** for the same message.

## Consequences

- Images grow by up to 14 days of changed assets. A test build that changed 28
  files added about 2.6 MB uncompressed, so at three deploys a day (about 42
  builds) the assets would add roughly 110 MB in that worst case.
- Rolling back to an older image loses the assets of newer releases. Tabs opened
  on the newer release then rely on the router's reload.
- The 14-day clock starts when an asset was built, and the first build on a branch
  has nothing to carry over.
