import { BadRequestException, Logger } from "@nestjs/common";

const ACCEPT = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(",");

const logger = new Logger("assertImageExists");

const TIMEOUT_MS = 5000;

/**
 * Rejects an image reference whose tag does not exist in the registry.
 *
 * The bot, server and visualizer images live in separate ghcr packages with
 * independent version series, so a tag that is valid for one is often absent
 * from another. Storing an unresolvable reference breaks every user's
 * devcontainer at pull time, far away from where the value was entered.
 */
// ponytail: ghcr public packages only; other registries, digest refs and
// private packages pass unchecked. Extend when one of those is configured.
export async function assertImageExists(ref?: string): Promise<void> {
  const match = /^ghcr\.io\/([a-z0-9._/-]+):([\w.-]+)$/.exec(ref ?? "");
  if (!match) return;
  const [, repo, tag] = match;

  let res: { ok: boolean; status: number };
  try {
    const { token } = (await fetch(
      `https://ghcr.io/token?scope=repository:${repo}:pull&service=ghcr.io`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    ).then((r) => r.json())) as { token?: string };

    res = await fetch(`https://ghcr.io/v2/${repo}/manifests/${tag}`, {
      method: "HEAD",
      headers: { Authorization: `Bearer ${token ?? ""}`, Accept: ACCEPT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    // ponytail: fail open on registry/network errors — this check guards
    // against typos, a ghcr outage must not block event administration.
    logger.warn(`Skipping image check for ${ref}: ${err}`);
    return;
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) return;
    throw new BadRequestException(
      `Image not found in registry: ${ref} (registry returned ${res.status})`,
    );
  }
}
