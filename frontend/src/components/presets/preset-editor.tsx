import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { useForm } from '@tanstack/react-form'
import { useStore } from '@tanstack/react-store'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useBlocker, useNavigate } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  invalidatePresets,
  getAdminPreset,
  getAdminInstallations,
  createPreset,
  updatePreset,
  presetError,
  isVersionConflict,
} from '@/app/actions/presets'
import { adminPresetsQuery } from '@/components/presets/queries'
import type {
  PresetDetail,
  PresetInput,
  PresetSettings,
  Schedule,
} from '@/app/actions/presets'
import {
  FieldFrame,
  SettingsFields,
  SettingsSection,
  PresetWarnings,
  labels,
  numberValue,
  numberInput,
  TemplatesFields,
  ValidationErrors,
  issueMessages,
} from '@/components/presets/settings-fields'
import {
  changedFields,
  defaultSettings,
  issueField,
  presetSettingsSchema,
  scheduleStartSchema,
  scheduleDates,
  templatesSchema,
  same,
} from '@/components/presets/settings'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const DISCARD = 'Discard your unsaved preset edits?'
const scheduleKeys = [
  'startOffsetDays',
  'startTime',
  'submissionDeadlineAfterHours',
  'scheduledEndAfterHours',
  'endAfterHours',
] as const
const settingKeys = (...keys: string[]) => keys.map((key) => `settings.${key}`)
/** The editor's sections and the field keys (see `fieldValues`) in each. */
const editorSections = [
  {
    id: 'basics',
    label: 'Basics',
    fields: ['name', 'description', 'isDefault'],
  },
  {
    id: 'details',
    label: 'Event details',
    fields: settingKeys('description', 'location'),
  },
  {
    id: 'schedule',
    label: 'Schedule',
    fields: settingKeys(...scheduleKeys.map((key) => `schedule.${key}`)),
  },
  {
    id: 'streams',
    label: 'Streams & intro',
    fields: settingKeys(
      'introEnabled',
      'introLeadMinutes',
      'streamUrl',
      'showtimeStreamUrl',
    ),
  },
  {
    id: 'teams',
    label: 'Teams',
    fields: settingKeys('minTeamSize', 'maxTeamSize'),
  },
  {
    id: 'versions',
    label: 'Game versions',
    fields: settingKeys(
      'monorepoUrl',
      'monorepoVersion',
      'basePath',
      'gameConfig',
      'serverConfig',
      'gameServerDockerImage',
      'myCoreBotDockerImage',
      'visualizerDockerImage',
    ),
  },
  {
    id: 'github',
    label: 'GitHub',
    fields: ['starterTemplates', 'githubInstallationId'],
  },
]
const presetSchema = z.object({
  name: z.string().min(3).max(100),
  settings: presetSettingsSchema,
  starterTemplates: templatesSchema,
})
const sectionIds = editorSections.map((s) => `preset-${s.id}`)
const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`

type Snapshot = {
  token: number
  snapshot?: PresetDetail | null
  failed?: boolean
}

/** Loads a preset, or the default preset as a new preset's start, and edits it. */
export function PresetEditorPage({ id }: { id?: string }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const list = useQuery(adminPresetsQuery)
  const [load, setLoad] = useState<Snapshot>({ token: 0 })
  const latest = useRef(0)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  // The editor keeps its snapshot; refetches only change it on reload.
  const fetchSnapshot = useCallback(async () => {
    const token = ++latest.current
    setLoad((current) => ({ ...current, failed: false }))
    try {
      const sourceId =
        id ??
        (await client.ensureQueryData(adminPresetsQuery)).find(
          (row) => row.isDefault,
        )?.id
      const snapshot = sourceId
        ? await client.fetchQuery({
            queryKey: ['admin', 'preset', sourceId],
            queryFn: () => getAdminPreset(sourceId),
            staleTime: 0,
          })
        : null
      if (latest.current === token) setLoad({ token, snapshot })
    } catch {
      if (latest.current === token)
        setLoad((current) => ({ ...current, failed: true }))
    }
  }, [client, id])
  useEffect(() => {
    void fetchSnapshot()
  }, [fetchSnapshot])
  const defaultId = list.data?.find((row) => row.isDefault)?.id
  const compare = Boolean(id && load.snapshot && !load.snapshot.isDefault)
  const reference = useQuery({
    queryKey: ['admin', 'preset', defaultId],
    queryFn: () => getAdminPreset(defaultId!),
    enabled: compare && Boolean(defaultId),
  })
  if (load.failed)
    return (
      <main className="container mx-auto px-4 py-8">
        <p role="alert">
          {id ? 'Could not load preset.' : 'Could not load default preset.'}{' '}
          <Button onClick={() => void fetchSnapshot()}>Retry</Button>
        </p>
      </main>
    )
  if (load.snapshot === undefined) return <Spinner />
  return (
    <PresetEditor
      key={load.token}
      preset={id ? (load.snapshot ?? undefined) : undefined}
      defaults={id ? undefined : (load.snapshot ?? undefined)}
      reference={compare ? reference.data : undefined}
      referenceFailed={
        compare && (reference.isError || (list.isSuccess && !defaultId))
      }
      eventCount={list.data?.find((row) => row.id === id)?.eventCount}
      onReload={() => void fetchSnapshot()}
      onSaved={async () => {
        await invalidatePresets(client)
        toast.success('Preset saved.')
        // A late save must not leave the page the admin moved on to.
        if (mounted.current) await navigate({ to: '/admin/presets' })
      }}
    />
  )
}

export function PresetEditor({
  preset,
  defaults,
  reference,
  referenceFailed = false,
  eventCount,
  onSaved,
  onReload,
}: {
  preset?: PresetDetail
  /** A new preset's starting values: the default preset. */
  defaults?: PresetDetail
  /** The default preset an edited preset is compared with. */
  reference?: PresetDetail
  /** The default preset could not be loaded to compare with. */
  referenceFailed?: boolean
  eventCount?: number
  onSaved: () => Promise<void>
  onReload?: () => void
}) {
  const installations = useQuery({
    queryKey: ['admin', 'github-installations'],
    queryFn: getAdminInstallations,
  })
  // Presets can only save shared, active installations.
  const linkable = installations.data?.filter(
    (i) => i.sharedAt && i.status === 'active',
  )
  const [errors, setErrors] = useState<string[]>([])
  const saved = useRef(false)
  const mutation = useMutation({
    mutationFn: (input: PresetInput) =>
      preset
        ? updatePreset(preset.id, { ...input, version: preset.version })
        : createPreset(input),
    onSuccess: async () => {
      saved.current = true
      await onSaved()
    },
  })
  const source = preset ?? defaults
  const initialValues = {
    name: preset?.name ?? '',
    description: preset?.description ?? '',
    isDefault: preset?.isDefault ?? false,
    settings: source?.settings ?? defaultSettings,
    starterTemplates: source?.starterTemplates ?? [],
    githubInstallationId:
      source?.githubInstallation?.id ?? (null as string | null),
  }
  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      const result = presetSchema.safeParse(value)
      setErrors(result.success ? [] : issueMessages(result.error.issues))
      if (result.success)
        await mutation.mutateAsync(value).catch(() => undefined)
    },
  })
  const values = useStore(form.store, (state) => state.values)
  const dirty = !same(values, initialValues)
  useBlocker({
    shouldBlockFn: ({ current, next }) =>
      current.pathname !== next.pathname &&
      dirty &&
      !saved.current &&
      !window.confirm(DISCARD),
    enableBeforeUnload: dirty,
  })

  // New presets and other presets compare with the default preset, the
  // default preset itself with its saved version.
  const against = preset?.isDefault ? undefined : preset ? reference : defaults
  // Until the default loads, an edited preset compares with its saved values.
  const comparing = Boolean(preset && !preset.isDefault && !reference)
  const resetTo = against ? 'default' : 'saved value'
  const baseline = against
    ? {
        ...values,
        settings: against.settings,
        starterTemplates: against.starterTemplates,
        githubInstallationId: against.githubInstallation?.id ?? null,
      }
    : initialValues
  const changed = changedFields(values, baseline)
  const isChanged = (key: string) => changed.includes(key)
  const parsed = presetSchema.safeParse(values)
  const invalid = new Set(
    parsed.success ? [] : parsed.error.issues.map((i) => issueField(i.path)),
  )
  const warnings =
    source && values.githubInstallationId === source.githubInstallation?.id
      ? source.warnings
      : []
  const sections = editorSections.map((section) => ({
    ...section,
    changes: section.fields.filter(isChanged).length,
    flagged:
      section.fields.some((key) => invalid.has(key)) ||
      (section.id === 'github' && warnings.length > 0),
  }))

  const schedule = values.settings.schedule
  const changeSchedule = (key: keyof Schedule, value: unknown) =>
    form.setFieldValue('settings', {
      ...values.settings,
      schedule: { ...schedule, [key]: value },
    })
  const scheduleInput = (key: keyof Schedule, value: string) =>
    changeSchedule(
      key,
      key === 'startTime'
        ? value
        : value === '' && key !== 'startOffsetDays'
          ? undefined
          : numberValue(value),
    )
  // The default's installation may be offered by a reset.
  const known = [source?.githubInstallation, against?.githubInstallation]
    .filter((i) => i != null)
    .filter(
      (i, index, all) =>
        all.findIndex((other) => other.id === i.id) === index &&
        !linkable?.some((l) => l.id === i.id),
    )

  const header = useRef<HTMLElement>(null)
  const [headerHeight, setHeaderHeight] = useState(0)
  // Measured before paint, so the sticky columns never start at a wrong offset.
  useLayoutEffect(() => {
    const element = header.current
    if (!element) return
    setHeaderHeight(element.offsetHeight)
    const observer = new ResizeObserver(() =>
      setHeaderHeight(element.offsetHeight),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const [current, setCurrent] = useScrollSpy(sectionIds)
  // Below the site navbar (4rem plus its 1px border) and this page's header,
  // plus the grid's top padding (py-6), so the side columns stick where they
  // already are instead of jumping when scrolling starts.
  const offset = `calc(4rem + 1px + ${headerHeight}px + 1.5rem)`
  const title = preset?.name ?? 'New preset'

  return (
    <form
      style={{ '--sticky-offset': offset } as CSSProperties}
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <header
        ref={header}
        className="sticky top-[calc(4rem+1px)] z-30 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80"
      >
        <div className="container mx-auto flex flex-wrap items-end justify-between gap-4 px-4 py-4">
          <div className="min-w-0 space-y-1">
            <nav aria-label="Breadcrumb" className="text-sm">
              <ol className="flex gap-1 text-muted-foreground">
                <li>
                  <Link to="/admin/presets" className="hover:underline">
                    Event presets
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="truncate text-foreground">
                  {title}
                </li>
              </ol>
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{title}</h1>
              <Pill>
                {preset
                  ? `v${preset.version}${eventCount === undefined ? '' : ` · ${plural(eventCount, 'event')}`}`
                  : 'Draft'}
              </Pill>
              <Pill tone="info">
                {comparing
                  ? referenceFailed
                    ? 'Could not load the default to compare'
                    : 'Comparing with default…'
                  : against
                    ? `${plural(changed.length, 'change')} from default`
                    : plural(changed.length, 'unsaved change')}
              </Pill>
              {preset && warnings.length > 0 && (
                <Pill tone="warning" title={warnings.join(' ')}>
                  {plural(warnings.length, 'warning')}
                </Pill>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!dirty || mutation.isPending}
              onClick={() => {
                if (!window.confirm(DISCARD)) return
                form.reset()
                setErrors([])
                mutation.reset()
              }}
            >
              Discard
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || isVersionConflict(mutation.error)}
            >
              {preset ? `Save as v${preset.version + 1}` : 'Create preset'}
            </Button>
          </div>
        </div>
      </header>
      <div className="container mx-auto grid gap-6 px-4 py-6 xl:grid-cols-[13rem_minmax(0,1fr)_20rem]">
        <nav
          aria-label="Sections"
          className="sticky top-(--sticky-offset) z-20 -mx-4 self-start overflow-x-auto bg-background px-4 py-1 xl:mx-0 xl:px-0 xl:py-0"
        >
          <ul className="flex gap-1 xl:flex-col">
            {sections.map((section) => {
              const id = `preset-${section.id}`
              return (
                <li key={section.id}>
                  <a
                    href={`#${id}`}
                    aria-current={current === id ? 'location' : undefined}
                    onClick={(event) => {
                      // A hash navigation would run the router's blocker.
                      event.preventDefault()
                      document.getElementById(id)?.scrollIntoView()
                      setCurrent(id)
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:bg-muted',
                      current === id && 'bg-muted font-medium text-foreground',
                    )}
                  >
                    <span className="flex-1">{section.label}</span>
                    {section.flagged && (
                      <>
                        <TriangleAlert
                          className="size-3.5 text-amber-500"
                          aria-hidden="true"
                        />
                        <span className="sr-only">, has issues</span>
                      </>
                    )}
                    {section.changes > 0 && (
                      <span className="rounded-full bg-info/15 px-1.5 text-xs text-info">
                        {section.changes}
                        <span className="sr-only">
                          {section.changes === 1 ? ' change' : ' changes'}
                        </span>
                      </span>
                    )}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="min-w-0 space-y-6">
          <SettingsSection id="preset-basics" title="Basics">
            <FieldFrame
              label="Preset name"
              htmlFor="preset-name"
              changed={isChanged('name')}
              resetTo={resetTo}
              onReset={() => form.setFieldValue('name', baseline.name)}
            >
              <Input
                id="preset-name"
                value={values.name}
                onChange={(e) => form.setFieldValue('name', e.target.value)}
              />
            </FieldFrame>
            <FieldFrame
              label="Preset description"
              htmlFor="preset-description"
              changed={isChanged('description')}
              resetTo={resetTo}
              onReset={() =>
                form.setFieldValue('description', baseline.description)
              }
            >
              <Textarea
                id="preset-description"
                value={values.description}
                onChange={(e) =>
                  form.setFieldValue('description', e.target.value)
                }
              />
            </FieldFrame>
            <FieldFrame
              label="Default preset"
              htmlFor="preset-default"
              changed={isChanged('isDefault')}
              resetTo={resetTo}
              onReset={() =>
                form.setFieldValue('isDefault', baseline.isDefault)
              }
            >
              <Switch
                id="preset-default"
                checked={values.isDefault}
                // Creation without a preset needs a default, so the default is
                // only moved by marking another preset as default.
                disabled={preset?.isDefault}
                onCheckedChange={(checked) =>
                  form.setFieldValue('isDefault', checked)
                }
              />
            </FieldFrame>
          </SettingsSection>
          <SettingsFields
            value={values.settings}
            baseline={baseline.settings}
            admin={{ resetTo }}
            onChange={(next) => form.setFieldValue('settings', next)}
            scheduleFields={
              <div className="grid gap-4 md:grid-cols-2">
                {scheduleKeys.map((key) => (
                  <FieldFrame
                    key={key}
                    label={labels[key]}
                    htmlFor={`schedule-${key}`}
                    changed={isChanged(`settings.schedule.${key}`)}
                    resetTo={resetTo}
                    onReset={() =>
                      changeSchedule(key, baseline.settings.schedule[key])
                    }
                  >
                    <Input
                      id={`schedule-${key}`}
                      {...(key === 'startTime'
                        ? { type: 'time' }
                        : {
                            type: 'number',
                            min: 0,
                            step: key === 'startOffsetDays' ? 1 : 'any',
                            max: key === 'startOffsetDays' ? 365 : undefined,
                          })}
                      value={
                        key === 'startTime'
                          ? schedule.startTime
                          : numberInput(schedule[key])
                      }
                      onChange={(e) => scheduleInput(key, e.target.value)}
                    />
                  </FieldFrame>
                ))}
              </div>
            }
          />
          <SettingsSection id="preset-github" title="GitHub Integration">
            <FieldFrame
              label="starter templates"
              changed={isChanged('starterTemplates')}
              resetTo={resetTo}
              onReset={() =>
                form.setFieldValue(
                  'starterTemplates',
                  baseline.starterTemplates,
                )
              }
            >
              <TemplatesFields
                value={values.starterTemplates}
                onChange={(next) =>
                  form.setFieldValue('starterTemplates', next)
                }
              />
            </FieldFrame>
            <FieldFrame
              label="Shared GitHub installation"
              htmlFor="shared-installation"
              changed={isChanged('githubInstallationId')}
              resetTo={resetTo}
              onReset={() =>
                form.setFieldValue(
                  'githubInstallationId',
                  baseline.githubInstallationId,
                )
              }
            >
              <select
                id="shared-installation"
                className="w-full rounded border bg-background p-2"
                value={values.githubInstallationId ?? ''}
                onChange={(e) =>
                  form.setFieldValue(
                    'githubInstallationId',
                    e.target.value || null,
                  )
                }
              >
                <option value="">None</option>
                {known.map((i) => (
                  <option key={i.id} disabled={Boolean(linkable)} value={i.id}>
                    {i.accountLogin}
                    {linkable ? ' (unavailable)' : ''}
                  </option>
                ))}
                {linkable?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.accountLogin}
                  </option>
                ))}
              </select>
            </FieldFrame>
            <PresetWarnings warnings={warnings} />
            {installations.isError && (
              <p role="alert">
                Could not load shared installations.{' '}
                <Button
                  type="button"
                  onClick={() => void installations.refetch()}
                >
                  Retry
                </Button>
              </p>
            )}
          </SettingsSection>
          <ValidationErrors messages={errors} />
          {mutation.isError && (
            <p role="alert">
              {presetError(mutation.error)}{' '}
              {isVersionConflict(mutation.error) && (
                <Button type="button" variant="outline" onClick={onReload}>
                  Reload preset and discard edits
                </Button>
              )}
            </p>
          )}
        </div>
        <aside className="self-start xl:sticky xl:top-(--sticky-offset)">
          <PresetPreview
            settings={values.settings}
            warnings={warnings}
            invalid={sections.filter((s) => s.flagged && s.id !== 'github')}
          />
        </aside>
      </div>
    </form>
  )
}

