import { Effect, Schema, Duration, Data, Context, Layer, Option } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpBody,
  Headers,
} from "@effect/platform";

export class GitHubError extends Data.TaggedError("GitHubError")<{
  message: string;
  status?: number;
}> {}

export class GitHubRateLimitError extends Data.TaggedError(
  "GitHubRateLimitError",
)<{
  resetAt: number | undefined;
  message: string;
  status?: number;
}> {}

export class GitHubNotFoundError extends Data.TaggedError(
  "GitHubNotFoundError",
)<{
  message: string;
  status?: number;
}> {}

export const GitHubConfigSchema = Schema.Struct({
  baseUrl: Schema.String,
  token: Schema.String,
  userAgent: Schema.String,
  maxRetries: Schema.Number,
});
export type GitHubConfig = Schema.Schema.Type<typeof GitHubConfigSchema>;

export type GitHubErrors =
  | GitHubError
  | GitHubRateLimitError
  | GitHubNotFoundError;

export interface GitHubApi {
  addWritePermission(
    repoOwner: string,
    repoName: string,
    username: string,
  ): Effect.Effect<void, GitHubErrors, HttpClient.HttpClient>;
  removeWritePermission(
    repoOwner: string,
    repoName: string,
    username: string,
  ): Effect.Effect<void, GitHubErrors, HttpClient.HttpClient>;
  addUserToRepository(
    githubOrg: string,
    repositoryName: string,
    username: string,
  ): Effect.Effect<void, GitHubErrors, HttpClient.HttpClient>;
  removeUserFromRepository(
    githubOrg: string,
    repositoryName: string,
    username: string,
  ): Effect.Effect<void, GitHubErrors, HttpClient.HttpClient>;
  deleteRepository(
    githubOrg: string,
    repositoryName: string,
  ): Effect.Effect<void, GitHubErrors, HttpClient.HttpClient>;
  createRepo(
    org: string,
    opts: { name: string; private: boolean },
  ): Effect.Effect<
    { name: string; ssh_url: string; clone_url: string },
    GitHubErrors,
    HttpClient.HttpClient
  >;
  getUserById(
    githubId: string,
  ): Effect.Effect<
    { login: string; name: string | null },
    GitHubErrors,
    HttpClient.HttpClient
  >;
  acceptRepositoryInvitationByRepo(
    githubOrg: string,
    repositoryName: string,
  ): Effect.Effect<void, GitHubErrors, HttpClient.HttpClient>;
}

