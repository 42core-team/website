/**
 * How the worker authenticates against an event's GitHub organization: as the
 * CORE GitHub App installation, or with the organizer's encrypted token.
 * Mirrors GithubAuth in api/src/github-api/github-auth.ts.
 */
export type GithubAuth =
  | { kind: "installation"; installationId: number }
  | { kind: "token"; encryptedSecret: string };
