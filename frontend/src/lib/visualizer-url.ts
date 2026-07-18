export interface MatchVisualizerUrlOptions {
  visualizerUrl: string
  replaysBucketUrl: string
  matchId: string
  visualizerDockerImage?: string
  phase?: string
  round?: number
}

export function extractVisualizerTag(
  visualizerDockerImage?: string,
): string | undefined {
  if (!visualizerDockerImage) return undefined

  const lastSlashIndex = visualizerDockerImage.lastIndexOf('/')
  const lastColonIndex = visualizerDockerImage.lastIndexOf(':')

  if (lastColonIndex <= lastSlashIndex) return undefined

  const tag = visualizerDockerImage.slice(lastColonIndex + 1)
  return tag || undefined
}

export function normalizeVisualizerTag(tag: string): string {
  if (!/^v?\d+(?:\.\d+)+$/.test(tag)) return tag

  const prefix = tag.startsWith('v') ? 'v' : ''
  const versionParts = tag.slice(prefix.length).split('.')

  return `${prefix}${versionParts.slice(0, 3).join('.')}`
}

export function buildMatchVisualizerUrl({
  visualizerUrl,
  replaysBucketUrl,
  matchId,
  visualizerDockerImage,
  phase,
  round,
}: MatchVisualizerUrlOptions): string | null {
  if (!visualizerUrl || !replaysBucketUrl) return null

  const url = new URL(visualizerUrl)
  const visualizerTag = extractVisualizerTag(visualizerDockerImage)

  if (visualizerTag) {
    const normalizedTag = normalizeVisualizerTag(visualizerTag)
    const basePath = url.pathname.replace(/\/$/, '')
    url.pathname = `${basePath}/${encodeURIComponent(normalizedTag)}`
  }

  url.searchParams.set('replays', `${replaysBucketUrl}/${matchId}/replay.json`)
  url.searchParams.set('dynamicSpeed', 'on')
  url.searchParams.set('autoplay', 'start')
  if (phase) url.searchParams.set('mode', phase)
  if (typeof round === 'number') url.searchParams.set('round', String(round))

  return url.toString()
}
