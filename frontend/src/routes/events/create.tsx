import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useStore } from '@tanstack/react-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createFileRoute,
  Link,
  Navigate,
  useNavigate,
} from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  getPresets,
  resolvePreset,
  getCreateInstallations,
  presetError,
} from '@/app/actions/presets'
import type { ResolvedPreset } from '@/app/actions/presets'
import { createEvent } from '@/app/actions/event'
import { useSession } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  SettingsFields,
  SettingsSection,
  TemplatesFields,
  Reset,
  ValidationErrors,
  issueMessages,
} from '@/components/presets/settings-fields'
import {
  changedValues,
  createPayload,
  resolvedValues,
  nameSchema,
  eventSettingsSchema,
  templatesSchema,
} from '@/components/presets/settings'

export const Route = createFileRoute('/events/create')({
  component: CreateEventRoute,
})
function CreateEventRoute() {
  const { data: session, status } = useSession()
  if (status === 'loading') return <Spinner />
  if (!session?.user.abilities.createEvent)
    return <Navigate to="/events" replace />
  return <CreateEventPage />
}
export function CreateEventPage() {
  const presets = useQuery({ queryKey: ['event-presets'], queryFn: getPresets })
  const [selected, setSelected] = useState('')
  const [name, setName] = useState('')
  const id =
    selected ||
    presets.data?.find((p) => p.isDefault)?.id ||
    presets.data?.[0]?.id ||
    ''
  const resolved = useQuery({
    queryKey: ['resolved-preset', id],
    queryFn: () => resolvePreset(id),
    enabled: Boolean(id),
    staleTime: Infinity,
  })
  const [dirty, setDirty] = useState(false)
  return (
    <main className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Create event</h1>
      <label htmlFor="preset">Preset</label>
      <select
        id="preset"
        className="w-full rounded border bg-background p-2"
        value={id}
        onChange={(e) => {
          if (
            dirty &&
            !window.confirm('Discard your settings edits and switch presets?')
          )
            return
          setDirty(false)
          setSelected(e.target.value)
        }}
      >
        {presets.data?.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.isDefault ? ' (default)' : ''}
          </option>
        ))}
      </select>
      {presets.data?.find((p) => p.id === id)?.description && (
        <p>{presets.data.find((p) => p.id === id)?.description}</p>
      )}
      {presets.isPending || (id && resolved.isPending) ? <Spinner /> : null}
      {presets.isError || resolved.isError ? (
        <p role="alert">
          Could not load presets.{' '}
          <Button
            onClick={() => {
              // refetch() ignores `enabled`, so only retry what failed.
              if (presets.isError) void presets.refetch()
              if (resolved.isError) void resolved.refetch()
            }}
          >
            Retry
          </Button>
        </p>
      ) : null}
      {presets.data?.length === 0 && (
        <p>No presets available. Ask an administrator to create one.</p>
      )}
      {resolved.data && (
        <CreatePresetForm
          // A refetch that returns a newer preset version must not leave the
          // form comparing old values against the new baseline.
          key={`${resolved.data.presetId}-${resolved.data.presetVersion}`}
          preset={resolved.data}
          name={name}
          onName={setName}
          onDirty={setDirty}
        />
      )}
    </main>
  )
}
function CreatePresetForm({
  preset,
  onDirty,
  name,
  onName,
}: {
  name: string
  onName: (name: string) => void
  preset: ResolvedPreset
  onDirty: (dirty: boolean) => void
}) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const baseline = resolvedValues(preset)
  const [adjust, setAdjust] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const installations = useQuery({
    queryKey: ['create-installations'],
    queryFn: getCreateInstallations,
  })
  const mutation = useMutation({
    mutationFn: createEvent,
    onSuccess: async (event) => {
      toast.success('Event created.')
      await client.invalidateQueries({ queryKey: ['events'] })
      await navigate({ to: '/events/$id/dashboard', params: { id: event.id } })
    },
  })
  const form = useForm({
    defaultValues: { name, ...baseline },
    onSubmit: async ({ value }) => {
      const results = [
        [nameSchema.safeParse(value.name), 'Name'],
        [eventSettingsSchema.safeParse(value.settings), ''],
        [
          templatesSchema.safeParse(value.starterTemplates),
          'Starter templates',
        ],
      ] as const
      const messages = results.flatMap(([r, label]) =>
        r.success ? [] : issueMessages(r.error.issues, label),
      )
      setErrors(messages)
      // The failing field may be hidden behind "Adjust settings".
      if (messages.length) setAdjust(true)
      if (!messages.length)
        await mutation
          .mutateAsync(createPayload(value.name, preset, value))
          .catch(() => undefined)
    },
  })
  const values = useStore(form.store, (s) => s.values)
  // A remount (new preset or version) starts from the preset again.
  useEffect(() => () => onDirty(false), [onDirty])
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      onChange={() => mutation.reset()}
    >
      <label htmlFor="event-name">Name</label>
      <Input
        id="event-name"
        placeholder="Enter event name"
        value={values.name}
        onChange={(e) => {
          form.setFieldValue('name', e.target.value)
          onName(e.target.value)
        }}
      />
      <Button
        type="button"
        variant="outline"
        aria-expanded={adjust}
        onClick={() => setAdjust(!adjust)}
      >
        Adjust settings
      </Button>
      {adjust && (
        <div className="space-y-6 rounded border p-4">
          <SettingsFields
            value={values.settings}
            baseline={baseline.settings}
            onChange={(next) => {
              form.setFieldValue('settings', next)
              onDirty(changedValues({ ...values, settings: next }, baseline))
            }}
          />
          <SettingsSection title="GitHub Integration">
            <label htmlFor="installation">GitHub installation</label>
            <Reset
              label="GitHub installation"
              changed={
                values.githubInstallationId !== baseline.githubInstallationId
              }
              onReset={() => {
                form.setFieldValue(
                  'githubInstallationId',
                  baseline.githubInstallationId,
                )
                onDirty(
                  changedValues(
                    {
                      ...values,
                      githubInstallationId: baseline.githubInstallationId,
                    },
                    baseline,
                  ),
                )
              }}
            />
            <select
              id="installation"
              className="w-full rounded border bg-background p-2"
              value={values.githubInstallationId ?? ''}
              onChange={(e) => {
                const id = e.target.value || null
                form.setFieldValue('githubInstallationId', id)
                onDirty(
                  changedValues(
                    { ...values, githubInstallationId: id },
                    baseline,
                  ),
                )
              }}
            >
              <option value="">Connect later</option>
              {preset.githubInstallation &&
                !installations.data?.some(
                  (i) => i.id === preset.githubInstallation?.id,
                ) && (
                  <option value={preset.githubInstallation.id}>
                    {preset.githubInstallation.accountLogin} (preset)
                  </option>
                )}
              {installations.data?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.accountLogin}
                  {i.shared ? ' (shared)' : ''}
                </option>
              ))}
            </select>
            {installations.isError && (
              <p role="alert">
                Could not load installations.{' '}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void installations.refetch()}
                >
                  Retry
                </Button>
              </p>
            )}
          </SettingsSection>
          <TemplatesFields
            value={values.starterTemplates}
            baseline={baseline.starterTemplates}
            onChange={(next) => {
              form.setFieldValue('starterTemplates', next)
              onDirty(
                changedValues({ ...values, starterTemplates: next }, baseline),
              )
            }}
          />
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Events start private. You can publish them from event settings.
      </p>
      <ValidationErrors messages={errors} />
      {mutation.isError && <p role="alert">{presetError(mutation.error)}</p>}
      <Button asChild variant="outline">
        <Link to="/events">Cancel</Link>
      </Button>
      <Button
        type="submit"
        disabled={mutation.isPending || !values.name.trim()}
      >
        {mutation.isPending ? 'Creating…' : 'Create'}
      </Button>
    </form>
  )
}
