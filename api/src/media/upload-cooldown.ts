import { HttpException, HttpStatus } from "@nestjs/common";

export const UPLOAD_COOLDOWN_MS = 10_000;

/** Shorter cooldown after a failed upload, so retries cannot monopolise processing. */
export const UPLOAD_FAILURE_COOLDOWN_MS = 2_000;

const blockedUntil = new Map<string, number>();

function prune(now: number) {
  for (const [other, until] of blockedUntil)
    if (now >= until) blockedUntil.delete(other);
}

/** Throws 429 while an upload for this key is inside its window. */
export function assertUploadSlotFree(key: string, now = Date.now()) {
  prune(now);
  const until = blockedUntil.get(key);
  if (until !== undefined && now < until)
    throw new HttpException(
      `Please wait ${Math.ceil((until - now) / 1000)} seconds before uploading another image.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
}

/** Starts the cooldown; call only after an upload has fully succeeded. */
export function recordUpload(key: string, now = Date.now()) {
  blockedUntil.set(key, now + UPLOAD_COOLDOWN_MS);
}

/** Starts the short cooldown after a processing or storage failure; never shortens a longer window. */
export function recordUploadFailure(key: string, now = Date.now()) {
  const until = now + UPLOAD_FAILURE_COOLDOWN_MS;
  blockedUntil.set(key, Math.max(blockedUntil.get(key) ?? 0, until));
}

/** Test hook: forget all cooldowns. */
export function resetUploadCooldowns() {
  blockedUntil.clear();
}
