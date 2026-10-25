/**
 * Validation for event configuration values that end up in git commands,
 * file paths and repository URLs (repository setup in github-service and the
 * match runner in k8s-service). The github-service re-validates the same
 * values before using them.
 */

/** GitHub user/organization name: alphanumerics and single inner hyphens, max 39 chars. */
export const GITHUB_OWNER_PATTERN =
  /^(?=.{1,39}$)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;

/** GitHub repository name, excluding the special names "." and "..". */
export const GITHUB_REPO_NAME_PATTERN = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;

/** https://github.com/<owner>/<repo>, optionally ending in .git, nothing else. */
export const GITHUB_REPO_URL_PATTERN =
  /^https:\/\/github\.com\/(?=[A-Za-z0-9-]{1,39}\/)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\/(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;

/**
 * A git branch or tag name from a conservative charset. It cannot start with
 * "-" (so it is never read as an option), and cannot contain "..", "//", or
 * start/end with "/".
 */
export const GIT_REF_PATTERN =
  /^(?!-)(?!\/)(?!.*\/$)(?!.*\.\.)(?!.*\/\/)(?!.*\.lock$)[A-Za-z0-9._/-]{1,255}$/;

/**
 * A relative path inside a repository: segments of safe characters separated
 * by single slashes, no leading "/", no "." or ".." segments and no segment
 * starting with "-". A single trailing slash is allowed.
 */
export const REPO_RELATIVE_PATH_PATTERN =
  /^(?=.{1,255}$)(?!\.{1,2}(?:\/|$))[A-Za-z0-9._][A-Za-z0-9._-]*(?:\/(?!\.{1,2}(?:\/|$))[A-Za-z0-9._][A-Za-z0-9._-]*)*\/?$/;

export const GITHUB_OWNER_MESSAGE =
  "githubOrg must be a valid GitHub organization name (letters, digits and single hyphens, max 39 characters, no leading or trailing hyphen)";
export const GITHUB_REPO_URL_MESSAGE =
  "monorepoUrl must be a URL of the form https://github.com/<owner>/<repo>";
export const GIT_REF_MESSAGE =
  "monorepoVersion must be a valid branch or tag name (letters, digits, '.', '_', '-', '/'; it may not start with '-')";
export const REPO_RELATIVE_PATH_MESSAGE =
  "basePath must be a relative path inside the repository (letters, digits, '.', '_', '-' and '/'; no leading '/', no '.' or '..' segments)";

export function isValidGithubOwner(value: unknown): value is string {
  return typeof value === "string" && GITHUB_OWNER_PATTERN.test(value);
}

export function isValidGithubRepoName(value: unknown): value is string {
  return typeof value === "string" && GITHUB_REPO_NAME_PATTERN.test(value);
}

/*
 * Normalization of harmless input differences (surrounding whitespace, a
 * trailing slash after the repository URL). It runs before validation, so the
 * patterns above stay exactly as strict as they are. The frontend applies the
 * same normalization (frontend/src/lib/github-validation.ts).
 */

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

/** Trims the value and removes a single trailing "/". */
function normalizeRepoUrl(value: unknown): unknown {
  const trimmed = trimString(value);
  return typeof trimmed === "string" && trimmed.endsWith("/")
    ? trimmed.slice(0, -1)
    : trimmed;
}

export const GITHUB_CONFIG_NORMALIZERS = {
  githubOrg: trimString,
  monorepoUrl: normalizeRepoUrl,
  monorepoVersion: trimString,
  basePath: trimString,
} as const satisfies Record<string, (value: unknown) => unknown>;

export type GithubConfigField = keyof typeof GITHUB_CONFIG_NORMALIZERS;

export function normalizeGithubConfigValue(
  field: GithubConfigField,
  value: unknown,
): unknown {
  return GITHUB_CONFIG_NORMALIZERS[field](value);
}

/**
 * Returns a copy of a request body with the GitHub config fields normalized.
 * Fields that are missing or not strings are left untouched.
 */
export function normalizeGithubConfigBody<T>(body: T): T {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    return body;
  const normalized = { ...body } as Record<string, unknown>;
  for (const field of Object.keys(
    GITHUB_CONFIG_NORMALIZERS,
  ) as GithubConfigField[]) {
    if (Object.prototype.hasOwnProperty.call(normalized, field))
      normalized[field] = normalizeGithubConfigValue(field, normalized[field]);
  }
  return normalized as T;
}
