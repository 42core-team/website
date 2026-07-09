import type { PointerEvent as ReactPointerEvent } from 'react'
import type {
  ComponentConfig,
  ComponentsConfig,
  RuleViolation,
  UnitPropertyName,
} from './types'
import { motion } from 'framer-motion'
import { Check, Copy, Plus, X } from 'lucide-react'
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Image from '@/components/app-image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { findViolation, getTotalCost, getUnitProperties } from './rules'
import { UNIT_PROPERTY_NAMES } from './types'
import { getUnitAssetPath, getUnitIconSrc } from './visualizer'

const EMPTY_UNIT_NAME = 'unit_name'
const EMPTY_DISPLAY_NAME = 'Your Unit'
const GOOD_WHEN_SMALLER = new Set<UnitPropertyName>([
  'baseActionCooldown',
  'postSpawnCoreCooldown',
])

interface UnitBuilderProps {
  config: ComponentsConfig
}

interface SelectedComponent {
  key: string
  componentId: string
}

type ImpactTone = 'positive' | 'negative'
type DragTarget = 'assembly' | 'library' | null

interface Highlights {
  cost?: ImpactTone
  properties: Partial<Record<UnitPropertyName, ImpactTone>>
}

interface ActiveDrag {
  source: 'library' | 'assembly'
  item: SelectedComponent
  component: ComponentConfig
  x: number
  y: number
  offsetX: number
  offsetY: number
  fromLeft: number
  fromTop: number
  target: DragTarget
  insertIndex: number | null
}

interface DropGhost {
  key: string
  component: ComponentConfig
  fromLeft: number
  fromTop: number
  toLeft: number
  toTop: number
}

interface PendingDropGhost {
  key: string
  component: ComponentConfig
  fromLeft: number
  fromTop: number
}

function titleize(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function impactForProperty(name: UnitPropertyName, delta: number) {
  if (delta === 0) return undefined

  const improvement = GOOD_WHEN_SMALLER.has(name) ? delta < 0 : delta > 0
  return improvement ? 'positive' : 'negative'
}

function impactForCost(delta: number) {
  if (delta === 0) return undefined

  return delta < 0 ? 'positive' : 'negative'
}

function impactBorder(tone: ImpactTone | undefined) {
  if (tone === 'positive')
    return 'border-emerald-500/70 text-emerald-700 dark:text-emerald-300'
  if (tone === 'negative')
    return 'border-red-500/70 text-red-700 dark:text-red-300'
  return ''
}

function impactColor(tone: ImpactTone | undefined) {
  if (tone === 'positive') return 'rgba(34, 197, 94, 0.52)'
  if (tone === 'negative') return 'rgba(239, 68, 68, 0.52)'
  return 'rgba(0, 0, 0, 0)'
}

function cString(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function showViolation(violation: RuleViolation) {
  window.alert(
    `${violation.message}\n\nThe following condition is forbidden, if a unit fulfills it it is not allowed:\n${violation.conditionText}`,
  )
}

function UnitIcon({
  assetPath,
  className,
  priority,
}: {
  assetPath: string
  className?: string
  priority?: boolean
}) {
  const [src, setSrc] = useState(getUnitIconSrc(assetPath))

  useEffect(() => {
    setSrc(getUnitIconSrc(assetPath))
  }, [assetPath])

  return (
    <Image
      src={src}
      alt={`${assetPath} unit icon`}
      width={180}
      height={180}
      priority={priority}
      unoptimized
      onError={() => setSrc(getUnitIconSrc('fallback'))}
      className={cn('object-contain dark:invert', className)}
    />
  )
}

function ComponentTileVisual({
  component,
  className,
}: {
  component: ComponentConfig
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative flex h-28 w-28 flex-col items-center justify-center rounded-lg border bg-background p-3 text-center shadow-sm',
        className,
      )}
    >
      <UnitIcon
        assetPath={component.visualizer_asset_path}
        className="size-10"
      />
      <span className="mt-2 max-w-full truncate text-xs font-semibold">
        {titleize(component.id)}
      </span>
    </div>
  )
}

function ComponentEffects({
  component,
  className,
}: {
  component: ComponentConfig
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {component.properties.map((property) => {
        const tone = impactForProperty(property.name, property.modification)

        return (
          <Badge
            key={property.name}
            variant="outline"
            className={cn(
              'block min-w-0 max-w-full whitespace-normal break-all text-left font-mono text-[11px] leading-tight',
              impactBorder(tone),
            )}
          >
            {property.modification > 0 ? '+' : ''}
            {property.modification} {property.name}
          </Badge>
        )
      })}
    </div>
  )
}

