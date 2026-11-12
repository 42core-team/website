// This file is duplicated in api/src/github-api/github-app-auth.ts and
// github-service/src/github-app-auth.ts. Keep both copies (and their specs) identical.
import { createPrivateKey, createSign, KeyObject } from "node:crypto";

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
/** GitHub rejects App JWTs that expire more than 10 minutes after they were issued. */
const JWT_LIFETIME_SECONDS = 9 * 60;
/** Backdate `iat` so a server clock slightly ahead of GitHub's is still accepted. */
const JWT_CLOCK_SKEW_SECONDS = 60;
const JWT_REFRESH_MARGIN_MS = 60 * 1000;
/** Installation tokens live for an hour; renew well before a caller could hold an expired one. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export type GithubAppPermissionLevel = "read" | "write" | "admin";

export interface GithubAppInstallation {
  id: number;
  account: { id: number; login: string; type: string } | null;
  repository_selection: "all" | "selected";
  permissions: Record<string, string>;
  suspended_at: string | null;
}

export interface GithubAppScopedTokenOptions {
  /** Repository names (without owner) the token may access. */
  repositories?: string[];
  permissions?: Record<string, GithubAppPermissionLevel>;
}

export interface GithubAppToken {
  token: string;
  expiresAt: Date;
}

export interface GithubAppAuthOptions {
  appId?: string;
  /** PEM, or the PEM base64-encoded on a single line. */
  privateKey?: string;
  fetch?: typeof fetch;
  now?: () => number;
  baseUrl?: string;
}

export class GithubAppNotConfiguredError extends Error {
  constructor() {
    super("The GitHub App is not configured.");
    this.name = "GithubAppNotConfiguredError";
  }
}

export class GithubAppRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GithubAppRequestError";
  }
}

/** Parses GITHUB_APP_PRIVATE_KEY, which may be a raw PEM or a single-line base64 PEM. */
export function parseGithubAppPrivateKey(value: string): KeyObject {
  const trimmed = value.trim();
  const pem = trimmed.includes("-----BEGIN")
    ? trimmed.replace(/\\n/g, "\n")
    : Buffer.from(trimmed, "base64").toString("utf8");
  if (!pem.includes("-----BEGIN"))
    throw new Error("GITHUB_APP_PRIVATE_KEY is not a PEM private key.");
  const key = createPrivateKey(pem);
  if (key.asymmetricKeyType !== "rsa")
    throw new Error("GITHUB_APP_PRIVATE_KEY must be an RSA private key.");
  return key;
}

/**
 * Authenticates as the CORE GitHub App and mints installation access tokens.
 * Disabled when no App is configured, so the per-event token path keeps working.
 */
export class GithubAppAuth {
  private readonly appId: string | null;
  private readonly privateKey: KeyObject | null;
  private readonly fetch: typeof fetch;
  private readonly now: () => number;
  private readonly baseUrl: string;
  private jwt: { value: string; expiresAt: number } | null = null;
  private readonly installationTokens = new Map<
    number,
    Promise<GithubAppToken>
  >();

  constructor(options: GithubAppAuthOptions = {}) {
    const appId = options.appId?.trim() || null;
    const privateKey = options.privateKey?.trim() || null;
    if (Boolean(appId) !== Boolean(privateKey))
      throw new Error(
        "GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set together.",
      );
    this.appId = appId;
    this.privateKey = privateKey ? parseGithubAppPrivateKey(privateKey) : null;
    this.fetch = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
    this.baseUrl = options.baseUrl ?? GITHUB_API_URL;
  }

  static fromConfig(get: (key: string) => string | undefined): GithubAppAuth {
    return new GithubAppAuth({
      appId: get("GITHUB_APP_ID"),
      privateKey: get("GITHUB_APP_PRIVATE_KEY"),
    });
  }

  isEnabled(): boolean {
    return this.appId !== null && this.privateKey !== null;
  }

