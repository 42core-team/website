import { useEffect, useRef, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useStore } from '@tanstack/react-store'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useBlocker } from '@tanstack/react-router'
import { z } from 'zod'
import {
  getAdminPresets,
  getAdminPreset,
  getAdminInstallations,
  createPreset,
  updatePreset,
  setDefaultPreset,
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
  defaultSettings,
  presetSettingsSchema,
  scheduleStartSchema,
  templatesSchema,
  schedulePreview,
  same,
} from '@/components/presets/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'

function WarningBadge({ warnings }: { warnings: readonly string[] }) {
  return warnings.length ? (
    <Badge
      variant="outline"
      className="border-warning-border bg-warning-surface text-warning"
      title={warnings.join(' ')}
    >
      Warning
    </Badge>
  ) : null
}

export const Route = createFileRoute('/admin/presets')({
  component: () => (
    <AdminGuard>
      <PresetsPage />
    </AdminGuard>
  ),
})
type EditorSession = {
  token: number
  isNew: boolean
  // A new draft can open before the list loads. Null means it had no default.
  sourceId: string | null | undefined
  snapshot?: PresetDetail | null
  dirty: boolean
  loadFailed?: boolean
}

export function PresetsPage() {
  const client = useQueryClient()
  const [archived, setArchived] = useState(false)
  const [editing, setEditing] = useState<EditorSession | null>(null)
  const nextToken = useRef(0)
  const isDirty = editing?.dirty ?? false
  const closeEditor = () => {
    if (isDirty && !window.confirm('Discard your unsaved preset edits?')) return
    setEditing(null)
  }
  useBlocker({
    shouldBlockFn: () =>
      isDirty && !window.confirm('Discard your unsaved preset edits?'),
    enableBeforeUnload: isDirty,
  })
  const listQuery = {
    queryKey: ['admin', 'presets', archived],
    queryFn: () => getAdminPresets(archived),
  }
  const rows = useQuery(listQuery)

  const loadEditor = async (session: EditorSession) => {
    let sourceId = session.sourceId
    const token = ++nextToken.current
    setEditing((current) =>
      current?.token === session.token
        ? { ...current, loadFailed: false }
        : current,
    )
    try {
      if (sourceId === undefined) {
        const list = await client.ensureQueryData(listQuery)
        sourceId = list.find((row) => row.isDefault)?.id ?? null
      }
      const id = sourceId
      const snapshot = id
        ? await client.fetchQuery({
            queryKey: ['admin', 'preset', id],
            queryFn: () => getAdminPreset(id),
            staleTime: 0,
          })
        : null
      setEditing((current) =>
        current?.token === session.token
          ? { ...current, token, sourceId, snapshot, dirty: false }
          : current,
      )
    } catch {
      setEditing((current) =>
        current?.token === session.token
          ? { ...current, sourceId, loadFailed: true }
          : current,
      )
    }
  }

  const openEditor = (isNew: boolean, sourceId?: string | null) => {
    const session: EditorSession = {
      token: ++nextToken.current,
      isNew,
      sourceId,
      dirty: false,
    }
    setEditing(session)
    void loadEditor(session)
  }

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['admin', 'presets'] })
    await client.invalidateQueries({ queryKey: ['event-presets'] })
    await client.invalidateQueries({ queryKey: ['resolved-preset'] })
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
      return setDefaultPreset(id)
    },
    onSuccess: refresh,
  })
  return (
    <main className="page-frame page-workspace space-y-6 py-8">
      <h1 className="page-title">Event presets</h1>
      <div className="flex gap-4">
        <Button
          onClick={() =>
            openEditor(
              true,
              rows.data
                ? (rows.data.find((row) => row.isDefault)?.id ?? null)
                : undefined,
            )
          }
        >
          Create preset
        </Button>
        <label htmlFor="include-archived">Include archived</label>
        <Switch
          id="include-archived"
          checked={archived}
          onCheckedChange={setArchived}
        />
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
          {row.archivedAt && <span>Archived</span>}{' '}
          <WarningBadge warnings={row.warnings} />
          <p>
            v{row.version} · {row.eventCount} events · Updated by{' '}
            {row.updatedBy?.username ?? 'Unknown'} ·{' '}
            {new Date(row.updatedAt).toLocaleString()}
          </p>
          <p>{row.description}</p>
          {row.warnings.map((warning) => (
            <p key={warning} className="text-sm text-warning">
              {warning}
            </p>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => openEditor(false, row.id)}>
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
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) closeEditor()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogTitle>
            {editing?.isNew ? 'Create preset' : 'Edit preset'}
          </DialogTitle>
          <DialogDescription>
            Configure the settings organizers start with when creating an event.
          </DialogDescription>
          {editing && !editing.loadFailed && editing.snapshot === undefined && (
            <Spinner />
          )}
          {editing?.loadFailed && (
            <p role="alert">
              {editing.isNew
                ? 'Could not load default preset.'
                : 'Could not load preset.'}{' '}
              <Button onClick={() => void loadEditor(editing)}>Retry</Button>
            </p>
          )}
          {editing && editing.snapshot !== undefined && (
            <PresetEditor
              key={editing.token}
              preset={
                editing.isNew ? undefined : (editing.snapshot ?? undefined)
              }
              defaults={
                editing.isNew ? (editing.snapshot ?? undefined) : undefined
              }
              onReload={() => void loadEditor(editing)}
              onCancel={() => setEditing(null)}
              onDirty={(dirty) =>
                setEditing((current) =>
                  current?.token === editing.token && current.dirty !== dirty
                    ? { ...current, dirty }
                    : current,
                )
              }
              onSaved={async () => {
                setEditing((current) =>
                  current?.token === editing.token ? null : current,
                )
                await refresh()
                if (!editing.isNew) {
                  await client.invalidateQueries({
                    queryKey: ['admin', 'preset'],
                  })
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}
export function PresetEditor({
  preset,
  defaults,
  onSaved,
  onReload,
  onCancel,
  onDirty,
}: {
  preset?: PresetDetail
  defaults?: PresetDetail
  onSaved: () => Promise<void>
  onReload?: () => void
  onDirty?: (dirty: boolean) => void
  onCancel: () => void
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
  const mutation = useMutation({
    mutationFn: (input: PresetInput) =>
      preset
        ? updatePreset(preset.id, { ...input, version: preset.version })
        : createPreset(input),
    onSuccess: onSaved,
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
      const result = z
        .object({
          name: z.string().min(3).max(100),
          settings: presetSettingsSchema,
          starterTemplates: templatesSchema,
        })
        .safeParse(value)
      setErrors(result.success ? [] : issueMessages(result.error.issues))
      if (result.success)
        await mutation.mutateAsync(value).catch(() => undefined)
    },
  })
  const values = useStore(form.store, (state) => state.values)
  const dirty = !same(values, initialValues)
  useEffect(() => {
    onDirty?.(dirty)
  }, [dirty, onDirty])
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
              : numberValue(value),
      },
    })
  let preview = 'Enter a valid schedule'
  if (scheduleStartSchema.safeParse(schedule).success)
    preview = schedulePreview(schedule).toLocaleString('en-GB', {
      timeZone: 'Europe/Berlin',
      timeZoneName: 'short',
    })
  return (
    <section className="space-y-4 rounded border p-6">
      <h2 className="text-2xl font-semibold">
        {preset ? `Edit ${preset.name} (v${preset.version})` : 'New preset'}{' '}
        {preset && <WarningBadge warnings={preset.warnings} />}
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
        <label htmlFor="preset-default">Default preset</label>
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
        <SettingsFields
          value={values.settings}
          onChange={(next) => form.setFieldValue('settings', next)}
          scheduleFields={
            <>
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
                    {labels[key]}
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
                      onChange={(e) => changeSchedule(key, e.target.value)}
                    />
                  </label>
                ))}
              </fieldset>
              <p aria-live="polite">
                An event created today would start on {preview}.
              </p>
            </>
          }
        />
        <SettingsSection title="GitHub Integration">
          <TemplatesFields
            value={values.starterTemplates}
            onChange={(next) => form.setFieldValue('starterTemplates', next)}
          />
          <label htmlFor="shared-installation">
            Shared GitHub installation
          </label>
          <select
            id="shared-installation"
            className="native-select w-full"
            value={values.githubInstallationId ?? ''}
            onChange={(e) =>
              form.setFieldValue('githubInstallationId', e.target.value || null)
            }
          >
            <option value="">None</option>
            {source?.githubInstallation &&
              !linkable?.some(
                (i) => i.id === source.githubInstallation?.id,
              ) && (
                <option
                  disabled={Boolean(linkable)}
                  value={source.githubInstallation.id}
                >
                  {source.githubInstallation.accountLogin}
                  {linkable ? ' (unavailable)' : ''}
                </option>
              )}
            {linkable?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.accountLogin}
              </option>
            ))}
          </select>
          {source &&
            values.githubInstallationId === source.githubInstallation?.id && (
              <PresetWarnings warnings={source.warnings} />
            )}
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
            onClick={() => {
              if (
                !dirty ||
                window.confirm('Discard your unsaved preset edits?')
              ) {
                onCancel()
              }
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </section>
  )
}