function insertAt<T>(items: T[], item: T, index: number) {
  const next = [...items]
  next.splice(Math.max(0, Math.min(index, next.length)), 0, item)
  return next
}

function isInside(element: HTMLElement | null, x: number, y: number) {
  if (!element) return false

  const rect = element.getBoundingClientRect()
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function PropertyRow({
  name,
  value,
  tone,
}: {
  name: UnitPropertyName
  value: number
  tone?: ImpactTone
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
                'rgba(0, 0, 0, 0)',
              ],
              scale: [1.015, 1.015, 1],
            }
          : { backgroundColor: 'rgba(0, 0, 0, 0)', scale: 1 }
      }
      transition={
        tone
          ? { duration: 1.55, ease: 'easeOut', times: [0, 0.72, 1] }
          : { duration: 1.55, ease: 'easeOut' }
      }
      className="flex items-center justify-between rounded-md px-3 py-2"
    >
      <span className="truncate pr-3 text-sm text-muted-foreground">
        {name}
      </span>
      <span className="font-mono text-sm font-semibold">{value}</span>
    </motion.div>
  )
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
                'rgba(0, 0, 0, 0)',
              ],
              scale: [1.02, 1.02, 1],
            }
          : { backgroundColor: 'rgba(0, 0, 0, 0)', scale: 1 }
      }
      transition={
        tone
          ? { duration: 1.55, ease: 'easeOut', times: [0, 0.72, 1] }
          : { duration: 1.55, ease: 'easeOut' }
      }
      className="mx-auto w-fit rounded-md px-4 py-2 text-center font-mono text-lg font-semibold"
    >
      💎 {value} gems
    </motion.div>
  )
}

