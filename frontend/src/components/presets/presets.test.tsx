// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Router from '@tanstack/react-router'
import type {
  PresetDetail,
  ResolvedPreset,
  AdminInstallation,
} from '@/app/actions/presets'
import * as api from '@/app/actions/presets'
import { createEvent } from '@/app/actions/event'
import { CreateEventPage } from '@/routes/events/create'
import { PresetEditor, PresetsPage } from '@/routes/admin/presets'
import { InstallationsPage } from '@/routes/admin/github-installations'
import { AdminGuard } from '@/components/presets/admin-guard'
import { useSession } from '@/lib/auth'
import {
  defaultSettings,
  schedulePreview,
  createPayload,
  resolvedValues,
} from './settings'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof Router>()),
  useNavigate: () => navigate,
  Navigate: () => <p>Redirected</p>,
}))
vi.mock('@/app/actions/presets', async (original) => ({
  ...(await original<typeof api>()),
  getPresets: vi.fn(),
  resolvePreset: vi.fn(),
  getCreateInstallations: vi.fn(),
  getAdminInstallations: vi.fn(),
  createPreset: vi.fn(),
  updatePreset: vi.fn(),
  getAdminPresets: vi.fn(),
  getAdminPreset: vi.fn(),
  archivePreset: vi.fn(),
  shareInstallation: vi.fn(),
  unshareInstallation: vi.fn(),
}))
vi.mock('@/app/actions/event', () => ({ createEvent: vi.fn() }))
vi.mock('@/lib/auth', () => ({ useSession: vi.fn() }))
const { schedule: _schedule, ...settings } = defaultSettings
const resolved: ResolvedPreset = {
  presetId: 'one',
  presetVersion: 2,
  values: {
    ...settings,
    startDate: 1800000000000,
    submissionDeadline: 1800003600000,
  },
  starterTemplates: [],
  githubInstallation: null,
}
const preset: PresetDetail = {
  id: 'one',
  name: 'Default',
  description: '',
  isDefault: true,
  version: 2,
  updatedAt: '',
  createdAt: '',
  archivedAt: null,
  settings: defaultSettings,
  starterTemplates: [],
  githubInstallation: null,
}
const installation: AdminInstallation = {
  id: 'uuid',
  accountLogin: 'core',
  accountType: 'Organization',
  sharedAt: null,
  sharedBy: null,
  eventCount: 1,
}
function conflict(message: string) {
  return new AxiosError('Conflict', '409', undefined, undefined, {
    status: 409,
    data: { message },
    statusText: 'Conflict',
    headers: {},
    config: { headers: {} },
  } as never)
}
beforeEach(() => {
  vi.mocked(api.getPresets).mockResolvedValue([
    { ...preset },
    { ...preset, id: 'two', name: 'Second', isDefault: false },
  ])
  vi.mocked(api.resolvePreset).mockImplementation(async (id) => ({
    ...resolved,
    presetId: id,
    values: { ...resolved.values, location: id === 'two' ? 'Berlin' : '' },
  }))
  vi.mocked(api.getCreateInstallations).mockResolvedValue([
    {
      id: 'shared',
      accountLogin: 'shared-core',
      accountType: 'Organization',
      shared: true,
    },
  ])
  vi.mocked(api.getAdminInstallations).mockResolvedValue([installation])
  vi.mocked(api.getAdminPresets).mockResolvedValue([
    { ...preset, updatedBy: null, eventCount: 0 },
  ])
  vi.mocked(createEvent).mockResolvedValue({ id: 'new' } as Awaited<
    ReturnType<typeof createEvent>
  >)
})
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
  vi.restoreAllMocks()
})
async function mount(element: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  await act(async () => {
    render(<QueryClientProvider client={client}>{element}</QueryClientProvider>)
  })
  return client
}
async function createPage() {
  await mount(<CreateEventPage />)
  await screen.findByLabelText('Name')
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Winter Cup' },
  })
}
describe('preset event creation', () => {
  it('sends only name and preset when settings are unchanged', async () => {
    await createPage()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(createEvent).toHaveBeenCalledWith(
        { name: 'Winter Cup', presetId: 'one' },
        expect.anything(),
      ),
    )
  })
  it('sends only changed settings, templates and installation overrides', async () => {
    await createPage()
    fireEvent.click(screen.getByText('Adjust settings'))
    fireEvent.change(screen.getByLabelText('Location'), {
      target: { value: 'Helsinki' },
    })
    expect(screen.getByText('shared-core (shared)')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('GitHub installation'), {
      target: { value: 'shared' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(createEvent).toHaveBeenCalledWith(
        {
          name: 'Winter Cup',
          presetId: 'one',
          location: 'Helsinki',
          githubInstallationId: 'shared',
        },
        expect.anything(),
      ),
    )
  })
  it('confirms switching edited presets, preserves cancelled edits, and resolves accepted switches', async () => {
    await createPage()
    fireEvent.click(screen.getByText('Adjust settings'))
    fireEvent.change(screen.getByLabelText('Location'), {
      target: { value: 'Helsinki' },
    })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.change(screen.getByLabelText('Preset'), {
      target: { value: 'two' },
    })
    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.getByLabelText<HTMLInputElement>('Location').value).toBe(
      'Helsinki',
    )
    expect(api.resolvePreset).not.toHaveBeenCalledWith('two')
    confirm.mockReturnValue(true)
    fireEvent.change(screen.getByLabelText('Preset'), {
      target: { value: 'two' },
    })
    await waitFor(() => expect(api.resolvePreset).toHaveBeenCalledWith('two'))
    await screen.findByLabelText('Name')
    fireEvent.click(screen.getByText('Adjust settings'))
    expect(screen.getByLabelText<HTMLInputElement>('Location').value).toBe(
      'Berlin',
    )
  })
  it('reset removes the change marker and no longer asks to discard settings', async () => {
    await createPage()
    fireEvent.click(screen.getByText('Adjust settings'))
    fireEvent.change(screen.getByLabelText('Location'), {
      target: { value: 'Helsinki' },
    })
    fireEvent.click(screen.getByText('Reset to preset'))
    const confirm = vi.spyOn(window, 'confirm')
    fireEvent.change(screen.getByLabelText('Preset'), {
      target: { value: 'two' },
    })
    expect(confirm).not.toHaveBeenCalled()
  })
  it('omits a field typed back to the preset value', async () => {
    await createPage()
    fireEvent.click(screen.getByText('Adjust settings'))
    const location = screen.getByLabelText('Location')
    fireEvent.change(location, { target: { value: 'Helsinki' } })
    fireEvent.change(location, { target: { value: '' } })
    expect(screen.queryByText('Changed')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(createEvent).toHaveBeenCalledWith(
        { name: 'Winter Cup', presetId: 'one' },
        expect.anything(),
      ),
    )
  })
  it('sends edited dates as epoch ms of the entered local time', async () => {
    await createPage()
    fireEvent.click(screen.getByText('Adjust settings'))
    fireEvent.change(screen.getByLabelText(/^Start date/), {
      target: { value: '2027-01-14T12:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(createEvent).toHaveBeenCalledWith(
        {
          name: 'Winter Cup',
          presetId: 'one',
          startDate: new Date(2027, 0, 14, 12, 30).getTime(),
        },
        expect.anything(),
      ),
    )
  })
  it('opens the settings when a hidden preset value is invalid', async () => {
    vi.mocked(api.resolvePreset).mockResolvedValue({
      ...resolved,
      values: { ...resolved.values, gameConfig: '' },
    })
    await createPage()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await screen.findByText(/^Game configuration:/)
    expect(screen.getByLabelText('Game configuration')).toBeTruthy()
    expect(createEvent).not.toHaveBeenCalled()
  })
  it('includes explicit clears of inherited templates and installations', () => {
    const source = {
      ...resolved,
      githubInstallation: { id: 'shared', accountLogin: 'core' },
      starterTemplates: [
        { name: 'C', basePath: 'bots/c', myCoreBotDockerImage: 'image:dev' },
      ],
    }
    expect(
      createPayload('Cup', source, {
        ...resolvedValues(source),
        githubInstallationId: null,
        starterTemplates: [],
      }),
    ).toEqual({
      name: 'Cup',
      presetId: 'one',
      githubInstallationId: null,
      starterTemplates: [],
    })
  })
})
describe('preset administration', () => {
  it('does not render admin pages or run admin queries for non-admins', async () => {
    vi.mocked(useSession).mockReturnValue({
      status: 'authenticated',
      data: { user: { abilities: { admin: false } } },
    } as unknown as ReturnType<typeof useSession>)
    await mount(
      <AdminGuard>
        <PresetsPage />
      </AdminGuard>,
    )
    expect(screen.getByText('Redirected')).toBeTruthy()
    expect(screen.queryByText('Event presets')).toBeNull()
    expect(api.getAdminPresets).not.toHaveBeenCalled()
  })
  it('sets the default with a versioned update of the current preset', async () => {
    vi.mocked(api.getAdminPresets).mockResolvedValue([
      {
        ...preset,
        id: 'two',
        isDefault: false,
        updatedBy: null,
        eventCount: 0,
      },
    ])
    vi.mocked(api.getAdminPreset).mockResolvedValue({
      ...preset,
      id: 'two',
      isDefault: false,
      version: 7,
    })
    vi.mocked(api.updatePreset).mockResolvedValue(preset)
    await mount(<PresetsPage />)
    fireEvent.click(await screen.findByText('Set default'))
    await waitFor(() =>
      expect(api.updatePreset).toHaveBeenCalledWith(
        'two',
        expect.objectContaining({ version: 7, isDefault: true }),
      ),
    )
  })
  it('does not let the default preset be unmarked as default', async () => {
    await mount(
      <PresetEditor preset={preset} onSaved={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(
      screen.getByLabelText<HTMLInputElement>('Default preset').disabled,
    ).toBe(true)
  })
})
describe('preset administration conflicts', () => {
  it('offers reload for version conflict and keeps edits until reload', async () => {
    vi.mocked(api.updatePreset).mockRejectedValue(
      conflict('Preset was changed by someone else'),
    )
    const reload = vi.fn()
    await mount(
      <PresetEditor
        preset={preset}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        onReload={reload}
      />,
    )
    fireEvent.change(screen.getByLabelText('Preset name'), {
      target: { value: 'My changes' },
    })
    fireEvent.click(screen.getByText('Save preset'))
    fireEvent.click(await screen.findByText('Reload preset and discard edits'))
    expect(reload).toHaveBeenCalledOnce()
    expect(screen.getByLabelText<HTMLInputElement>('Preset name').value).toBe(
      'My changes',
    )
  })
  it('shows name conflicts inline without a version reload prompt', async () => {
    vi.mocked(api.updatePreset).mockRejectedValue(
      conflict('Preset name is already taken'),
    )
    await mount(
      <PresetEditor preset={preset} onSaved={vi.fn()} onCancel={vi.fn()} />,
    )
    fireEvent.click(screen.getByText('Save preset'))
    await screen.findByText('Preset name is already taken')
    expect(screen.queryByText('Reload preset and discard edits')).toBeNull()
  })
  it('shows default archive conflict beside the row', async () => {
    vi.mocked(api.archivePreset).mockRejectedValue(
      conflict('Cannot archive the default preset'),
    )
    await mount(<PresetsPage />)
    fireEvent.click(await screen.findByText('Archive'))
    await screen.findByText('Cannot archive the default preset')
  })
  it('offers only shared installations in the editor', async () => {
    vi.mocked(api.getAdminInstallations).mockResolvedValue([
      installation,
      {
        ...installation,
        id: 'shared',
        accountLogin: 'shared-core',
        sharedAt: '2026-11-13',
      },
    ])
    await mount(
      <PresetEditor preset={preset} onSaved={vi.fn()} onCancel={vi.fn()} />,
    )
    await screen.findByText('shared-core')
    expect(screen.queryByRole('option', { name: 'core' })).toBeNull()
  })
})
describe('installation sharing', () => {
  it('explains and confirms sharing, then refreshes the list', async () => {
    vi.mocked(api.shareInstallation).mockResolvedValue({
      ...installation,
      sharedAt: 'now',
    })
    const client = await mount(<InstallationsPage />)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    fireEvent.click(await screen.findByRole('button', { name: 'Share' }))
    expect(screen.getByText(/Sharing lets any event creator/)).toBeTruthy()
    expect(api.shareInstallation).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Confirm share'))
    await waitFor(() =>
      expect(api.shareInstallation).toHaveBeenCalledWith('uuid'),
    )
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['create-installations'],
      }),
    )
  })
  it('unshares only after confirmation', async () => {
    vi.mocked(api.getAdminInstallations).mockResolvedValue([
      { ...installation, sharedAt: 'now' },
    ])
    await mount(<InstallationsPage />)
    fireEvent.click(await screen.findByText('Unshare'))
    expect(screen.getByText(/Existing events stay linked/)).toBeTruthy()
    fireEvent.click(screen.getByText('Confirm unshare'))
    await waitFor(() =>
      expect(api.unshareInstallation).toHaveBeenCalledWith('uuid'),
    )
  })
})
describe('Berlin schedule preview', () => {
  it.each([
    ['2026-03-28T12:00:00Z', '2026-03-29T08:00:00Z'],
    ['2026-10-24T12:00:00Z', '2026-10-25T09:00:00Z'],
  ])('keeps wall time over DST from %s', (now, expected) => {
    expect(
      schedulePreview(
        { startOffsetDays: 1, startTime: '10:00' },
        new Date(now),
      ).toISOString(),
    ).toBe(new Date(expected).toISOString())
  })
  it('moves a start time skipped by the spring switch forward an hour', () => {
    expect(
      schedulePreview(
        { startOffsetDays: 1, startTime: '02:30' },
        new Date('2026-03-28T12:00:00Z'),
      ).toISOString(),
    ).toBe('2026-03-29T01:30:00.000Z')
  })
  it('uses the first occurrence of a start time repeated in autumn', () => {
    expect(
      schedulePreview(
        { startOffsetDays: 1, startTime: '02:30' },
        new Date('2026-10-24T12:00:00Z'),
      ).toISOString(),
    ).toBe('2026-10-25T00:30:00.000Z')
  })
  it('crosses month ends and the DST switch with longer offsets', () => {
    expect(
      schedulePreview(
        { startOffsetDays: 10, startTime: '18:00' },
        new Date('2026-03-25T12:00:00Z'),
      ).toISOString(),
    ).toBe('2026-04-04T16:00:00.000Z')
  })
  it('uses the Berlin calendar date near UTC midnight', () => {
    expect(
      schedulePreview(
        { startOffsetDays: 0, startTime: '10:00' },
        new Date('2026-07-01T23:30:00Z'),
      ).toISOString(),
    ).toBe('2026-07-02T08:00:00.000Z')
  })
})
