import { describe, expect, it } from 'vitest'
import * as apiValidation from '../../../api/src/common/github-validation.ts'
import fixtures from '../../../api/src/common/github-validation.fixtures.json'
import {
  GITHUB_CONFIG_FIELDS,
  GITHUB_OWNER_PATTERN,
  GITHUB_REPO_NAME_PATTERN,
  GITHUB_REPO_URL_PATTERN,
  GIT_REF_PATTERN,
  REPO_RELATIVE_PATH_PATTERN,
  getGithubConfigError,
  githubConfigSchema,
  normalizeGithubConfigValue,
} from './github-validation'
import type { GithubConfigField } from './github-validation'

const frontendPatterns = {
  GITHUB_OWNER_PATTERN,
  GITHUB_REPO_NAME_PATTERN,
  GITHUB_REPO_URL_PATTERN,
  GIT_REF_PATTERN,
  REPO_RELATIVE_PATH_PATTERN,
}
type PatternName = keyof typeof frontendPatterns
const patternNames = Object.keys(frontendPatterns) as PatternName[]

const fieldPatterns: Record<GithubConfigField, PatternName> = {
  githubOrg: 'GITHUB_OWNER_PATTERN',
  monorepoUrl: 'GITHUB_REPO_URL_PATTERN',
  monorepoVersion: 'GIT_REF_PATTERN',
  basePath: 'REPO_RELATIVE_PATH_PATTERN',
}

describe('parity with api/src/common/github-validation.ts', () => {
  it.each(patternNames)('%s is identical to the API pattern', (name) => {
    const apiPattern = apiValidation[name]
    expect(apiPattern).toBeInstanceOf(RegExp)
    expect(frontendPatterns[name].source).toBe(apiPattern.source)
    expect(frontendPatterns[name].flags).toBe(apiPattern.flags)
  })

  it('covers every pattern the API exports', () => {
    const apiPatternNames = Object.entries(apiValidation)
      .filter(([, value]) => value instanceof RegExp)
      .map(([name]) => name)
      .sort()
    expect(apiPatternNames).toEqual([...patternNames].sort())
    expect(Object.keys(fixtures.patterns).sort()).toEqual(
      [...patternNames].sort(),
    )
  })

  it.each(patternNames)('%s accepts the shared valid examples', (name) => {
    const rejected = fixtures.patterns[name].valid.filter(
      (value) => !frontendPatterns[name].test(value),
    )
    expect(rejected).toEqual([])
  })

  it.each(patternNames)('%s rejects the shared invalid examples', (name) => {
    const accepted = fixtures.patterns[name].invalid.filter((value) =>
      frontendPatterns[name].test(value),
    )
    expect(accepted).toEqual([])
  })

  it.each(GITHUB_CONFIG_FIELDS)('normalizes %s like the API does', (field) => {
    for (const [input, expected] of fixtures.normalization[field]) {
      expect(normalizeGithubConfigValue(field, input)).toBe(expected)
      expect(apiValidation.normalizeGithubConfigValue(field, input)).toBe(
        expected,
      )
    }
  })
})

describe('getGithubConfigError', () => {
  it.each(GITHUB_CONFIG_FIELDS)(
    'agrees with the pattern on every shared example for %s',
    (field) => {
      const { valid, invalid } = fixtures.patterns[fieldPatterns[field]]
      for (const value of valid)
        expect(getGithubConfigError(field, value)).toBeUndefined()
      for (const value of invalid) {
        // Normalization may turn an invalid raw value into a valid one (for
        // example by trimming), but only when the normalized value matches.
        const normalized = normalizeGithubConfigValue(field, value)
        const error = getGithubConfigError(field, value)
        expect(error === undefined).toBe(
          frontendPatterns[fieldPatterns[field]].test(normalized),
        )
      }
    },
  )

  it('reports required fields', () => {
    expect(getGithubConfigError('githubOrg', '  ')).toBe(
      'GitHub organization is required',
    )
    expect(getGithubConfigError('monorepoUrl', '')).toBe(
      'Monorepo URL is required',
    )
    expect(getGithubConfigError('monorepoVersion', '')).toBe(
      'Monorepo version is required',
    )
    expect(getGithubConfigError('basePath', './')).toBe('Base path is required')
  })

  it.each([
    ['githubOrg', 'https://github.com/core', 'not a URL'],
    ['githubOrg', 'core_team', 'letters, digits and hyphens'],
    ['githubOrg', '-core', 'start or end with a hyphen'],
    ['githubOrg', 'co--re', 'consecutive hyphens'],
    ['githubOrg', 'a'.repeat(40), 'at most 39'],
    ['monorepoUrl', 'http://github.com/a/b', 'Use https'],
    ['monorepoUrl', 'https://gitlab.com/a/b', 'GitHub repository URL'],
    ['monorepoUrl', 'https://github.com/a/b?tab=x', 'query or fragment'],
    ['monorepoUrl', 'https://github.com/a/b/tree/main', 'extra path'],
    [
      'monorepoUrl',
      'https://github.com/a',
      'https://github.com/<owner>/<repo>',
    ],
    ['monorepoVersion', '-b', "start with '-'"],
    ['monorepoVersion', 'a b', 'Use only letters'],
    ['monorepoVersion', 'a..b', "'..'"],
    ['monorepoVersion', 'x.lock', '.lock'],
    ['monorepoVersion', 'main/', "'/'"],
    ['basePath', '/etc', "leading '/'"],
    ['basePath', 'a\\b', "Use '/'"],
    ['basePath', 'a/../b', "'.' or '..'"],
    ['basePath', 'a//b', "'//'"],
    ['basePath', 'a/-x', "start with '-'"],
  ] as const)('explains why %s %j is invalid', (field, value, hint) => {
    expect(getGithubConfigError(field, value)).toContain(hint)
  })
})

describe('normalization', () => {
  it('accepts harmless input differences', () => {
    expect(getGithubConfigError('githubOrg', ' core-org ')).toBeUndefined()
    expect(
      getGithubConfigError(
        'monorepoUrl',
        ' https://github.com/42core-team/monorepo/ ',
      ),
    ).toBeUndefined()
    expect(getGithubConfigError('monorepoVersion', ' dev ')).toBeUndefined()
    expect(
      getGithubConfigError('basePath', ' ./bots/softcore '),
    ).toBeUndefined()
  })

  it('strips only one leading ./ from the base path', () => {
    expect(normalizeGithubConfigValue('basePath', './bots')).toBe('bots')
    expect(normalizeGithubConfigValue('basePath', '././bots')).toBe('./bots')
    expect(getGithubConfigError('basePath', '././bots')).toBeDefined()
    expect(getGithubConfigError('basePath', './../x')).toBeDefined()
    expect(getGithubConfigError('basePath', './-x')).toBeDefined()
  })

  it('strips only one trailing slash from the monorepo URL', () => {
    expect(
      getGithubConfigError('monorepoUrl', 'https://github.com/a/b//'),
    ).toBeDefined()
  })
})

describe('githubConfigSchema', () => {
  it('passes valid values and reports the specific message', () => {
    const schema = githubConfigSchema('monorepoUrl')
    expect(schema.safeParse('https://github.com/a/b.git').success).toBe(true)
    const result = schema.safeParse('https://github.com/a/b/c')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('extra path segments')
  })
})