export default function UnitBuilder({ config }: UnitBuilderProps) {
  const nextKey = useRef(0)
  const copiedTimeout = useRef<number | null>(null)
  const libraryGhostTimeout = useRef<number | null>(null)
  const assemblyRef = useRef<HTMLDivElement | null>(null)
  const libraryRef = useRef<HTMLDivElement | null>(null)
  const placeholderRef = useRef<HTMLDivElement | null>(null)
  const tileRefs = useRef(new Map<string, HTMLDivElement>())
  const libraryTileRefs = useRef(new Map<string, HTMLDivElement>())
  const [unitName, setUnitName] = useState('')
  const [copied, setCopied] = useState(false)
  const [selected, setSelected] = useState<SelectedComponent[]>([])
  const [highlights, setHighlights] = useState<Highlights>({
    properties: {},
  })
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null)
  const [dropGhost, setDropGhost] = useState<DropGhost | null>(null)
  const [pendingDropGhost, setPendingDropGhost] =
    useState<PendingDropGhost | null>(null)
  const [ghostedLibraryId, setGhostedLibraryId] = useState<string | null>(null)
  const [dragEnabled, setDragEnabled] = useState(false)

  const componentById = useMemo(
    () =>
      new Map(config.components.map((component) => [component.id, component])),
    [config.components],
  )

  const componentIds = selected.map((component) => component.componentId)
  const unitProperties = getUnitProperties(config, componentIds)
  const totalCost = getTotalCost(config, componentIds)
  const assetPath = getUnitAssetPath(config, componentIds)
  const codeUnitName = unitName.trim() || EMPTY_UNIT_NAME
  const displayUnitName = unitName.trim() || EMPTY_DISPLAY_NAME
  const creationCall = `core_action_createUnit(${[
    cString(codeUnitName),
    ...componentIds.map(cString),
    'NULL',
  ].join(', ')});`

  useEffect(() => {
    const hasHighlights =
      Boolean(highlights.cost) || Object.keys(highlights.properties).length > 0

    if (!hasHighlights) return

    const timeout = window.setTimeout(() => {
      setHighlights({ properties: {} })
    }, 2000)

    return () => window.clearTimeout(timeout)
  }, [highlights])

  useEffect(() => {
    return () => {
      if (copiedTimeout.current) window.clearTimeout(copiedTimeout.current)
      if (libraryGhostTimeout.current)
        window.clearTimeout(libraryGhostTimeout.current)
    }
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      '(any-hover: hover) and (any-pointer: fine)',
    )
    const syncDragMode = () => {
      setDragEnabled(mediaQuery.matches)

      if (!mediaQuery.matches) {
        setActiveDrag(null)
        setGhostedLibraryId(null)
      }
    }

    syncDragMode()
    mediaQuery.addEventListener('change', syncDragMode)

    return () => mediaQuery.removeEventListener('change', syncDragMode)
  }, [])

  useLayoutEffect(() => {
    if (!pendingDropGhost) return

    const targetRect = tileRefs.current
      .get(pendingDropGhost.key)
      ?.getBoundingClientRect()

    if (!targetRect) return

    setDropGhost({
      ...pendingDropGhost,
      toLeft: targetRect.left,
      toTop: targetRect.top,
    })
    setPendingDropGhost(null)
  }, [pendingDropGhost, selected])

  function setAssemblyTileRef(key: string, node: HTMLDivElement | null) {
    if (node) tileRefs.current.set(key, node)
    else tileRefs.current.delete(key)
  }

  function setLibraryTileRef(key: string, node: HTMLDivElement | null) {
    if (node) libraryTileRefs.current.set(key, node)
    else libraryTileRefs.current.delete(key)
  }

  function getSelectionViolation(items: SelectedComponent[]) {
    return findViolation(
      config,
      items.map((component) => component.componentId),
    )
  }

  function commit(next: SelectedComponent[]) {
    const previousProperties = getUnitProperties(config, componentIds)
    const previousCost = getTotalCost(config, componentIds)
    const nextIds = next.map((component) => component.componentId)
    const nextViolation = getSelectionViolation(next)

    if (nextViolation) {
      showViolation(nextViolation)
      return false
    }

    const nextProperties = getUnitProperties(config, nextIds)
    const propertyHighlights: Highlights['properties'] = {}

    for (const name of UNIT_PROPERTY_NAMES) {
      const tone = impactForProperty(
        name,
        nextProperties[name] - previousProperties[name],
      )

      if (tone) propertyHighlights[name] = tone
    }

    setHighlights({
      cost: impactForCost(getTotalCost(config, nextIds) - previousCost),
      properties: propertyHighlights,
    })
    setSelected(next)
    return true
  }

  function addComponentWithFlight(
    component: ComponentConfig,
    violation: RuleViolation | null,
  ) {
    if (violation) {
      showViolation(violation)
      return
    }

    const sourceRect = libraryTileRefs.current
      .get(component.id)
      ?.getBoundingClientRect()
    const item = {
      key: `${component.id}-${nextKey.current++}`,
      componentId: component.id,
    }

    if (sourceRect) {
      setGhostedLibraryId(component.id)
      restoreLibraryGhost()
      setPendingDropGhost({
        key: item.key,
        component,
        fromLeft: sourceRect.left,
        fromTop: sourceRect.top,
      })
    }

    if (!commit([...selected, item])) {
      setPendingDropGhost(null)
      setGhostedLibraryId(null)
    }
  }

  function returnToLibrary(
    drag: ActiveDrag,
    fromLeft = drag.x - drag.offsetX,
    fromTop = drag.y - drag.offsetY,
  ) {
    const targetRect = libraryTileRefs.current
      .get(drag.item.componentId)
      ?.getBoundingClientRect()

    if (!targetRect) return

    setDropGhost({
      key: drag.item.key,
      component: drag.component,
      fromLeft,
      fromTop,
      toLeft: targetRect.left,
      toTop: targetRect.top,
    })
  }

  function removeComponentWithReturn(
    item: SelectedComponent,
    component: ComponentConfig,
  ) {
    const sourceRect = tileRefs.current.get(item.key)?.getBoundingClientRect()
    const targetRect = libraryTileRefs.current
      .get(item.componentId)
      ?.getBoundingClientRect()
    const removed = commit(selected.filter((entry) => entry.key !== item.key))

    if (removed && sourceRect && targetRect) {
      setDropGhost({
        key: item.key,
        component,
        fromLeft: sourceRect.left,
        fromTop: sourceRect.top,
        toLeft: targetRect.left,
        toTop: targetRect.top,
      })
    }
  }

  function getAddViolation(componentId: string) {
    return findViolation(config, [...componentIds, componentId])
  }

  function getRemoveViolation(key: string) {
    return findViolation(
      config,
      selected
        .filter((component) => component.key !== key)
        .map((component) => component.componentId),
    )
  }

  function visibleItemsForDrag(drag: ActiveDrag | null) {
    if (drag?.source !== 'assembly') return selected
    return selected.filter((component) => component.key !== drag.item.key)
  }

  function getInsertionIndex(x: number, y: number, drag: ActiveDrag) {
    const items = visibleItemsForDrag(drag)
    if (items.length === 0) return 0

    const rects = items.flatMap((item, index) => {
      const node = tileRefs.current.get(item.key)
      return node ? [{ index, rect: node.getBoundingClientRect() }] : []
    })

    if (rects.length === 0) return items.length

    const row = rects.filter(
      ({ rect }) => y >= rect.top - 12 && y <= rect.bottom + 12,
    )

    if (row.length > 0) {
      for (const { index, rect } of row) {
        if (x < rect.left + rect.width / 2) return index
      }

      return row[row.length - 1].index + 1
    }

    for (const { index, rect } of rects) {
      if (y < rect.top + rect.height / 2) return index
    }

    return items.length
  }

  function resolveDragTarget(drag: ActiveDrag, x: number, y: number) {
    if (isInside(assemblyRef.current, x, y)) {
      return {
        ...drag,
        x,
        y,
        target: 'assembly' as const,
        insertIndex: getInsertionIndex(x, y, drag),
      }
    }

    if (drag.source === 'assembly' && isInside(libraryRef.current, x, y)) {
      return {
        ...drag,
        x,
        y,
        target: 'library' as const,
        insertIndex: null,
      }
    }

    return { ...drag, x, y, target: null, insertIndex: null }
  }

  function restoreLibraryGhost() {
    if (libraryGhostTimeout.current)
      window.clearTimeout(libraryGhostTimeout.current)

    libraryGhostTimeout.current = window.setTimeout(() => {
      setGhostedLibraryId(null)
    }, 180)
  }

  function startLibraryDrag(
    event: ReactPointerEvent<HTMLElement>,
    component: ComponentConfig,
  ) {
    if (!dragEnabled) return

    event.preventDefault()
    event.stopPropagation()

    if (event.button !== 0) return

    if (libraryGhostTimeout.current)
      window.clearTimeout(libraryGhostTimeout.current)

    const sourceRect = libraryTileRefs.current
      .get(component.id)
      ?.getBoundingClientRect()
    const drag: ActiveDrag = {
      source: 'library',
      item: {
        key: `${component.id}-${nextKey.current++}`,
        componentId: component.id,
      },
      component,
      x: event.clientX,
      y: event.clientY,
      offsetX: 56,
      offsetY: 56,
      fromLeft: sourceRect?.left ?? event.clientX - 56,
      fromTop: sourceRect?.top ?? event.clientY - 56,
      target: null,
      insertIndex: null,
    }

    setGhostedLibraryId(component.id)
    setActiveDrag(resolveDragTarget(drag, event.clientX, event.clientY))
  }

  function startAssemblyDrag(
    event: ReactPointerEvent<HTMLElement>,
    item: SelectedComponent,
    component: ComponentConfig,
    violation: RuleViolation | null,
  ) {
    if (!dragEnabled) return

    event.preventDefault()

    if (event.button !== 0) return

    if (violation) {
      showViolation(violation)
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const drag: ActiveDrag = {
      source: 'assembly',
      item,
      component,
      x: event.clientX,
      y: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      fromLeft: rect.left,
      fromTop: rect.top,
      target: null,
      insertIndex: null,
    }

    setActiveDrag(resolveDragTarget(drag, event.clientX, event.clientY))
  }

  function moveActiveDrag(event: ReactPointerEvent<HTMLElement>) {
    setActiveDrag((drag) =>
      drag ? resolveDragTarget(drag, event.clientX, event.clientY) : drag,
    )
  }

  function finishActiveDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!activeDrag) return

    const drag = resolveDragTarget(activeDrag, event.clientX, event.clientY)
    const visibleItems = visibleItemsForDrag(drag)

    if (drag.target === 'assembly') {
      const next = insertAt(visibleItems, drag.item, drag.insertIndex)
      const violation = getSelectionViolation(next)
      const targetRect = placeholderRef.current?.getBoundingClientRect()

      if (violation) {
        returnToLibrary(drag)
        setActiveDrag(null)
        if (drag.source === 'library') restoreLibraryGhost()
        window.setTimeout(() => showViolation(violation), 190)
        return
      }

      const committed = commit(next)

      if (committed && targetRect) {
        setDropGhost({
          key: drag.item.key,
          component: drag.component,
          fromLeft: drag.x - drag.offsetX,
          fromTop: drag.y - drag.offsetY,
          toLeft: targetRect.left,
          toTop: targetRect.top,
        })
      } else if (!committed) {
        returnToLibrary(drag)
      }
    } else if (drag.target === 'library' && drag.source === 'assembly') {
      const committed = commit(visibleItems)

      if (committed) returnToLibrary(drag)
    } else if (drag.source === 'library') {
      returnToLibrary(drag)
    }

    setActiveDrag(null)

    if (drag.source === 'library') restoreLibraryGhost()
  }

  function cancelActiveDrag() {
    const drag = activeDrag

    setActiveDrag(null)

    if (drag?.source === 'library') {
      returnToLibrary(drag)
      restoreLibraryGhost()
    }
  }

  async function copyCall() {
    await navigator.clipboard.writeText(creationCall)
    setCopied(true)

    if (copiedTimeout.current) window.clearTimeout(copiedTimeout.current)

    copiedTimeout.current = window.setTimeout(() => {
      setCopied(false)
    }, 1400)
  }

  const visibleSelected = visibleItemsForDrag(activeDrag)
  const placeholderIndex =
    activeDrag?.target === 'assembly' && activeDrag.insertIndex !== null
      ? Math.max(0, Math.min(activeDrag.insertIndex, visibleSelected.length))
      : null
  const assemblyDropViolation =
    activeDrag?.target === 'assembly' && placeholderIndex !== null
      ? getSelectionViolation(
          insertAt(visibleSelected, activeDrag.item, placeholderIndex),
        )
      : null

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
                Step 2: Assemble Its Components
              </h2>
              <p className="max-w-2xl text-sm leading-snug text-muted-foreground">
                {(dragEnabled
                  ? 'Drag up the components into the assembly section to apply them to your unit.'
                  : 'Use the plus buttons to add components to your unit and the cross buttons to remove them.') +
                  ' Each component affects multiple of the units properties, which define how your unit will work.'}
              </p>
            </div>

            <div
              ref={assemblyRef}
              className={cn(
                'min-h-52 rounded-xl border-2 border-dashed p-4 transition-colors',
                activeDrag?.target === 'assembly'
                  ? assemblyDropViolation
                    ? 'border-red-500 bg-muted/30'
                    : 'border-emerald-500 bg-muted/30'
                  : 'border-border bg-muted/30',
              )}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold">Assembly</h3>
                <Badge variant="outline">
                  {selected.length} / {config.maxComponentsPerUnit}
                </Badge>
              </div>
              <motion.div layout className="flex min-h-32 flex-wrap gap-3">
                {visibleSelected.map((item, index) => {
                  const component = componentById.get(item.componentId)
                  const violation = getRemoveViolation(item.key)
                  if (!component) return null

                  return (
                    <Fragment key={item.key}>
                      {placeholderIndex === index && (
                        <motion.div
                          ref={placeholderRef}
                          layout
                          transition={{
                            layout: {
                              duration: 0.16,
                              ease: 'easeOut',
                            },
                          }}
                          className="h-28 w-28 rounded-lg border-2 border-dashed border-border bg-muted/50"
                        />
                      )}
                      <motion.div
                        ref={(node) => setAssemblyTileRef(item.key, node)}
                        layout
                        transition={{
                          layout: {
                            duration: 0.16,
                            ease: 'easeOut',
                          },
                        }}
                        onPointerDown={(event) =>
                          startAssemblyDrag(event, item, component, violation)
                        }
                        className={cn(
                          'group relative',
                          dragEnabled
                            ? 'cursor-grab active:cursor-grabbing'
                            : 'cursor-default',
                          dragEnabled && violation && 'cursor-not-allowed',
                          (dropGhost?.key === item.key ||
                            pendingDropGhost?.key === item.key) &&
                            'opacity-0',
                        )}
                      >
                        <ComponentTileVisual
                          component={component}
                          className={cn(
                            dragEnabled &&
                              'transition-shadow group-hover:shadow-md',
                            violation && 'opacity-45 grayscale',
                          )}
                        />
                        <button
                          type="button"
                          aria-label={`Remove ${titleize(component.id)}`}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation()
                            if (violation) showViolation(violation)
                            else removeComponentWithReturn(item, component)
                          }}
                          className={cn(
                            'absolute top-2 right-2 rounded-sm p-0.5 transition-opacity duration-75 focus-visible:opacity-100',
                            dragEnabled
                              ? 'opacity-0 group-hover:opacity-70'
                              : 'opacity-70',
                          )}
                        >
                          <X className="size-3" />
                        </button>
                      </motion.div>
                    </Fragment>
                  )
                })}
                {placeholderIndex === visibleSelected.length && (
                  <motion.div
                    ref={placeholderRef}
                    layout
                    transition={{
                      layout: {
                        duration: 0.16,
                        ease: 'easeOut',
                      },
                    }}
                    className="h-28 w-28 rounded-lg border-2 border-dashed border-border bg-muted/50"
                  />
                )}
              </motion.div>
            </div>

            <div
              ref={libraryRef}
              className={cn(
                'rounded-xl border p-4 transition-colors',
                activeDrag?.target === 'library'
                  ? 'border-border bg-muted/20'
                  : 'bg-background',
              )}
            >
              <h3 className="mb-4 text-base font-semibold">Components</h3>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {config.components.map((component) => {
                  const violation = getAddViolation(component.id)

                  return (
                    <motion.div
                      key={component.id}
                      role="button"
                      tabIndex={0}
                      layout
                      aria-disabled={Boolean(violation)}
                      onPointerDown={(event) =>
                        startLibraryDrag(event, component)
                      }
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        addComponentWithFlight(component, violation)
                      }}
                      whileHover={
                        dragEnabled && !violation ? { y: -3 } : undefined
                      }
                      whileTap={
                        dragEnabled && !violation ? { scale: 0.98 } : undefined
                      }
                      className={cn(
                        'group relative rounded-lg border bg-card p-3 text-left shadow-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        dragEnabled && 'hover:shadow-md',
                        dragEnabled
                          ? 'cursor-grab active:cursor-grabbing'
                          : 'cursor-default',
                        violation && 'opacity-45 grayscale',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          ref={(node) => setLibraryTileRef(component.id, node)}
                          className={cn(
                            'shrink-0 transition-opacity duration-150',
                            dragEnabled
                              ? 'cursor-grab active:cursor-grabbing'
                              : 'cursor-default',
                            ghostedLibraryId === component.id && 'opacity-0',
                          )}
                        >
                          <ComponentTileVisual
                            component={component}
                            className={cn(
                              dragEnabled &&
                                'transition-shadow hover:shadow-md',
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex-1 py-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-muted-foreground">
                              💎 {component.cost} gems
                            </div>
                            <button
                              type="button"
                              aria-label={`Add ${titleize(component.id)}`}
                              onPointerDown={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation()
                                addComponentWithFlight(component, violation)
                              }}
                              className="rounded-md border bg-background p-1 opacity-90 shadow-sm transition-opacity duration-75 hover:opacity-100 focus-visible:opacity-100"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                          <ComponentEffects
                            component={component}
                            className="mt-3"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )
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
                  {copied ? 'Copied' : 'Copy'}
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
              transition={{ duration: 0.2, ease: 'easeOut' }}
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

      {activeDrag && (
        <>
          <div
            className="fixed inset-0 z-40 cursor-grabbing touch-none"
            onPointerMove={moveActiveDrag}
            onPointerUp={finishActiveDrag}
            onPointerCancel={cancelActiveDrag}
          />
          <motion.div
            className="pointer-events-none fixed z-50"
            initial={{
              left: activeDrag.fromLeft,
              top: activeDrag.fromTop,
              scale: 1,
            }}
            animate={{
              left: activeDrag.x - activeDrag.offsetX,
              top: activeDrag.y - activeDrag.offsetY,
              scale: 1.03,
            }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            <ComponentTileVisual
              component={activeDrag.component}
              className="border-primary/30 opacity-100 shadow-2xl ring-2 ring-primary/20"
            />
          </motion.div>
        </>
      )}

      {dropGhost && (
        <motion.div
          key={dropGhost.key}
          initial={{
            left: dropGhost.fromLeft,
            top: dropGhost.fromTop,
            scale: 1.03,
          }}
          animate={{
            left: dropGhost.toLeft,
            top: dropGhost.toTop,
            scale: 1,
          }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onAnimationComplete={() =>
            setDropGhost((current) =>
              current?.key === dropGhost.key ? null : current,
            )
          }
          className="pointer-events-none fixed z-50"
        >
          <ComponentTileVisual
            component={dropGhost.component}
            className="border-primary/30 shadow-2xl ring-2 ring-primary/20"
          />
        </motion.div>
      )}
    </div>
  )
}
