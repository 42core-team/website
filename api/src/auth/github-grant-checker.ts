import { Injectable } from "@nestjs/common";
import { GITHUB_GRANT_CHECK_TIMEOUT_MS } from "./session.constants";

export interface GithubProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
}

export type GithubGrantStatus =
  /** GitHub accepted the token (200). */
  | { status: "valid"; profile: GithubProfile }
  /** GitHub rejected the token (401): the grant is gone. */
  | { status: "revoked" }
  /** No reliable answer (other status, network error, timeout). */
  | { status: "unknown"; reason: string };

/**
 * Asks GitHub whether a user's OAuth token is still valid by calling
 * `GET /user` with it (ADR 0003). Never throws.
 */
@Injectable()
export class GithubGrantChecker {
  async check(accessToken: string): Promise<GithubGrantStatus> {
    let response: Response;
    try {
      response = await fetch("https://api.github.com/user", {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${accessToken}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(GITHUB_GRANT_CHECK_TIMEOUT_MS),
      });
    } catch (error) {
      return { status: "unknown", reason: describeError(error) };
    }

    if (response.status !== 200) {
      // Release the connection; an unread body holds it until GC.
      await response.body?.cancel().catch(() => undefined);
      if (response.status === 401) return { status: "revoked" };
      return { status: "unknown", reason: `HTTP ${response.status}` };
    }

    try {
      const profile = (await response.json()) as GithubProfile | null;
      if (!profile || typeof profile.login !== "string" || !profile.login) {
        return { status: "unknown", reason: "unexpected response body" };
      }
      return { status: "valid", profile };
    } catch (error) {
      return { status: "unknown", reason: describeError(error) };
    }
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : "error";
}
