"use client";

import type { DragEvent } from "react";
import type {
  ComponentConfig,
  ComponentsConfig,
  RuleViolation,
  UnitPropertyName,
} from "./types";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  conditionToC,
  findViolation,
  getTotalCost,
  getUnitProperties,
} from "./rules";
import { UNIT_PROPERTY_NAMES } from "./types";
import { getUnitAssetPath, getUnitIconSrc } from "./visualizer";

const DRAG_TYPE = "application/x-core-unit-builder";
const EMPTY_UNIT_NAME = "unit_name";
const EMPTY_DISPLAY_NAME = "Your Unit";
const GOOD_WHEN_SMALLER = new Set<UnitPropertyName>([
  "baseActionCooldown",
  "postSpawnCoreCooldown",
]);

interface UnitBuilderProps {
  config: ComponentsConfig;
}

interface SelectedComponent {
  key: string;
  componentId: string;
}

type DragPayload =
  | { source: "library"; componentId: string }
  | { source: "assembly"; key: string };

type ImpactTone = "positive" | "negative";

interface Highlights {
  cost?: ImpactTone;
  properties: Partial<Record<UnitPropertyName, ImpactTone>>;
}

function titleize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function impactForProperty(name: UnitPropertyName, delta: number) {
  if (delta === 0) return undefined;

  const improvement = GOOD_WHEN_SMALLER.has(name) ? delta < 0 : delta > 0;
  return improvement ? "positive" : "negative";
}

function impactForCost(delta: number) {
  if (delta === 0) return undefined;

  return delta < 0 ? "positive" : "negative";
}

function impactBorder(tone: ImpactTone | undefined) {
  if (tone === "positive")
    return "border-emerald-500/70 text-emerald-700 dark:text-emerald-300";
  if (tone === "negative")
    return "border-red-500/70 text-red-700 dark:text-red-300";
  return "";
}

function impactColor(tone: ImpactTone | undefined) {
  if (tone === "positive") return "rgba(34, 197, 94, 0.52)";
  if (tone === "negative") return "rgba(239, 68, 68, 0.52)";
  return "rgba(0, 0, 0, 0)";
}

