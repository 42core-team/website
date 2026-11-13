import type {
  EventSettings,
  PresetSettings,
  StarterTemplate,
} from '@/app/actions/presets'
import { settingsShape, same } from './settings'
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
export function SettingsFields<T extends EventSettings | PresetSettings>({
  value,
  onChange,
  baseline,
}: {
  value: T
  onChange: (next: T) => void
  baseline?: T
}) {
  const keys = [
    ...Object.keys(settingsShape),
    ...('startDate' in value
      ? ['startDate', 'submissionDeadline', 'scheduledEndDate', 'endDate']
      : []),
  ] as (keyof T & string)[]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {keys.map((key) => {
        const current = value[key]
        const date = [
          'startDate',
          'submissionDeadline',
          'scheduledEndDate',
          'endDate',
        ].includes(key)
        const numeric = [
          'minTeamSize',
          'maxTeamSize',
          'introLeadMinutes',
        ].includes(key)
        const change = (next: unknown) => onChange({ ...value, [key]: next })
        return (
          <div
            key={key}
            className={key.endsWith('Config') ? 'md:col-span-2' : ''}
          >
            <label htmlFor={`setting-${key}`}>
              {labels[key] || key}
              {date && (
                <span className="text-sm text-muted-foreground">
                  {' '}
                  (your local time)
                </span>
              )}
            </label>
            {baseline && (
              <Reset
                label={labels[key] || key}
                changed={!same(current, baseline[key])}
                onReset={() => change(baseline[key])}
              />
            )}
            {key === 'introEnabled' ? (
              <Input
                id={`setting-${key}`}
                type="checkbox"
                checked={Boolean(current)}
                onChange={(e) => change(e.target.checked)}
              />
            ) : key.endsWith('Config') || key === 'description' ? (
              <Textarea
                id={`setting-${key}`}
                value={String(current ?? '')}
                onChange={(e) => change(e.target.value)}
              />
            ) : (
              <Input
                id={`setting-${key}`}
                type={date ? 'datetime-local' : numeric ? 'number' : 'text'}
                value={
                  date && typeof current === 'number'
                    ? localDate(current)
                    : String(current ?? '')
                }
                onChange={(e) =>
                  change(
                    date
                      ? e.target.value
                        ? new Date(e.target.value).getTime()
                        : Number.NaN
                      : numeric
                        ? Number(e.target.value)
                        : e.target.value,
                  )
                }
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
function localDate(epoch: number) {
  const date = new Date(epoch)
  return new Date(epoch - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
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
export function ValidationErrors({ messages }: { messages: string[] }) {
  return messages.length ? (
    <ul role="alert" className="text-destructive">
      {messages.map((message, i) => (
        <li key={i}>{message}</li>
      ))}
    </ul>
  ) : null
}
