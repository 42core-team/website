import type {
  EventSettings,
  PresetSettings,
  StarterTemplate,
} from '@/app/actions/presets'
import { same } from './settings'
import type { ReactNode } from 'react'
import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarIcon, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export const labels: Record<string, string> = {
  description: 'Description',
  location: 'Location',
  minTeamSize: 'Min team size',
  maxTeamSize: 'Max team size',
  gameServerDockerImage: 'Game server Docker image',
  myCoreBotDockerImage: 'My Core Bot Docker image',
  visualizerDockerImage: 'Visualizer Docker image',
  monorepoUrl: 'Monorepo URL',
  monorepoVersion: 'Monorepo version',
  basePath: 'Base path',
  gameConfig: 'Game configuration',
  serverConfig: 'Server configuration',
  introEnabled: 'Optional introduction',
  introLeadMinutes: 'Introduction lead (minutes)',
  streamUrl: 'Stream URL',
  showtimeStreamUrl: 'Showtime stream URL',
  startDate: 'Start date',
  submissionDeadline: 'Submission deadline',
  scheduledEndDate: 'Scheduled end',
  endDate: 'End date',
}
export function Reset({
  changed,
  onReset,
  label,
}: {
  changed: boolean
  onReset: () => void
  label: string
}) {
  return changed ? (
    <span className="ml-3 text-sm text-muted-foreground">
      Changed{' '}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Reset ${label} to preset`}
        onClick={onReset}
      >
        Reset to preset
      </Button>
    </span>
  ) : null
}
const hints: Record<string, [string, string?]> = {
  description: ['Enter event description'],
  location: ['e.g., Paris, France'],
  monorepoUrl: [
    'https://github.com/42core-team/monorepo',
    'https://github.com/<owner>/<repo>, used to fetch available tags and branches',
  ],
  monorepoVersion: [
    'e.g., dev, v0.0.0.1',
    'Choose a tag or branch, or enter any version. Stored verbatim.',
  ],
  basePath: [
    'bots/c/bot',
    'Relative path in the monorepo where the game logic is located (e.g., bots/c/bot)',
  ],
  gameConfig: [
    '{ "rounds": 100, ... }',
    'Configuration for the game server. Copied from the preset; edit the JSON here.',
  ],
  serverConfig: [
    '{ "replayFolderPaths": ["/workspace/replays"], "timeoutTicks": 30000 }',
    'Server configuration. Copied from the preset; edit the JSON here.',
  ],
  gameServerDockerImage: [
    'e.g., ghcr.io/42core-team/server:dev',
    'Include any image tag, such as dev, latest, or v1.2.3.',
  ],
  myCoreBotDockerImage: ['e.g., ghcr.io/42core-team/my-core-bot:dev'],
  visualizerDockerImage: ['e.g., ghcr.io/42core-team/visualizer:dev'],
  streamUrl: [
    'https://youtube.com/...',
    'Stream URL for the introduction and Showtime.',
  ],
  showtimeStreamUrl: [
    'https://youtube.com/...',
    'Optional, replaces the stream URL during Showtime.',
  ],
  scheduledEndDate: ['', 'Informational scheduled end of the event.'],
}

export function SettingsSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </Card>
  )
}

/** Keep cleared numbers invalid instead of silently turning them into zero. */
export function numberValue(value: string) {
  return value === '' ? Number.NaN : Number(value)
}
export function numberInput(value: number | undefined) {
  return value != null && Number.isFinite(value) ? value : ''
}

function DateTimeField({
  id,
  value,
  onChange,
}: {
  id: string
  value: unknown
  onChange: (value: number) => void
}) {
  const date =
    typeof value === 'number' && Number.isFinite(value)
      ? new Date(value)
      : undefined
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="w-full justify-start text-left font-normal"
        >
          <CalendarIcon />
          {date ? format(date, 'PPP HH:mm') : 'Pick a date and time'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          defaultMonth={date}
          selected={date}
          onSelect={(day) => {
            if (!day) return
            day.setHours(date?.getHours() ?? 0, date?.getMinutes() ?? 0)
            onChange(day.getTime())
          }}
        />
        <div className="space-y-2 border-t p-3">
          <label htmlFor={`${id}-time`}>Time (your local time)</label>
          <Input
            id={`${id}-time`}
            type="time"
            value={date ? format(date, 'HH:mm') : ''}
            onChange={(e) => {
              if (!e.target.value) {
                onChange(Number.NaN)
                return
              }
              const [hours, minutes] = e.target.value.split(':').map(Number)
              const next = new Date(date ?? new Date())
              next.setHours(hours, minutes, 0, 0)
              onChange(next.getTime())
            }}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange(Number.NaN)}
          >
            Clear date
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function SettingsFields<T extends EventSettings | PresetSettings>({
  value,
  onChange,
  baseline,
  scheduleFields,
}: {
  value: T
  onChange: (next: T) => void
  baseline?: T
  scheduleFields?: ReactNode
}) {
  const listId = useId()
  let repo: string | undefined
  try {
    const url = new URL(value.monorepoUrl)
    const parts = url.pathname
      .replace(/\.git$/, '')
      .split('/')
      .filter(Boolean)
    if (url.hostname === 'github.com' && parts.length === 2)
      repo = parts.map(encodeURIComponent).join('/')
  } catch {
    /* A URL in progress has no suggestions yet. */
  }
  const versions = useQuery({
    queryKey: ['github', 'versions', repo],
    enabled: Boolean(repo),
    staleTime: 300000,
    retry: false,
    queryFn: async () => {
      const refs = await Promise.all(
        ['tags', 'branches'].map(async (kind) => {
          const response = await fetch(
            `https://api.github.com/repos/${repo}/${kind}?per_page=100`,
            { headers: { Accept: 'application/vnd.github+json' } },
          )
          if (!response.ok) throw new Error('Could not load versions')
          const rows = (await response.json()) as { name: string }[]
          return rows.map((row) => row.name)
        }),
      )
      return [...new Set(refs.flat())]
    },
  })
  const field = (key: keyof T & string) => {
    const current = value[key]
    const change = (next: unknown) => onChange({ ...value, [key]: next })
    const date = [
      'startDate',
      'submissionDeadline',
      'scheduledEndDate',
      'endDate',
    ].includes(key)
    const numeric = ['minTeamSize', 'maxTeamSize', 'introLeadMinutes'].includes(
      key,
    )
    const id = `setting-${key}`
    const [placeholder, description] = hints[key] ?? []
    return (
      <div key={key} className="space-y-2">
        <div>
          <label htmlFor={id}>
            {labels[key]}
            {date && ' (your local time)'}
          </label>
          {baseline && (
            <Reset
              label={labels[key]}
              changed={!same(current, baseline[key])}
              onReset={() => change(baseline[key])}
            />
          )}
        </div>
        {key === 'introEnabled' ? (
          <Switch id={id} checked={Boolean(current)} onCheckedChange={change} />
        ) : date ? (
          <DateTimeField id={id} value={current} onChange={change} />
        ) : key.endsWith('Config') || key === 'description' ? (
          <Textarea
            id={id}
            aria-describedby={description ? `${id}-hint` : undefined}
            value={String(current ?? '')}
            placeholder={placeholder}
            className={
              key.endsWith('Config') ? 'min-h-50 font-mono text-sm' : 'min-h-24'
            }
            onChange={(e) => change(e.target.value)}
          />
        ) : (
          <Input
            id={id}
            aria-describedby={description ? `${id}-hint` : undefined}
            type={
              numeric
                ? 'number'
                : key.endsWith('Url') && key !== 'monorepoUrl'
                  ? 'url'
                  : 'text'
            }
            min={numeric ? (key === 'introLeadMinutes' ? 0 : 1) : undefined}
            max={key.endsWith('TeamSize') ? 10 : undefined}
            step={numeric ? 1 : undefined}
            value={
              typeof current === 'number'
                ? numberInput(current)
                : String(current ?? '')
            }
            placeholder={placeholder}
            list={key === 'monorepoVersion' ? listId : undefined}
            onChange={(e) =>
              change(numeric ? numberValue(e.target.value) : e.target.value)
            }
          />
        )}
        {description && (
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    )
  }
  const fields = (keys: string[]) =>
    keys.map((key) => field(key as keyof T & string))
  return (
    <div className="space-y-6">
      <SettingsSection title="Event Details">
        {fields(['description', 'location'])}
      </SettingsSection>
      <SettingsSection
        title={scheduleFields ? 'Schedule (Europe/Berlin)' : 'Schedule'}
      >
        {scheduleFields ?? (
          <div className="grid gap-4 md:grid-cols-2">
            {fields([
              'startDate',
              'submissionDeadline',
              'scheduledEndDate',
              'endDate',
            ])}
          </div>
        )}
        {fields([
          'introEnabled',
          'introLeadMinutes',
          'streamUrl',
          'showtimeStreamUrl',
        ])}
      </SettingsSection>
      <SettingsSection title="Team Settings">
        <div className="grid gap-4 md:grid-cols-2">
          {fields(['minTeamSize', 'maxTeamSize'])}
        </div>
      </SettingsSection>
      <SettingsSection title="Version Configuration">
        <div className="grid gap-4 md:grid-cols-2">
          {fields(['monorepoUrl', 'monorepoVersion'])}
        </div>
        {versions.isFetching && <p role="status">Loading tags and branches…</p>}
        {versions.isError && (
          <p role="status">
            Could not load tags and branches. You can still enter any version.{' '}
            <Button
              type="button"
              variant="ghost"
              onClick={() => void versions.refetch()}
            >
              Retry versions
            </Button>
          </p>
        )}
        <datalist id={listId}>
          {versions.data?.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {fields(['basePath', 'gameConfig', 'serverConfig'])}
        <h3 className="text-lg font-semibold">Docker Images Configuration</h3>
        {fields([
          'gameServerDockerImage',
          'myCoreBotDockerImage',
          'visualizerDockerImage',
        ])}
      </SettingsSection>
    </div>
  )
}
const templateLabels = {
  name: 'Name',
  basePath: 'Base path',
  myCoreBotDockerImage: 'My Core Bot Docker image',
}
export function TemplatesFields({
  value,
  onChange,
  baseline,
}: {
  value: StarterTemplate[]
  onChange: (value: StarterTemplate[]) => void
  baseline?: StarterTemplate[]
}) {
  return (
    <fieldset className="space-y-3">
      <legend>
        Starter templates{' '}
        {baseline && (
          <Reset
            label="starter templates"
            changed={!same(value, baseline)}
            onReset={() => onChange(baseline)}
          />
        )}
      </legend>
      {value.map((template, index) => (
        <div key={index} className="flex flex-wrap gap-2">
          {(['name', 'basePath', 'myCoreBotDockerImage'] as const).map(
            (key) => (
              <label key={key}>
                {templateLabels[key]}
                <Input
                  aria-label={`Template ${index + 1} ${key}`}
                  value={template[key]}
                  onChange={(e) =>
                    onChange(
                      value.map((row, i) =>
                        i === index ? { ...row, [key]: e.target.value } : row,
                      ),
                    )
                  }
                />
              </label>
            ),
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            Remove template
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([
            ...value,
            { name: '', basePath: '', myCoreBotDockerImage: '' },
          ])
        }
      >
        Add starter template
      </Button>
    </fieldset>
  )
}
/** Prefixes zod issues with the field label, or `prefix` (e.g. "Name") when given. */
export function issueMessages(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
  prefix = '',
) {
  return issues.map((issue) => {
    const path = issue.path.map(String)
    // Template rows keep their index path, settings show their label.
    const field = path.some((p) => /^\d+$/.test(p))
      ? undefined
      : labels[path[path.length - 1]]
    const label = [prefix, field ?? path.join('.')].filter(Boolean).join(' ')
    return label ? `${label}: ${issue.message}` : issue.message
  })
}
/** The server's warnings about a preset, such as an unavailable installation. */
export function PresetWarnings({ warnings }: { warnings: readonly string[] }) {
  return warnings.length ? (
    <Alert variant="warning" role="status">
      <TriangleAlert className="size-4" aria-hidden="true" />
      <AlertDescription>
        {warnings.map((warning) => (
          <p key={warning}>{warning}</p>
        ))}
      </AlertDescription>
    </Alert>
  ) : null
}
export function ValidationErrors({ messages }: { messages: string[] }) {
  return messages.length ? (
    <ul role="alert" className="text-destructive">
      {messages.map((message, i) => (
        <li key={i}>{message}</li>
      ))}
    </ul>
  ) : null
}
