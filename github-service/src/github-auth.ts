/**
 * How the worker authenticates against an event's GitHub organization: as the
 * CORE GitHub App installation. Mirrors GithubAuth in
 * api/src/github-api/github-auth.ts.
 */
export type GithubAuth = { installationId: number };