function cString(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function showViolation(violation: RuleViolation) {
  window.alert(
    `${violation.message} [${violation.conditionText} must be true]`,
  );
}

function readPayload(event: DragEvent) {
  try {
    const raw = event.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return null;

    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

function setSmallDragImage(event: DragEvent, component: ComponentConfig) {
  const preview = document.createElement("div");
  const icon = document.createElement("img");
  const label = document.createElement("span");
  const isDark = document.documentElement.classList.contains("dark");

  icon.src = getUnitIconSrc(component.visualizer_asset_path);
  icon.alt = "";
  Object.assign(icon.style, {
    filter: isDark ? "invert(1)" : "none",
    height: "40px",
    objectFit: "contain",
    width: "40px",
  });

  label.textContent = titleize(component.id);
  Object.assign(label.style, {
    display: "block",
    maxWidth: "88px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  });

  Object.assign(preview.style, {
    alignItems: "center",
    background: "var(--background)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.18)",
    color: "var(--foreground)",
    display: "flex",
    flexDirection: "column",
    font: "600 12px system-ui, sans-serif",
    gap: "8px",
    height: "112px",
    justifyContent: "center",
    left: "-1000px",
    padding: "12px",
    position: "fixed",
    textAlign: "center",
    top: "-1000px",
    width: "112px",
    zIndex: "9999",
  });

  preview.append(icon, label);
  document.body.append(preview);
  event.dataTransfer.setDragImage(preview, 24, 24);
  window.setTimeout(() => preview.remove(), 0);
}

function UnitIcon({
  assetPath,
  className,
  priority,
}: {
  assetPath: string;
  className?: string;
  priority?: boolean;
}) {
  const [src, setSrc] = useState(getUnitIconSrc(assetPath));

  useEffect(() => {
    setSrc(getUnitIconSrc(assetPath));
  }, [assetPath]);

  return (
    <Image
      src={src}
      alt={`${assetPath} unit icon`}
      width={180}
      height={180}
      priority={priority}
      unoptimized
      onError={() => setSrc(getUnitIconSrc("fallback"))}
      className={cn("object-contain dark:invert", className)}
    />
  );
}

function ComponentEffects({ component }: { component: ComponentConfig }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {component.properties.map((property) => {
        const tone = impactForProperty(property.name, property.modification);

        return (
          <Badge
            key={property.name}
            variant="outline"
            className={cn("font-mono text-[11px]", impactBorder(tone))}
          >
            {property.modification > 0 ? "+" : ""}
            {property.modification} {property.name}
          </Badge>
        );
      })}
    </div>
  );
}

function PropertyRow({
  name,
  value,
  tone,
}: {
  name: UnitPropertyName;
  value: number;
  tone?: ImpactTone;
}) {
  return (
    <motion.div
      key={`${name}-${value}`}
      initial={
        tone ? { backgroundColor: impactColor(tone), scale: 1.015 } : false
      }
      animate={
        tone
          ? {
              backgroundColor: [
                impactColor(tone),
                impactColor(tone),
                "rgba(0, 0, 0, 0)",
              ],
              scale: [1.015, 1.015, 1],
            }
          : { backgroundColor: "rgba(0, 0, 0, 0)", scale: 1 }
      }
      transition={
        tone
          ? { duration: 1.55, ease: "easeOut", times: [0, 0.72, 1] }
          : { duration: 1.55, ease: "easeOut" }
      }
      className="flex items-center justify-between rounded-md px-3 py-2"
    >
      <span className="truncate pr-3 text-sm text-muted-foreground">
        {name}
      </span>
      <span className="font-mono text-sm font-semibold">{value}</span>
    </motion.div>
  );
}

function SidebarCost({ value, tone }: { value: number; tone?: ImpactTone }) {
  return (
    <motion.div
      key={value}
      initial={
        tone ? { backgroundColor: impactColor(tone), scale: 1.02 } : false
      }
      animate={
        tone
          ? {
              backgroundColor: [
                impactColor(tone),
                impactColor(tone),
                "rgba(0, 0, 0, 0)",
              ],
              scale: [1.02, 1.02, 1],
            }
          : { backgroundColor: "rgba(0, 0, 0, 0)", scale: 1 }
      }
      transition={
        tone
          ? { duration: 1.55, ease: "easeOut", times: [0, 0.72, 1] }
          : { duration: 1.55, ease: "easeOut" }
      }
      className="mx-auto w-fit rounded-md px-4 py-2 text-center font-mono text-lg font-semibold"
    >
      💎 {value} gems
    </motion.div>
  );
}

export default function UnitBuilder({ config }: UnitBuilderProps) {
  const nextKey = useRef(0);
  const copiedTimeout = useRef<number | null>(null);
  const [unitName, setUnitName] = useState("");
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<SelectedComponent[]>([]);
  const [highlights, setHighlights] = useState<Highlights>({ properties: {} });
  const [assemblyHot, setAssemblyHot] = useState(false);
  const [libraryHot, setLibraryHot] = useState(false);

  const componentOrder = useMemo(
    () =>
      new Map(
        config.components.map((component, index) => [component.id, index]),
      ),
    [config.components],
  );

  const componentById = useMemo(
    () =>
      new Map(config.components.map((component) => [component.id, component])),
    [config.components],
  );

  const componentIds = selected.map((component) => component.componentId);
  const unitProperties = getUnitProperties(config, componentIds);
  const totalCost = getTotalCost(config, componentIds);
  const assetPath = getUnitAssetPath(config, componentIds);
  const codeUnitName = unitName.trim() || EMPTY_UNIT_NAME;
  const displayUnitName = unitName.trim() || EMPTY_DISPLAY_NAME;
  const creationCall = `core_action_createUnit(${[
    cString(codeUnitName),
    ...componentIds.map(cString),
    "NULL",
  ].join(", ")});`;

  useEffect(() => {
    const hasHighlights =
      Boolean(highlights.cost) || Object.keys(highlights.properties).length > 0;

    if (!hasHighlights) return;

    const timeout = window.setTimeout(() => {
      setHighlights({ properties: {} });
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [highlights]);

  useEffect(() => {
    return () => {
      if (copiedTimeout.current) window.clearTimeout(copiedTimeout.current);
    };
  }, []);

  function sortSelected(items: SelectedComponent[]) {
    return [...items].sort((a, b) => {
      const byType =
        (componentOrder.get(a.componentId) ?? 0) -
        (componentOrder.get(b.componentId) ?? 0);

      return byType || a.key.localeCompare(b.key);
    });
  }

  function commit(next: SelectedComponent[]) {
    const previousProperties = getUnitProperties(config, componentIds);
    const previousCost = getTotalCost(config, componentIds);
    const nextIds = next.map((component) => component.componentId);
    const nextViolation = findViolation(config, nextIds);

    if (nextViolation) {
      showViolation(nextViolation);
      return;
    }

    const nextProperties = getUnitProperties(config, nextIds);
    const propertyHighlights: Highlights["properties"] = {};

    for (const name of UNIT_PROPERTY_NAMES) {
      const tone = impactForProperty(
        name,
        nextProperties[name] - previousProperties[name],
      );

      if (tone) propertyHighlights[name] = tone;
    }

    setHighlights({
      cost: impactForCost(getTotalCost(config, nextIds) - previousCost),
      properties: propertyHighlights,
    });
    setSelected(sortSelected(next));
  }

  function addComponent(componentId: string) {
    commit([
      ...selected,
      { key: `${componentId}-${nextKey.current++}`, componentId },
    ]);
  }

  function removeComponent(key: string) {
    commit(selected.filter((component) => component.key !== key));
  }

  function getAddViolation(componentId: string) {
    return findViolation(config, [...componentIds, componentId]);
  }

  function getRemoveViolation(key: string) {
    return findViolation(
      config,
      selected
        .filter((component) => component.key !== key)
        .map((component) => component.componentId),
    );
  }

  function startLibraryDrag(
    event: DragEvent,
    component: ComponentConfig,
    violation: RuleViolation | null,
  ) {
    if (violation) {
      event.preventDefault();
      showViolation(violation);
      return;
    }

    event.dataTransfer.setData(
      DRAG_TYPE,
      JSON.stringify({
        source: "library",
        componentId: component.id,
      } satisfies DragPayload),
    );
    event.dataTransfer.effectAllowed = "copy";
    setSmallDragImage(event, component);
  }

  function startAssemblyDrag(
    event: DragEvent,
    key: string,
    violation: RuleViolation | null,
  ) {
    if (violation) {
      event.preventDefault();
      showViolation(violation);
      return;
    }

    event.dataTransfer.setData(
      DRAG_TYPE,
      JSON.stringify({ source: "assembly", key } satisfies DragPayload),
    );
    event.dataTransfer.effectAllowed = "move";
  }

  function dropOnAssembly(event: DragEvent) {
    event.preventDefault();
    setAssemblyHot(false);

    const payload = readPayload(event);
    if (payload?.source === "library") addComponent(payload.componentId);
  }

  function dropOnLibrary(event: DragEvent) {
    event.preventDefault();
    setLibraryHot(false);

    const payload = readPayload(event);
    if (payload?.source === "assembly") removeComponent(payload.key);
  }

  async function copyCall() {
    await navigator.clipboard.writeText(creationCall);
    setCopied(true);

    if (copiedTimeout.current) window.clearTimeout(copiedTimeout.current);

    copiedTimeout.current = window.setTimeout(() => {
      setCopied(false);
    }, 1400);
  }

  return (
    <div className="mx-auto mt-3 mb-10">
      <header className="mb-5 space-y-1">
        <h1 className="text-3xl font-bold">4-Step Unit Builder</h1>
        <p className="max-w-2xl text-sm leading-snug text-muted-foreground">
          Once you&apos;re done, you can copy it right into your code!
          <br />
          For details on how unit assembling works and what each property means,
          check out the wiki.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem] lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Step 1: Name Your Unit</h2>
              <p className="max-w-2xl text-sm leading-snug text-muted-foreground">
                You will be able to filter for your unit using its name when
                building your bot. The name will also be displayed in the
                visualizer.
              </p>
            </div>
            <div className="flex max-w-sm flex-col gap-2">
              <Label htmlFor="unit-name">Unit name</Label>
              <Input
                id="unit-name"
                value={unitName}
                placeholder="Warrior"
                maxLength={32}
                onChange={(event) =>
                  setUnitName(event.target.value.slice(0, 32))
                }
                className="font-mono"
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                Step 2: Assemble Its Abilities
              </h2>
              <p className="max-w-2xl text-sm leading-snug text-muted-foreground">
                Drag up the components into the assembly section to apply them
                to your unit
              </p>
            </div>

            <div
              onDrop={dropOnAssembly}
              onDragOver={(event) => {
                event.preventDefault();
                setAssemblyHot(true);
              }}
              onDragLeave={() => setAssemblyHot(false)}
              className={cn(
                "min-h-52 rounded-xl border-2 border-dashed p-4 transition-colors",
                assemblyHot
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-border bg-muted/30",
              )}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold">Assembly</h3>
                <Badge variant="outline">
                  {selected.length} / {config.maxComponentsPerUnit}
                </Badge>
              </div>
              <motion.div layout className="flex min-h-32 flex-wrap gap-3">
                <AnimatePresence initial={false}>
                  {selected.map((item) => {
                    const component = componentById.get(item.componentId);
                    const violation = getRemoveViolation(item.key);
                    if (!component) return null;

                    return (
                      <motion.button
                        key={item.key}
                        type="button"
                        layout
                        initial={{ opacity: 0, x: 14 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 28 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        draggable
                        aria-disabled={Boolean(violation)}
                        onClick={() =>
                          violation
                            ? showViolation(violation)
                            : removeComponent(item.key)
                        }
                        onDragStartCapture={(event) =>
                          startAssemblyDrag(event, item.key, violation)
                        }
                        className={cn(
                          "group relative flex h-28 w-28 flex-col items-center justify-center rounded-lg border bg-background p-3 text-center shadow-sm transition hover:shadow-md",
                          violation &&
                            "cursor-not-allowed opacity-45 grayscale",
                        )}
                      >
                        <UnitIcon
                          assetPath={component.visualizer_asset_path}
                          className="size-10"
                        />
                        <span className="mt-2 max-w-full truncate text-xs font-semibold">
                          {titleize(component.id)}
                        </span>
                        <X className="absolute top-2 right-2 size-3 opacity-0 transition-opacity group-hover:opacity-70" />
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            </div>

            <div
              onDrop={dropOnLibrary}
              onDragOver={(event) => {
                event.preventDefault();
                setLibraryHot(true);
              }}
              onDragLeave={() => setLibraryHot(false)}
              className={cn(
                "rounded-xl border p-4 transition-colors",
                libraryHot ? "border-sky-500 bg-sky-500/10" : "bg-background",
              )}
            >
              <h3 className="mb-4 text-base font-semibold">Components</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {config.components.map((component) => {
                  const violation = getAddViolation(component.id);

                  return (
                    <motion.button
                      key={component.id}
                      type="button"
                      layout
                      draggable
                      aria-disabled={Boolean(violation)}
                      onClick={() =>
                        violation
                          ? showViolation(violation)
                          : addComponent(component.id)
                      }
                      onDragStartCapture={(event) =>
                        startLibraryDrag(event, component, violation)
                      }
                      whileHover={violation ? undefined : { y: -3 }}
                      whileTap={violation ? undefined : { scale: 0.98 }}
                      className={cn(
                        "group relative min-h-36 rounded-lg border bg-card p-4 text-left shadow-sm transition hover:shadow-md",
                        violation
                          ? "cursor-not-allowed opacity-45 grayscale"
                          : "cursor-grab active:cursor-grabbing",
                      )}
                    >
                      {violation && (
                        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 hidden rounded-md bg-primary px-3 py-2 text-sm leading-snug text-primary-foreground shadow-lg group-hover:block group-focus-visible:block">
                          {violation.message}
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
                          <UnitIcon
                            assetPath={component.visualizer_asset_path}
                            className="size-8"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {titleize(component.id)}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            💎 {component.cost} gems
                          </div>
                        </div>
                      </div>
                      <ComponentEffects component={component} />
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                Step 3: Include It in Your Code
              </h2>
              <p className="text-sm leading-snug text-muted-foreground">
                Copy this into your code and your unit will spawn - provided you
                have enough gems 💎 👀.
              </p>
            </div>
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="flex items-center justify-end border-b p-3">
                <Button type="button" size="sm" onClick={copyCall}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="overflow-x-auto p-3 text-sm">
                <code className="font-mono">{creationCall}</code>
              </pre>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">
              Step 4: Use {displayUnitName} to Annihilate Your Opponents! 🚀💎🔥
            </h2>
          </section>
        </div>

        <Card className="h-fit md:sticky md:top-6">
          <CardHeader className="items-center pb-3 text-center">
            <motion.div
              key={assetPath}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex size-44 items-center justify-center rounded-xl bg-muted"
            >
              <UnitIcon assetPath={assetPath} className="size-32" priority />
            </motion.div>
            <CardTitle className="max-w-full truncate pt-2 text-2xl">
              {displayUnitName}
            </CardTitle>
            <SidebarCost value={totalCost} tone={highlights.cost} />
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-center justify-between rounded-md bg-muted/60 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
              <span>Property</span>
              <span>Value</span>
            </div>
            <div className="space-y-1">
              {UNIT_PROPERTY_NAMES.map((name) => (
                <PropertyRow
                  key={name}
                  name={name}
                  value={unitProperties[name]}
                  tone={highlights.properties[name]}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