  /**
   * An installation-wide token. Cached until shortly before it expires;
   * concurrent callers share one request.
   */
  async getInstallationToken(installationId: number): Promise<string> {
    assertInstallationId(installationId);
    const cached = this.installationTokens.get(installationId);
    if (cached) {
      const token = await cached.catch(() => null);
      if (token && this.isFresh(token)) return token.token;
      // Only drop the entry that was checked; a concurrent caller may have replaced it.
      if (this.installationTokens.get(installationId) === cached)
        this.installationTokens.delete(installationId);
    }
    let pending = this.installationTokens.get(installationId);
    if (!pending) {
      const request = this.requestToken(installationId, {});
      pending = request;
      this.installationTokens.set(installationId, request);
      request.catch(() => {
        if (this.installationTokens.get(installationId) === request)
          this.installationTokens.delete(installationId);
      });
    }
    return (await pending).token;
  }

  /** Drops a cached installation token, e.g. after GitHub rejected it. */
  invalidateInstallationToken(installationId: number): void {
    this.installationTokens.delete(installationId);
  }

  /** A token limited to the given repositories and/or permissions. Never cached. */
  async createScopedToken(
    installationId: number,
    options: GithubAppScopedTokenOptions,
  ): Promise<GithubAppToken> {
    assertInstallationId(installationId);
    if (!options.repositories?.length && !options.permissions)
      throw new Error(
        "A scoped token needs repositories or permissions; use getInstallationToken otherwise.",
      );
    return this.requestToken(installationId, options);
  }

  async getInstallation(
    installationId: number,
  ): Promise<GithubAppInstallation> {
    assertInstallationId(installationId);
    return this.request<GithubAppInstallation>(
      "GET",
      `/app/installations/${installationId}`,
    );
  }

  private isFresh(token: GithubAppToken): boolean {
    return token.expiresAt.getTime() - this.now() > TOKEN_REFRESH_MARGIN_MS;
  }

  private async requestToken(
    installationId: number,
    options: GithubAppScopedTokenOptions,
  ): Promise<GithubAppToken> {
    const body: Record<string, unknown> = {};
    if (options.repositories?.length) body.repositories = options.repositories;
    if (options.permissions) body.permissions = options.permissions;
    const response = await this.request<{ token: string; expires_at: string }>(
      "POST",
      `/app/installations/${installationId}/access_tokens`,
      body,
    );
    return { token: response.token, expiresAt: new Date(response.expires_at) };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.getAppJwt()}`,
        "User-Agent": "CORE-GitHub-App",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      // A rejected JWT may come from clock drift; sign a fresh one next time.
      if (response.status === 401) this.jwt = null;
      const detail = await readErrorMessage(response);
      throw new GithubAppRequestError(
        response.status,
        `GitHub App request ${method} ${path} failed with ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }
    return (await response.json()) as T;
  }

  private getAppJwt(): string {
    if (!this.appId || !this.privateKey)
      throw new GithubAppNotConfiguredError();
    const now = this.now();
    if (this.jwt && this.jwt.expiresAt - now > JWT_REFRESH_MARGIN_MS)
      return this.jwt.value;
    const nowSeconds = Math.floor(now / 1000);
    const issuedAt = nowSeconds - JWT_CLOCK_SKEW_SECONDS;
    const expiresAt = nowSeconds + JWT_LIFETIME_SECONDS;
    const header = encodeSegment({ alg: "RS256", typ: "JWT" });
    const payload = encodeSegment({
      iat: issuedAt,
      exp: expiresAt,
      // GitHub accepts the numeric App ID or the App's client ID.
      iss: /^\d+$/.test(this.appId) ? Number(this.appId) : this.appId,
    });
    const signature = createSign("RSA-SHA256")
      .update(`${header}.${payload}`)
      .sign(this.privateKey)
      .toString("base64url");
    const value = `${header}.${payload}.${signature}`;
    this.jwt = { value, expiresAt: expiresAt * 1000 };
    return value;
  }
}

function assertInstallationId(installationId: number) {
  if (!Number.isSafeInteger(installationId) || installationId <= 0)
    throw new Error("Invalid GitHub App installation ID.");
}

function encodeSegment(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === "string" ? body.message.slice(0, 200) : "";
  } catch {
    return "";
  }
}
