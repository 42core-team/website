import * as z from 'zod'

/*
 * Validation for the GitHub related event configuration (organization,
 * monorepo URL, version and base path), so mistakes are reported in the form
 * instead of failing later during repository setup or at match start.
 *
 * Source of truth: api/src/common/github-validation.ts. The patterns below
 * must stay byte-for-byte identical to the API ones; github-validation.test.ts
 * compares them and runs both against the shared example values in
 * api/src/common/github-validation.fixtures.json.
 */

/** GitHub user/organization name: alphanumerics and single inner hyphens, max 39 chars. */
export const GITHUB_OWNER_PATTERN =
  /^(?=.{1,39}$)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/

/** GitHub repository name, excluding the special names "." and "..". */
export const GITHUB_REPO_NAME_PATTERN = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/

/** https://github.com/<owner>/<repo>, optionally ending in .git, nothing else. */
export const GITHUB_REPO_URL_PATTERN =
  /^https:\/\/github\.com\/(?=[A-Za-z0-9-]{1,39}\/)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\/(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/

/** A branch or tag name that cannot start with "-" and has no "..", "//" or leading/trailing "/". */
export const GIT_REF_PATTERN =
  /^(?!-)(?!\/)(?!.*\/$)(?!.*\.\.)(?!.*\/\/)(?!.*\.lock$)[A-Za-z0-9._/-]{1,255}$/

/** A relative path inside a repository without "." or ".." segments, leading "/" or segments starting with "-". */
export const REPO_RELATIVE_PATH_PATTERN =
  /^(?=.{1,255}$)(?!\.{1,2}(?:\/|$))[A-Za-z0-9._][A-Za-z0-9._-]*(?:\/(?!\.{1,2}(?:\/|$))[A-Za-z0-9._][A-Za-z0-9._-]*)*\/?$/

export type GithubConfigField =
  'githubOrg' | 'monorepoUrl' | 'monorepoVersion' | 'basePath'

export const GITHUB_CONFIG_FIELDS: readonly GithubConfigField[] = [
  'githubOrg',
  'monorepoUrl',
  'monorepoVersion',
  'basePath',
]

export const GITHUB_CONFIG_LABELS: Record<GithubConfigField, string> = {
  githubOrg: 'GitHub organization',
  monorepoUrl: 'Monorepo URL',
  monorepoVersion: 'Monorepo version',
  basePath: 'Base path',
}

export function isGithubConfigField(field: string): field is GithubConfigField {
  return (GITHUB_CONFIG_FIELDS as readonly string[]).includes(field)
}

/*
 * Normalization of harmless input differences. It only removes characters
 * that the patterns would reject anyway, so it never lets through a value
 * the API would not accept. The API applies the same trimming and trailing
 * slash removal.
 */

/** Trims whitespace and removes a single trailing "/". */
export function normalizeMonorepoUrl(value: string) {
  const trimmed = value.trim()
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

/**
 * Trims whitespace and removes a single leading "./". The rest is validated
 * as usual, so "./../x" still fails as "../x".
 */
export function normalizeBasePath(value: string) {
  const trimmed = value.trim()
  return trimmed.startsWith('./') ? trimmed.slice(2) : trimmed
}

const normalizers: Record<GithubConfigField, (value: string) => string> = {
  githubOrg: (value) => value.trim(),
  monorepoUrl: normalizeMonorepoUrl,
  monorepoVersion: (value) => value.trim(),
  basePath: normalizeBasePath,
}

export function normalizeGithubConfigValue(
  field: GithubConfigField,
  value: string,
) {
  return normalizers[field](value)
}

const REPO_URL_FORMAT = 'https://github.com/<owner>/<repo>'

function githubOrgError(value: string): string | undefined {
  if (!value) return 'GitHub organization is required'
  if (GITHUB_OWNER_PATTERN.test(value)) return undefined
  if (value.includes('/') || value.includes(':'))
    return 'Enter only the organization name (e.g. 42core-team), not a URL or path'
  if (value.length > 39) return 'Must be at most 39 characters'
  if (/[^A-Za-z0-9-]/.test(value)) return 'Use only letters, digits and hyphens'
  if (value.startsWith('-') || value.endsWith('-'))
    return 'Cannot start or end with a hyphen'
  return 'Cannot contain consecutive hyphens'
}

function monorepoUrlError(value: string): string | undefined {
  if (!value) return 'Monorepo URL is required'
  if (GITHUB_REPO_URL_PATTERN.test(value)) return undefined
  if (value.startsWith('http://')) return `Use https: ${REPO_URL_FORMAT}`
  if (!value.startsWith('https://github.com/'))
    return `Must be a GitHub repository URL: ${REPO_URL_FORMAT}`
  if (/[?#]/.test(value))
    return `Remove the query or fragment: ${REPO_URL_FORMAT}`
  const path = value.slice('https://github.com/'.length).split('/')
  if (path.length > 2)
    return `Use the repository URL without extra path segments: ${REPO_URL_FORMAT}`
  return `Must be ${REPO_URL_FORMAT} (optionally ending in .git)`
}

function monorepoVersionError(value: string): string | undefined {
  if (!value) return 'Monorepo version is required'
  if (GIT_REF_PATTERN.test(value)) return undefined
  if (value.startsWith('-')) return "Cannot start with '-'"
  if (value.length > 255) return 'Must be at most 255 characters'
  if (/[^A-Za-z0-9._/-]/.test(value))
    return "Use only letters, digits, '.', '_', '-' and '/'"
  if (value.includes('..')) return "Cannot contain '..'"
  if (value.endsWith('.lock')) return "Cannot end with '.lock'"
  return "Cannot start or end with '/' or contain '//'"
}

function basePathError(value: string): string | undefined {
  if (!value) return 'Base path is required'
  if (REPO_RELATIVE_PATH_PATTERN.test(value)) return undefined
  if (value.startsWith('/'))
    return "Must be relative to the repository root, without a leading '/' (e.g. bots/softcore)"
  if (value.includes('\\')) return "Use '/' to separate folders"
  if (value.length > 255) return 'Must be at most 255 characters'
  if (/[^A-Za-z0-9._/-]/.test(value))
    return "Use only letters, digits, '.', '_', '-' and '/'"
  const segments = value.replace(/\/$/, '').split('/')
  if (segments.some((segment) => segment === '.' || segment === '..'))
    return "Cannot contain '.' or '..' segments"
  if (segments.some((segment) => segment === '')) return "Cannot contain '//'"
  return "Folder names cannot start with '-'"
}

const errorFinders: Record<
  GithubConfigField,
  (value: string) => string | undefined
> = {
  githubOrg: githubOrgError,
  monorepoUrl: monorepoUrlError,
  monorepoVersion: monorepoVersionError,
  basePath: basePathError,
}

/**
 * Normalizes the value and returns a message explaining what is wrong with
 * it, or undefined when it is valid. Whether a value is valid is decided by
 * the pattern alone; the checks before it only pick a more specific message.
 */
export function getGithubConfigError(
  field: GithubConfigField,
  value: string,
): string | undefined {
  return errorFinders[field](normalizeGithubConfigValue(field, value))
}

/** Zod schema for a form field holding one of the GitHub config values. */
export function githubConfigSchema(field: GithubConfigField) {
  return z.string().superRefine((value, ctx) => {
    const message = getGithubConfigError(field, value)
    if (message) ctx.addIssue({ code: 'custom', message })
  })
}
