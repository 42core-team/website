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

  const prioritized = components.some(
    (component) => component.visualizer_asset_prioritized,
  )

  return (
    components
      .filter(
        (component) => component.visualizer_asset_prioritized === prioritized,
      )
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
      .at(0)?.visualizer_asset_path ?? FALLBACK_UNIT_ASSET_PATH
  )
}

export function getUnitIconSrc(assetPath: string) {
  return `/generated/visualizer/object-svgs/units/${assetPath}/1.svg`
}
