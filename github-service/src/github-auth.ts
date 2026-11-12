/**
 * How the worker authenticates against an event's GitHub organization: as the
 * CORE GitHub App installation, or with the organizer's encrypted token.
 * Mirrors GithubAuth in api/src/github-api/github-auth.ts.
 */
export type GithubAuth =
  | { kind: "installation"; installationId: number }
  | { kind: "token"; encryptedSecret: string };

/**
 * Reads the credentials of a queued message. Messages published before the
 * API switched to `githubAuth` carry only `encryptedSecret`.
 */
export function githubAuthOf(data: {
  githubAuth?: GithubAuth;
  encryptedSecret?: string;
}): GithubAuth {
  if (data.githubAuth) return data.githubAuth;
  if (data.encryptedSecret)
    return { kind: "token", encryptedSecret: data.encryptedSecret };
  throw new Error("The message carries no GitHub credentials.");
}
