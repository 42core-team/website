import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useStore } from '@tanstack/react-store'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import {
  getAdminPresets,
  getAdminPreset,
  getAdminInstallations,
  createPreset,
  updatePreset,
  duplicatePreset,
  archivePreset,
  unarchivePreset,
  presetError,
  isVersionConflict,
} from '@/app/actions/presets'
import type { PresetDetail, PresetInput, Schedule } from '@/app/actions/presets'
import { AdminGuard } from '@/components/presets/admin-guard'
import {
  SettingsFields,
  TemplatesFields,
  ValidationErrors,
} from '@/components/presets/settings-fields'
import {
  defaultSettings,
  presetSettingsSchema,
  templatesSchema,
  schedulePreview,
} from '@/components/presets/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/admin/presets')({
  component: () => (
    <AdminGuard>
      <PresetsPage />
    </AdminGuard>
  ),
})
export function PresetsPage() {
  const client = useQueryClient()
  const [archived, setArchived] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const rows = useQuery({
    queryKey: ['admin', 'presets', archived],
    queryFn: () => getAdminPresets(archived),
  })
  const detail = useQuery({
    queryKey: ['admin', 'preset', editing],
    queryFn: () => getAdminPreset(editing!),
    enabled: Boolean(editing && editing !== 'new'),
  })
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['admin', 'presets'] })
    await client.invalidateQueries({ queryKey: ['event-presets'] })
  }
  const action = useMutation({
    mutationFn: async ({
      id,
      operation,
    }: {
      id: string
      operation: 'duplicate' | 'archive' | 'unarchive' | 'default'
    }) => {
      if (operation === 'duplicate') return duplicatePreset(id)
      if (operation === 'archive') return archivePreset(id)
      if (operation === 'unarchive') return unarchivePreset(id)
      const preset = await getAdminPreset(id)
      return updatePreset(id, {
        name: preset.name,
        description: preset.description,
        version: preset.version,
        settings: preset.settings,
        starterTemplates: preset.starterTemplates,
        githubInstallationId: preset.githubInstallation?.id ?? null,
        isDefault: true,
      })
    },
    onSuccess: refresh,
  })
  return (
    <main className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Event presets</h1>
      <div className="flex gap-4">
        <Button onClick={() => setEditing('new')}>Create preset</Button>
        <label>
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />{' '}
          Include archived
        </label>
      </div>
      {rows.isPending && <Spinner />}
      {rows.isError && (
        <p role="alert">
          Could not load presets.{' '}
          <Button onClick={() => void rows.refetch()}>Retry</Button>
        </p>
      )}
      {rows.data?.map((row) => (
        <div key={row.id} className="space-y-2 rounded border p-4">
          <strong>{row.name}</strong>{' '}
          {row.isDefault && (
            <span className="rounded bg-accent px-2">Default</span>
          )}{' '}
          {row.archivedAt && <span>Archived</span>}
          <p>
            v{row.version} · {row.eventCount} events · Updated by{' '}
            {row.updatedBy?.username ?? 'Unknown'} ·{' '}
            {new Date(row.updatedAt).toLocaleString()}
          </p>
          <p>{row.description}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing(row.id)}>
              Edit {row.name}
            </Button>
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() =>
                action.mutate({ id: row.id, operation: 'duplicate' })
              }
            >
              Duplicate
            </Button>
            {!row.isDefault && !row.archivedAt && (
              <Button
                variant="outline"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({ id: row.id, operation: 'default' })
                }
              >
                Set default
              </Button>
            )}
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() =>
                action.mutate({
                  id: row.id,
                  operation: row.archivedAt ? 'unarchive' : 'archive',
                })
              }
            >
              {row.archivedAt ? 'Unarchive' : 'Archive'}
            </Button>
          </div>
          {action.isError && action.variables.id === row.id && (
            <p role="alert">{presetError(action.error)}</p>
          )}
        </div>
      ))}
      {editing && editing !== 'new' && detail.isPending && <Spinner />}
      {editing && detail.isError && (
        <p role="alert">
          Could not load preset.{' '}
          <Button onClick={() => void detail.refetch()}>Retry</Button>
        </p>
      )}
      {editing === 'new' ? (
        <PresetEditor
          key="new"
          onSaved={async () => {
            setEditing(null)
            await refresh()
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        editing &&
        detail.data && (
          <PresetEditor
            key={`${detail.data.id}-${detail.data.version}`}
            preset={detail.data}
            onReload={() => void detail.refetch()}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null)
              await refresh()
              await client.invalidateQueries({ queryKey: ['admin', 'preset'] })
            }}
          />
        )
      )}
    </main>
  )
}
export function PresetEditor({
  preset,
  onSaved,
  onReload,
  onCancel,
}: {
  preset?: PresetDetail
  onSaved: () => Promise<void>
  onReload?: () => void
  onCancel: () => void
}) {
  const installations = useQuery({
    queryKey: ['admin', 'github-installations'],
    queryFn: getAdminInstallations,
  })
  const [errors, setErrors] = useState<string[]>([])
  const mutation = useMutation({
    mutationFn: (input: PresetInput) =>
      preset
        ? updatePreset(preset.id, { ...input, version: preset.version })
        : createPreset(input),
    onSuccess: onSaved,
  })
  const form = useForm({
    defaultValues: {
      name: preset?.name ?? '',
      description: preset?.description ?? '',
      isDefault: preset?.isDefault ?? false,
      settings: preset?.settings ?? defaultSettings,
      starterTemplates: preset?.starterTemplates ?? [],
      githubInstallationId:
        preset?.githubInstallation?.id ?? (null as string | null),
    },
    onSubmit: async ({ value }) => {
      const result = z
        .object({
          name: z.string().min(3).max(100),
          settings: presetSettingsSchema,
          starterTemplates: templatesSchema,
        })
        .safeParse(value)
      setErrors(
        result.success
          ? []
          : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      )
      if (result.success)
        await mutation.mutateAsync(value).catch(() => undefined)
    },
  })
  const values = useStore(form.store, (state) => state.values)
  const schedule = values.settings.schedule
  const changeSchedule = (key: keyof Schedule, value: string) =>
    form.setFieldValue('settings', {
      ...values.settings,
      schedule: {
        ...schedule,
        [key]:
          key === 'startTime'
            ? value
            : value === '' && key !== 'startOffsetDays'
              ? undefined
              : Number(value),
      },
    })
  let preview = 'Enter a valid schedule'
  if (presetSettingsSchema.shape.schedule.safeParse(schedule).success)
    preview = schedulePreview(schedule).toLocaleString('en-GB', {
      timeZone: 'Europe/Berlin',
      timeZoneName: 'short',
    })
  return (
    <section className="space-y-4 rounded border p-6">
      <h2 className="text-2xl font-semibold">
        {preset ? `Edit ${preset.name} (v${preset.version})` : 'New preset'}
      </h2>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <label htmlFor="preset-name">Preset name</label>
        <Input
          id="preset-name"
          value={values.name}
          onChange={(e) => form.setFieldValue('name', e.target.value)}
        />
        <label htmlFor="preset-description">Preset description</label>
        <Textarea
          id="preset-description"
          value={values.description}
          onChange={(e) => form.setFieldValue('description', e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={values.isDefault}
            onChange={(e) => form.setFieldValue('isDefault', e.target.checked)}
          />{' '}
          Default preset
        </label>
        <SettingsFields
          value={values.settings}
          onChange={(next) => form.setFieldValue('settings', next)}
        />
        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend>Schedule (Europe/Berlin)</legend>
          {(
            [
              'startOffsetDays',
              'startTime',
              'submissionDeadlineAfterHours',
              'scheduledEndAfterHours',
              'endAfterHours',
            ] as const
          ).map((key) => (
            <label key={key} htmlFor={`schedule-${key}`}>
              {
                {
                  startOffsetDays: 'Days from today',
                  startTime: 'Start time',
                  submissionDeadlineAfterHours:
                    'Submission deadline after hours',
                  scheduledEndAfterHours: 'Scheduled end after hours',
                  endAfterHours: 'End after hours',
                }[key]
              }
              <Input
                id={`schedule-${key}`}
                type={key === 'startTime' ? 'time' : 'number'}
                min={0}
                step={key === 'startOffsetDays' ? 1 : 'any'}
                max={key === 'startOffsetDays' ? 365 : undefined}
                value={schedule[key] ?? ''}
                onChange={(e) => changeSchedule(key, e.target.value)}
              />
            </label>
          ))}
        </fieldset>
        <p aria-live="polite">
          An event created today would start on {preview}.
        </p>
        <TemplatesFields
          value={values.starterTemplates}
          onChange={(next) => form.setFieldValue('starterTemplates', next)}
        />
        <label htmlFor="shared-installation">Shared GitHub installation</label>
        <select
          id="shared-installation"
          className="w-full rounded border bg-background p-2"
          value={values.githubInstallationId ?? ''}
          onChange={(e) =>
            form.setFieldValue('githubInstallationId', e.target.value || null)
          }
        >
          <option value="">None</option>
          {preset?.githubInstallation &&
            !installations.data?.some(
              (i) => i.id === preset.githubInstallation?.id && i.sharedAt,
            ) && (
              <option disabled value={preset.githubInstallation.id}>
                {preset.githubInstallation.accountLogin} (no longer shared —
                choose another)
              </option>
            )}
          {installations.data
            ?.filter((i) => i.sharedAt)
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.accountLogin}
              </option>
            ))}
        </select>
        {installations.isError && (
          <p role="alert">
            Could not load shared installations.{' '}
            <Button type="button" onClick={() => void installations.refetch()}>
              Retry
            </Button>
          </p>
        )}
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
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={mutation.isPending || isVersionConflict(mutation.error)}
          >
            Save preset
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </form>
    </section>
  )
}
