import type { ComponentsConfig } from './types'

const FALLBACK_UNIT_ASSET_PATH = 'fallback'

export function getUnitAssetPath(
  config: ComponentsConfig,
  componentIds: string[],
) {
  const counts = componentIds.reduce<Record<string, number>>((result, id) => {
    result[id] = (result[id] ?? 0) + 1
    return result
  }, {})

  const entries = config.components
    .map((component) => ({
      id: component.id,
      count: counts[component.id] ?? 0,
      assetPath: component.visualizer_asset_path,
      prioritized: component.visualizer_asset_prioritized,
    }))
    .filter((entry) => entry.count > 0 && entry.assetPath)
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))

  const prioritized = entries.filter((entry) => entry.prioritized)

  return (
    (prioritized.length ? prioritized : entries)[0]?.assetPath ??
    FALLBACK_UNIT_ASSET_PATH
  )
}

export function getUnitIconSrc(assetPath: string) {
  return `/generated/visualizer/object-svgs/units/${assetPath}/1.svg`
}
