import type { ComponentsConfig } from './types'

const FALLBACK_UNIT_ASSET_PATH = 'fallback'

export function getUnitAssetPath(
  config: ComponentsConfig,
  componentIds: string[],
) {
  const components = componentIds.flatMap((id) => {
    const component = config.components.find((candidate) => candidate.id === id)
    return component?.visualizer_asset_path ? [component] : []
  })
  const counts = new Map<string, number>()

  for (const component of components)
    counts.set(component.id, (counts.get(component.id) ?? 0) + 1)

  return (
    components
      .sort(
        (a, b) =>
          b.visualizer_asset_priority - a.visualizer_asset_priority ||
          (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
      )
      .at(0)?.visualizer_asset_path ?? FALLBACK_UNIT_ASSET_PATH
  )
}

export function getUnitIconSrc(assetPath: string) {
  return `/generated/visualizer/object-svgs/units/${assetPath}/1.svg`
}
