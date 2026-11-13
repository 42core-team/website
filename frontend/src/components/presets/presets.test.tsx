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
import { useBlocker } from '@tanstack/react-router'
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
  useBlocker: vi.fn(),
  Navigate: () => <p>Redirected</p>,
  Link: ({
    to,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('@/app/actions/presets', async (original) => ({
  ...(await original<typeof api>()),
  getPresets: vi.fn(),
  resolvePreset: vi.fn(),
  getCreateInstallations: vi.fn(),
  getAdminInstallations: vi.fn(),
  createPreset: vi.fn(),
  updatePreset: vi.fn(),
  setDefaultPreset: vi.fn(),
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
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('/tags?') ? [{ name: 'v1.2.3' }] : [{ name: 'dev' }],
    })),
  )
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
  vi.unstubAllGlobals()
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
    expect(
      screen.getByRole('link', { name: 'Cancel' }).getAttribute('href'),
    ).toBe('/events')
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
    fireEvent.click(screen.getByLabelText(/^Start date/))
    expect(screen.getByRole('grid')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /January 14th, 2027/ }))
    fireEvent.change(screen.getByLabelText('Time (your local time)'), {
      target: { value: '12:30' },
    })
    fireEvent.keyDown(screen.getByLabelText('Time (your local time)'), {
      key: 'Escape',
    })
    const expected = new Date(resolved.values.startDate)
    expected.setDate(14)
    expected.setHours(12, 30, 0, 0)
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(createEvent).toHaveBeenCalledWith(
        {
          name: 'Winter Cup',
          presetId: 'one',
          startDate: expected.getTime(),
        },
        expect.anything(),
      ),
    )
  })
  it('uses switches, preserves cleared numbers, and resets fields accessibly', async () => {
    await createPage()
    fireEvent.click(screen.getByText('Adjust settings'))
    fireEvent.click(
      screen.getByRole('switch', { name: 'Optional introduction' }),
    )
    expect(
      screen.getByRole('button', {
        name: 'Reset Optional introduction to preset',
      }),
    ).toBeTruthy()
    const number = screen.getByLabelText<HTMLInputElement>('Min team size')
    fireEvent.change(number, { target: { value: '' } })
    expect(number.value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await screen.findByRole('alert')
    expect(createEvent).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset Min team size to preset' }),
    )
    expect(number.value).toBe('1')
  })
  it('suggests repository tags and branches while accepting a custom version', async () => {
    await createPage()
    fireEvent.click(screen.getByText('Adjust settings'))
    await waitFor(() =>
      expect(
        document.querySelector('datalist option[value="v1.2.3"]'),
      ).toBeTruthy(),
    )
    expect(document.querySelector('datalist option[value="dev"]')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Monorepo version'), {
      target: { value: 'custom-tag' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(createEvent).toHaveBeenCalledWith(
        { name: 'Winter Cup', presetId: 'one', monorepoVersion: 'custom-tag' },
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
  it('sets the default using the dedicated action', async () => {
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
    vi.mocked(api.setDefaultPreset).mockResolvedValue(preset)
    await mount(<PresetsPage />)
    fireEvent.click(await screen.findByText('Set default'))
    await waitFor(() =>
      expect(api.setDefaultPreset).toHaveBeenCalledWith('two'),
    )
    expect(api.updatePreset).not.toHaveBeenCalled()
    expect(api.getAdminPreset).not.toHaveBeenCalled()
  })
  it('opens a dialog and preserves unsaved edits when dismissal is rejected', async () => {
    await mount(<PresetsPage />)
    fireEvent.click(screen.getByText('Create preset'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Preset name'), {
      target: { value: 'Unsaved' },
    })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByText('Cancel'))
    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.getByLabelText<HTMLInputElement>('Preset name').value).toBe(
      'Unsaved',
    )
    const blocker = vi.mocked(useBlocker).mock.calls.at(-1)?.[0] as unknown as {
      shouldBlockFn: () => boolean
      enableBeforeUnload: boolean
    }
    expect(blocker.enableBeforeUnload).toBe(true)
    expect(blocker.shouldBlockFn()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
  it('closes a clean editor without confirmation and saves edits without a discard prompt', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    await mount(<PresetsPage />)
    fireEvent.click(screen.getByText('Create preset'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(confirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Create preset'))
    fireEvent.change(screen.getByLabelText('Preset name'), {
      target: { value: 'New preset' },
    })
    vi.mocked(api.createPreset).mockResolvedValue({
      ...preset,
      name: 'New preset',
    })
    fireEvent.click(screen.getByText('Save preset'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.createPreset).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New preset' }),
    )
    expect(confirm).not.toHaveBeenCalled()
  })
  it('keeps a cleared required schedule offset invalid and suppresses the preview', async () => {
    await mount(
      <PresetEditor preset={preset} onSaved={vi.fn()} onCancel={vi.fn()} />,
    )
    fireEvent.change(screen.getByLabelText('Days from today'), {
      target: { value: '' },
    })
    expect(
      screen.getByLabelText<HTMLInputElement>('Days from today').value,
    ).toBe('')
    expect(
      screen.getByText(
        /An event created today would start on Enter a valid schedule/,
      ),
    ).toBeTruthy()
    fireEvent.click(screen.getByText('Save preset'))
    await screen.findByRole('alert')
    expect(api.updatePreset).not.toHaveBeenCalled()
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
