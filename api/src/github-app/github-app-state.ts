import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_TTL_MS = 30 * 60 * 1000;

export interface GithubInstallState {
  eventId: string;
  userId: string;
}

/**
 * The `state` passed through the App installation, so the setup callback
 * knows which event to connect and can check that the same user finishes it.
 * Signed with a key derived for this purpose only, so it cannot be mistaken
 * for a session token.
 */
export class GithubInstallStateSigner {
  private readonly key: Buffer;

  constructor(
    secret: string,
    private readonly now: () => number = Date.now,
  ) {
    this.key = createHmac("sha256", secret)
      .update("github-app-install-state")
      .digest();
  }

  sign(state: GithubInstallState): string {
    const payload = Buffer.from(
      JSON.stringify({
        e: state.eventId,
        u: state.userId,
        x: this.now() + STATE_TTL_MS,
        n: randomBytes(12).toString("base64url"),
      }),
    ).toString("base64url");
    return `${payload}.${this.mac(payload)}`;
  }

  /** The state, or null if it was tampered with or has expired. */
  verify(value: string): GithubInstallState | null {
    const [payload, mac, ...rest] = value.split(".");
    if (!payload || !mac || rest.length) return null;
    const expected = Buffer.from(this.mac(payload));
    const actual = Buffer.from(mac);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return null;
    try {
      const { e, u, x } = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      ) as { e?: unknown; u?: unknown; x?: unknown };
      if (typeof e !== "string" || typeof u !== "string") return null;
      if (typeof x !== "number" || x < this.now()) return null;
      return { eventId: e, userId: u };
    } catch {
      return null;
    }
  }

  private mac(payload: string) {
    return createHmac("sha256", this.key).update(payload).digest("base64url");
  }
}

/** Checks GitHub's `X-Hub-Signature-256` header against the raw request body. */
export function isValidWebhookSignature(
  secret: string,
  body: Buffer,
  header: string | undefined,
): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(
    `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
  );
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
