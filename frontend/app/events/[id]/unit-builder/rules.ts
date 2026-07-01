import type {
  ComponentsConfig,
  ConditionExpr,
  RuleViolation,
  UnitProperties,
} from "./types";
import { UNIT_PROPERTY_NAMES } from "./types";

const OPS: Record<string, string> = {
  sum: "+",
  subtract: "-",
  multiply: "*",
  divide: "/",
  less_than: "<",
  greater_than: ">",
  less_than_or_equal: "<=",
  greater_than_or_equal: ">=",
  equal: "==",
};

export function countComponents(componentIds: string[]) {
  return componentIds.reduce<Record<string, number>>((counts, id) => {
    counts[id] = (counts[id] ?? 0) + 1;
    return counts;
  }, {});
}

export function getUnitProperties(
  config: ComponentsConfig,
  componentIds: string[],
) {
  const properties = { ...config.unitDefaultProperties };
  const counts = countComponents(componentIds);

  for (const component of config.components) {
    const count = counts[component.id] ?? 0;
    if (!count)
      continue;

    for (const property of component.properties) {
      properties[property.name] += property.modification * count;
    }
  }

  return properties;
}

export function getTotalCost(
  config: ComponentsConfig,
  componentIds: string[],
) {
  const counts = countComponents(componentIds);

  return config.components.reduce(
    (total, component) => total + component.cost * (counts[component.id] ?? 0),
    0,
  );
}

export function conditionToC(expr: ConditionExpr): string {
  if (expr.type === "const")
    return String(expr.value);

  if (expr.type === "property")
    return expr.property;

  if (expr.type === "component_count")
    return `component_count("${expr.component}")`;

  if (expr.type === "not")
    return `(!${conditionToC(expr["1"])})`;

  if (expr.type === "ternary") {
    return `(${conditionToC(expr.if)} ? ${conditionToC(expr.then)} : ${conditionToC(expr.else)})`;
  }

  if (expr.type === "min" || expr.type === "max") {
    return `${expr.type}(${conditionToC(expr["1"])}, ${conditionToC(expr["2"])})`;
  }

  return `(${conditionToC(expr["1"])} ${OPS[expr.type]} ${conditionToC(expr["2"])})`;
}

function evalCondition(
  expr: ConditionExpr,
  properties: UnitProperties,
  componentCounts: Record<string, number>,
): number {
  if (expr.type === "const")
    return expr.value;

  if (expr.type === "property")
    return properties[expr.property];

  if (expr.type === "component_count")
    return componentCounts[expr.component] ?? 0;

  if (expr.type === "not")
    return evalCondition(expr["1"], properties, componentCounts) === 0 ? 1 : 0;

  if (expr.type === "ternary") {
    return evalCondition(expr.if, properties, componentCounts) !== 0
      ? evalCondition(expr.then, properties, componentCounts)
      : evalCondition(expr.else, properties, componentCounts);
  }

  const a = evalCondition(expr["1"], properties, componentCounts);
  const b = evalCondition(expr["2"], properties, componentCounts);

  if (expr.type === "sum")
    return a + b;
  if (expr.type === "subtract")
    return a - b;
  if (expr.type === "multiply")
    return a * b;
  if (expr.type === "divide") {
    if (b === 0)
      throw new Error("division by zero");
    return Math.trunc(a / b);
  }
  if (expr.type === "min")
    return Math.min(a, b);
  if (expr.type === "max")
    return Math.max(a, b);
  if (expr.type === "less_than")
    return a < b ? 1 : 0;
  if (expr.type === "greater_than")
    return a > b ? 1 : 0;
  if (expr.type === "less_than_or_equal")
    return a <= b ? 1 : 0;
  if (expr.type === "greater_than_or_equal")
    return a >= b ? 1 : 0;

  return a === b ? 1 : 0;
}

export function findViolation(
  config: ComponentsConfig,
  componentIds: string[],
): RuleViolation | null {
  if (componentIds.length > config.maxComponentsPerUnit) {
    return {
      message: `You may not have more than ${config.maxComponentsPerUnit} components`,
      conditionText: `(component_count_total > ${config.maxComponentsPerUnit})`,
    };
  }

  const properties = getUnitProperties(config, componentIds);
  const componentCounts = countComponents(componentIds);

  for (const invalidCondition of config.invalidConditions) {
    try {
      if (
        evalCondition(
          invalidCondition.condition,
          properties,
          componentCounts,
        ) !== 0
      ) {
        return {
          message: invalidCondition.message,
          conditionText: conditionToC(invalidCondition.condition),
        };
      }
    }
    catch (error) {
      return {
        message: `Invalid condition config: ${error instanceof Error ? error.message : "unknown error"}`,
        conditionText: conditionToC(invalidCondition.condition),
      };
    }
  }

  return null;
}

export function getChangedProperties(
  before: UnitProperties,
  after: UnitProperties,
) {
  return UNIT_PROPERTY_NAMES.filter(name => before[name] !== after[name]);
}
