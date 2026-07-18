import { describe, expect, it } from 'vitest'
import {
  buildMatchVisualizerUrl,
  extractVisualizerTag,
  normalizeVisualizerTag,
} from './visualizer-url'

describe('extractVisualizerTag', () => {
  it('extracts a tag after the image name', () => {
    expect(
      extractVisualizerTag('ghcr.io/42core-team/visualizer:1.2.3'),
    ).toBe('1.2.3')
  })

  it('ignores a registry port', () => {
    expect(
      extractVisualizerTag('registry.example:5000/visualizer:1.2.3'),
    ).toBe('1.2.3')
    expect(extractVisualizerTag('registry.example:5000/visualizer')).toBe(
      undefined,
    )
  })

  it('returns no tag for an untagged image', () => {
    expect(extractVisualizerTag('ghcr.io/42core-team/visualizer')).toBe(
      undefined,
    )
  })
})

describe('normalizeVisualizerTag', () => {
  it.each([
    ['1.2.3.4', '1.2.3'],
    ['1.2.3.4.5', '1.2.3'],
    ['v1.2.3.4', 'v1.2.3'],
    ['v1.2.3', 'v1.2.3'],
    ['1.2.3', '1.2.3'],
    ['1.2', '1.2'],
    ['latest', 'latest'],
    ['release-candidate', 'release-candidate'],
  ])('normalizes %s to %s', (tag, expected) => {
    expect(normalizeVisualizerTag(tag)).toBe(expected)
  })
})

describe('buildMatchVisualizerUrl', () => {
  const defaults = {
    visualizerUrl: 'https://visualizer.example',
    replaysBucketUrl: 'https://replays.example',
    matchId: 'match-id',
  }

  it('adds the normalized image tag as a path segment', () => {
    const result = buildMatchVisualizerUrl({
      ...defaults,
      visualizerDockerImage: 'ghcr.io/core/visualizer:v1.2.3.4',
    })
    const url = new URL(result!)

    expect(url.pathname).toBe('/v1.2.3')
  })

  it('preserves an existing path and query parameters', () => {
    const result = buildMatchVisualizerUrl({
      ...defaults,
      visualizerUrl: 'https://visualizer.example/embed/?existing=value',
      visualizerDockerImage: 'visualizer:release candidate',
      phase: 'SWISS',
      round: 0,
    })
    const url = new URL(result!)

    expect(url.pathname).toBe('/embed/release%20candidate')
    expect(url.searchParams.get('existing')).toBe('value')
    expect(url.searchParams.get('replays')).toBe(
      'https://replays.example/match-id/replay.json',
    )
    expect(url.searchParams.get('dynamicSpeed')).toBe('on')
    expect(url.searchParams.get('autoplay')).toBe('start')
    expect(url.searchParams.get('mode')).toBe('SWISS')
    expect(url.searchParams.get('round')).toBe('0')
  })

  it('uses the unversioned path when the image has no tag', () => {
    const result = buildMatchVisualizerUrl({
      ...defaults,
      visualizerUrl: 'https://visualizer.example/embed/',
      visualizerDockerImage: 'ghcr.io/core/visualizer',
    })

    expect(new URL(result!).pathname).toBe('/embed/')
  })

  it('returns null when a required base URL is missing', () => {
    expect(
      buildMatchVisualizerUrl({ ...defaults, visualizerUrl: '' }),
    ).toBeNull()
    expect(
      buildMatchVisualizerUrl({ ...defaults, replaysBucketUrl: '' }),
    ).toBeNull()
  })
})
