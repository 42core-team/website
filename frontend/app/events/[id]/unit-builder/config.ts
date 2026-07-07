import type { ComponentsConfig, ConditionExpr, UnitProperties } from './types'
import { UNIT_PROPERTY_NAMES } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isUnitPropertyName(value: unknown): value is keyof UnitProperties {
  return (
    typeof value === 'string' &&
    UNIT_PROPERTY_NAMES.includes(value as keyof UnitProperties)
  )
}

function isConditionExpr(value: unknown): value is ConditionExpr {
  if (!isRecord(value) || typeof value.type !== 'string') return false

  if (value.type === 'const') return typeof value.value === 'number'

  if (value.type === 'property') return isUnitPropertyName(value.property)

  if (value.type === 'component_count')
    return typeof value.component === 'string'

  if (value.type === 'not') return isConditionExpr(value['1'])

  if (value.type === 'ternary') {
    return (
      isConditionExpr(value.if) &&
      isConditionExpr(value.then) &&
      isConditionExpr(value.else)
    )
  }

  return (
    [
      'sum',
      'subtract',
      'multiply',
      'divide',
      'min',
      'max',
      'less_than',
      'greater_than',
      'less_than_or_equal',
      'greater_than_or_equal',
      'equal',
    ].includes(value.type) &&
    isConditionExpr(value['1']) &&
    isConditionExpr(value['2'])
  )
}

function readUnitProperties(value: unknown): UnitProperties | null {
  if (!isRecord(value)) return null

  const properties = {} as UnitProperties
  for (const name of UNIT_PROPERTY_NAMES) {
    if (typeof value[name] !== 'number') return null
    properties[name] = value[name]
  }

  return properties
}

export function readComponentsConfig(gameConfig: string | undefined) {
  if (!gameConfig) return null

  try {
    const parsed: unknown = JSON.parse(gameConfig)
    if (!isRecord(parsed) || !isRecord(parsed.components)) return null

    const source = parsed.components
    const defaults = readUnitProperties(source.unitDefaultProperties)
    if (!defaults || typeof source.maxComponentsPerUnit !== 'number')
      return null

    if (!Array.isArray(source.components)) return null

    const components = source.components.flatMap((component) => {
      if (!isRecord(component) || !Array.isArray(component.properties))
        return []

      const properties = component.properties.flatMap((property) => {
        if (!isRecord(property) || !isUnitPropertyName(property.name)) return []

        if (typeof property.modification !== 'number') return []

        return [{ name: property.name, modification: property.modification }]
      })

      if (
        typeof component.id !== 'string' ||
        typeof component.cost !== 'number' ||
        typeof component.visualizer_asset_prioritized !== 'boolean' ||
        typeof component.visualizer_asset_path !== 'string' ||
        properties.length !== component.properties.length
      ) {
        return []
      }

      return [
        {
          id: component.id,
          properties,
          cost: component.cost,
          visualizer_asset_prioritized: component.visualizer_asset_prioritized,
          visualizer_asset_path: component.visualizer_asset_path,
        },
      ]
    })

    if (components.length !== source.components.length) return null

    const invalidConditions = Array.isArray(source.invalidConditions)
      ? source.invalidConditions.flatMap((condition) => {
          if (
            !isRecord(condition) ||
            typeof condition.message !== 'string' ||
            !isConditionExpr(condition.condition)
          ) {
            return []
          }

          return [
            {
              message: condition.message,
              condition: condition.condition,
            },
          ]
        })
      : []

    if (
      Array.isArray(source.invalidConditions) &&
      invalidConditions.length !== source.invalidConditions.length
    ) {
      return null
    }

    return {
      maxComponentsPerUnit: source.maxComponentsPerUnit,
      unitDefaultProperties: defaults,
      components,
      invalidConditions,
    } satisfies ComponentsConfig
  } catch {
    return null
  }
}