export class GitHubClient implements GitHubApi {
  constructor(private readonly cfg: GitHubConfig) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": this.cfg.userAgent,
    };
  }

  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(
      endpoint.startsWith("http")
        ? endpoint
        : `${this.cfg.baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`,
    );
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private static parseRateLimitReset(
    headers: Headers.Headers,
  ): number | undefined {
    const reset = Option.getOrUndefined(
      Headers.get(headers, "x-ratelimit-reset"),
    );
    if (!reset) return undefined;
    const n = Number(reset);
    return Number.isFinite(n) ? n * 1000 : undefined; // to ms
  }

  private static isRateLimited(
    status: number,
    headers: Headers.Headers,
  ): boolean {
    if (status === 429) return true;
    if (status === 403) {
      const remaining = Option.getOrUndefined(
        Headers.get(headers, "x-ratelimit-remaining"),
      );
      return remaining === "0";
    }
    return false;
  }

  private static classifyError(
    status: number,
    headers: Headers.Headers,
  ): GitHubError | GitHubRateLimitError | GitHubNotFoundError {
    if (GitHubClient.isRateLimited(status, headers)) {
      return new GitHubRateLimitError({
        resetAt: GitHubClient.parseRateLimitReset(headers),
        message: "Rate limited",
        status: 429,
      });
    }
    if (status === 404)
      return new GitHubNotFoundError({ message: "Not found", status });
    return new GitHubError({ message: `GitHub API error: ${status}`, status });
  }

  private requestJson<A>(
    endpoint: string,
    options?: {
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      params?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
      responseSchema?: Schema.Schema<A>;
    },
  ): Effect.Effect<
    A,
    GitHubError | GitHubRateLimitError | GitHubNotFoundError,
    HttpClient.HttpClient
  > {
    const url = this.buildUrl(endpoint, options?.params);
    const method = options?.method ?? "GET";

    const run = Effect.gen(this, function* () {
      const body = options?.body
        ? HttpBody.unsafeJson(options.body)
        : undefined;
      const req = HttpClientRequest.make(method)(url, {
        headers: this.headers(),
        body,
      });
      const res = yield* HttpClient.execute(req);

      const headers = res.headers;

      if (res.status >= 200 && res.status < 300) {
        if (res.status === 204) {
          return { ok: true as const, body: undefined } as const;
        }
        const json = yield* res.json;
        return { ok: true as const, body: json } as const;
      }
      return yield* Effect.fail(
        GitHubClient.classifyError(res.status, headers),
      );
    }).pipe(
      Effect.catchAll((e) =>
        Effect.fail(new GitHubError({ message: String(e) })),
      ),
      Effect.flatMap(({ body }) => {
        if (options?.responseSchema) {
          return Schema.decodeUnknown(options.responseSchema)(body).pipe(
            Effect.mapError((e) => new GitHubError({ message: String(e) })),
          );
        }
        return Effect.succeed(body as A);
      }),
    );

    type Err = GitHubError | GitHubRateLimitError | GitHubNotFoundError;
    const withRetries = (
      eff: Effect.Effect<A, Err, HttpClient.HttpClient>,
    ): Effect.Effect<A, Err, HttpClient.HttpClient> =>
      Effect.retry(eff, { times: this.cfg.maxRetries }).pipe(
        Effect.catchAll((e: Err) => {
          if (e instanceof GitHubRateLimitError && e.resetAt) {
            const wait = Math.max(0, e.resetAt - Date.now()) + 1000;
            return Effect.sleep(Duration.millis(wait)).pipe(
              Effect.andThen(withRetries(eff)),
            );
          }
          return Effect.fail(e);
        }),
      );

    return withRetries(run);
  }

  addWritePermission(repoOwner: string, repoName: string, username: string) {
    return this.requestJson<void>(
      `repos/${repoOwner}/${repoName}/collaborators/${username}`,
      {
        method: "PUT",
        body: { permission: "push" },
      },
    );
  }
  removeWritePermission(repoOwner: string, repoName: string, username: string) {
    return this.requestJson<void>(
      `repos/${repoOwner}/${repoName}/collaborators/${username}`,
      { method: "DELETE" },
    );
  }
  addUserToRepository(
    githubOrg: string,
    repositoryName: string,
    username: string,
  ) {
    return this.requestJson<void>(
      `repos/${githubOrg}/${repositoryName}/collaborators/${username}`,
      {
        method: "PUT",
        body: { permission: "push" },
      },
    );
  }
  removeUserFromRepository(
    githubOrg: string,
    repositoryName: string,
    username: string,
  ) {
    return this.requestJson<void>(
      `repos/${githubOrg}/${repositoryName}/collaborators/${username}`,
      { method: "DELETE" },
    );
  }
  deleteRepository(githubOrg: string, repositoryName: string) {
    return this.requestJson<void>(`repos/${githubOrg}/${repositoryName}`, {
      method: "DELETE",
    });
  }

  createRepo(org: string, opts: { name: string; private: boolean }) {
    return this.requestJson<{
      name: string;
      ssh_url: string;
      clone_url: string;
    }>(`orgs/${org}/repos`, {
      method: "POST",
      body: { name: opts.name, private: opts.private },
    });
  }

  getUserById(githubId: string) {
    return this.requestJson<{ login: string; name: string | null }>(
      `user/${githubId}`,
      {
        method: "GET",
      },
    );
  }

  acceptRepositoryInvitationByRepo(githubOrg: string, repositoryName: string) {
    type Invitation = { id: number; repository?: { full_name?: string } };
    return this.requestJson<Invitation[]>(`user/repository_invitations`, {
      method: "GET",
    }).pipe(
      Effect.flatMap((invitations) => {
        const full = `${githubOrg}/${repositoryName}`.toLowerCase();
        const match = (invitations ?? []).find(
          (inv) => (inv.repository?.full_name ?? "").toLowerCase() === full,
        );
        if (!match) return Effect.void;
        return this.requestJson<void>(
          `user/repository_invitations/${match.id}`,
          { method: "PATCH" },
        );
      }),
    );
  }
}

export interface GitHubFactory {
  readonly make: (token: string) => GitHubApi;
}

export const GitHubFactory = Context.GenericTag<GitHubFactory>("GitHubFactory");

export const GitHubFactoryLive = (
  base: { baseUrl?: string; userAgent?: string; maxRetries?: number } = {},
) =>
  Layer.effect(
    GitHubFactory,
    Effect.succeed<GitHubFactory>({
      make: (token: string) =>
        new GitHubClient({
          baseUrl: base.baseUrl ?? "https://api.github.com",
          token,
          userAgent: base.userAgent ?? "github-service",
          maxRetries: base.maxRetries ?? 5,
        }),
    }),
  );