function Pill({
  tone,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: 'info' | 'warning' }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tone === 'info' && 'border-info/40 bg-info/10 text-info',
        tone === 'warning' &&
          'border-amber-500/50 text-amber-700 dark:text-amber-400',
        className,
      )}
      {...props}
    />
  )
}

/** The first of `ids` in a reading band near the top of the viewport. */
function useScrollSpy(ids: readonly string[]) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        const first = ids.find((id) => visible.has(id))
        if (first) setActive(first)
      },
      { rootMargin: '-25% 0px -65% 0px' },
    )
    for (const id of ids) {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [ids])
  return [active, setActive] as const
}

const berlin = (date: Date, options: Intl.DateTimeFormatOptions) =>
  date.toLocaleString('en-GB', { timeZone: 'Europe/Berlin', ...options })
const day = { weekday: 'short', day: 'numeric', month: 'short' } as const
const time = { hour: '2-digit', minute: '2-digit' } as const
/** An image's tag, which Docker defaults to latest. */
function imageTag(image: string) {
  const name = image.slice(image.lastIndexOf('/') + 1)
  const colon = name.lastIndexOf(':')
  return colon < 0 ? 'latest' : name.slice(colon + 1)
}

/** What an event created from the current values today would get. */
function PresetPreview({
  settings,
  warnings,
  invalid,
}: {
  settings: PresetSettings
  warnings: readonly string[]
  invalid: { id: string; label: string }[]
}) {
  const valid = scheduleStartSchema.safeParse(settings.schedule).success
  const dates = valid ? scheduleDates(settings.schedule) : undefined
  const lead = settings.introLeadMinutes
  const intro =
    dates && settings.introEnabled && lead != null && Number.isFinite(lead)
      ? new Date(dates.start.getTime() - lead * 60000)
      : undefined
  const points = (
    dates
      ? [
          ...(intro
            ? [{ label: 'Introduction', date: intro, dot: 'bg-chart-2' }]
            : []),
          { label: 'Start', date: dates.start, dot: 'bg-primary' },
          {
            label: 'Submission deadline',
            date: dates.submissionDeadline,
            dot: 'bg-chart-1',
          },
          {
            label: 'Scheduled end',
            date: dates.scheduledEnd,
            dot: 'bg-chart-3',
          },
          { label: 'End', date: dates.end, dot: 'bg-chart-4' },
        ]
      : []
  ).filter((p) => Number.isFinite(p.date.getTime()))
  const times = points.map((p) => p.date.getTime())
  const first = Math.min(...times)
  const span = Math.max(...times) - first || 1
  const teamSize = [settings.minTeamSize, settings.maxTeamSize]
  const facts: [ReactNode, string][] = []
  if (dates) {
    facts.push(['Date', berlin(dates.start, { ...day, year: 'numeric' })])
    if (!intro) facts.push(['Introduction', 'Off'])
    for (const p of points)
      facts.push([
        <Dot key={p.label} className={p.dot}>
          {p.label}
        </Dot>,
        p.label === 'Introduction' || p.label === 'Start'
          ? berlin(p.date, time)
          : berlin(p.date, { ...day, ...time }),
      ])
  }
  facts.push(
    ['Team size', teamSize.every(Number.isFinite) ? teamSize.join('–') : '—'],
    ['Game server', imageTag(settings.gameServerDockerImage)],
    ['Visualizer', imageTag(settings.visualizerDockerImage)],
  )
  return (
    <Card className="space-y-4 p-6" aria-labelledby="preset-preview">
      <h2 id="preset-preview" className="text-lg font-semibold">
        Preview · if created today
      </h2>
      <p className="text-sm">
        An event created today would start on{' '}
        {dates
          ? berlin(dates.start, {
              ...day,
              year: 'numeric',
              ...time,
              timeZoneName: 'short',
            })
          : 'Enter a valid schedule'}
        .
      </p>
      {points.length > 0 && (
        <div aria-hidden="true" className="relative mx-1.5 h-3">
          <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-border" />
          {points.map((p) => (
            <span
              key={p.label}
              title={p.label}
              className={cn(
                'absolute top-0 size-3 -translate-x-1/2 rounded-full ring-2 ring-card',
                p.dot,
              )}
              style={{ left: `${((p.date.getTime() - first) / span) * 100}%` }}
            />
          ))}
        </div>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {facts.map(([label, value], index) => (
          <div key={index} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Times in Europe/Berlin, like the schedule.
      </p>
      {(warnings.length > 0 || invalid.length > 0) && (
        <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-400">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
          {invalid.length > 0 && (
            <li>Check {invalid.map((s) => s.label).join(', ')}.</li>
          )}
        </ul>
      )}
    </Card>
  )
}
function Dot({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn('size-2 rounded-full', className)}
      />
      {children}
    </span>
  )
}
