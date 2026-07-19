export const UNIT_PROPERTY_NAMES = [
  'hp',
  'baseActionCooldown',
  'balancePerCooldownStep',
  'maxBalance',
  'damageReductionPercent',
  'damageCore',
  'damageUnit',
  'damageObject',
  'postSpawnCoreCooldown',
] as const

export type UnitPropertyName = (typeof UNIT_PROPERTY_NAMES)[number]
export type UnitProperties = Record<UnitPropertyName, number>

export interface ComponentConfigProperty {
  name: UnitPropertyName
  modification: number
}

export interface ComponentConfig {
  id: string
  properties: ComponentConfigProperty[]
  cost: number
  visualizer_asset_prioritized: boolean
  visualizer_asset_path: string
}

export type ConditionExpr =
  | { type: 'const'; value: number }
  | { type: 'property'; property: UnitPropertyName }
  | { type: 'component_count'; component: string }
  | { type: 'not'; '1': ConditionExpr }
  | {
      type: 'ternary'
      if: ConditionExpr
      then: ConditionExpr
      else: ConditionExpr
    }
  | {
      type:
        | 'sum'
        | 'subtract'
        | 'multiply'
        | 'divide'
        | 'min'
        | 'max'
        | 'less_than'
        | 'greater_than'
        | 'less_than_or_equal'
        | 'greater_than_or_equal'
        | 'equal'
      '1': ConditionExpr
      '2': ConditionExpr
    }

export interface InvalidCondition {
  message: string
  condition: ConditionExpr
}

export interface ComponentsConfig {
  maxComponentsPerUnit: number
  unitDefaultCost: number
  unitDefaultProperties: UnitProperties
  components: ComponentConfig[]
  invalidConditions: InvalidCondition[]
}

export interface RuleViolation {
  message: string
  conditionText: string
}
