// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useBlocker } from '@tanstack/react-router'
import { AxiosError } from 'axios'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Router from '@tanstack/react-router'
import type {
  PresetDetail,
  ResolvedPreset,
  AdminInstallation,
} from '@/app/actions/presets'
import * as api from '@/app/actions/presets'
import { createEvent, isGithubAppAvailable } from '@/app/actions/event'
import { CreateEventPage } from '@/routes/events/create'
import { PresetsPage } from '@/routes/admin/presets.index'
import { PresetEditor, PresetEditorPage } from './preset-editor'
import { InstallationsPage } from '@/routes/admin/github-installations'
import { AdminGuard } from '@/components/presets/admin-guard'
import { useSession } from '@/lib/auth'
import {
  defaultSettings,
  schedulePreview,
  createPayload,
  moveWithStart,
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
    params,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string
    params?: Record<string, string>
  }) => (
    <a
      href={to.replace(/\$(\w+)/g, (_, key: string) => params?.[key] ?? '')}
      {...props}
    >
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
  duplicatePreset: vi.fn(),
  shareInstallation: vi.fn(),
  unshareInstallation: vi.fn(),
  getAdminInstallUrl: vi.fn(),
  getAdminInstallation: vi.fn(),
}))
vi.mock('@/app/actions/event', () => ({
  createEvent: vi.fn(),
  isGithubAppAvailable: vi.fn(async () => true),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn() } }))
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
  warnings: [],
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
  warnings: [],
}
const installation: AdminInstallation = {
  id: 'uuid',
  installationId: 77,
  accountLogin: 'core',
  accountType: 'Organization',
  status: 'active',
  sharedAt: null,
  sharedBy: null,
  eventCount: 1,
}
const unavailable =
  "This preset's GitHub installation core is no longer available; the event will be created without one."
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
  vi.mocked(api.getAdminPreset).mockResolvedValue(preset)
  vi.mocked(api.getAdminInstallations).mockResolvedValue([installation])
  vi.mocked(api.getAdminInstallation).mockResolvedValue({
    ...installation,
    events: [
      {
        id: 'event',
        name: 'CORE Berlin',
        state: 'PLAYING',
        startDate: '2026-11-01T09:00:00Z',
      },
    ],
    missingPermissions: ['members'],
  })
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
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}
async function createPage() {
  await mount(<CreateEventPage />)
  await screen.findByLabelText('Name')
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Winter Cup' },
  })
}
describe('preset event creation', () => {
  it('hides a stale installation warning after selecting a replacement', async () => {
    vi.mocked(api.resolvePreset).mockResolvedValue({
      ...resolved,
      warnings: [unavailable],
    })
    await createPage()
    expect(screen.getByRole('status').textContent).toContain(unavailable)
    fireEvent.click(screen.getByText('Adjust settings'))
    await screen.findByRole('option', { name: 'shared-core (shared)' })
    fireEvent.change(screen.getByLabelText('GitHub installation'), {
      target: { value: 'shared' },
    })
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.click(screen.getByText('Adjust settings'))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('keeps a create request pending and shows its error after a field change', async () => {
    const request = deferred<Awaited<ReturnType<typeof createEvent>>>()
    vi.mocked(createEvent).mockReturnValue(request.promise)
    await createPage()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await screen.findByRole('button', { name: 'Creating…' })
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Edited Cup' },
    })
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Creating…' })
        .disabled,
    ).toBe(true)
    request.reject(conflict('Event name is already taken'))
    await screen.findByText('Event name is already taken')
  })

  it('shows an installation warning returned when the event is created', async () => {
    vi.mocked(createEvent).mockResolvedValue({
      id: 'new',
      warnings: [unavailable],
    } as Awaited<ReturnType<typeof createEvent>>)
    await createPage()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(unavailable))
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/events/$id/dashboard',
        params: { id: 'new' },
      }),
    )
  })

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
  it('moves dates that follow the start and leaves them to the API', async () => {
    await createPage()
    fireEvent.click(screen.getByText('Adjust settings'))
    fireEvent.click(screen.getByLabelText(/^Start date/))
    // A week later, past the preset's submission deadline.
    fireEvent.click(screen.getByRole('button', { name: /January 22nd, 2027/ }))
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'Escape' })
    const start = new Date(resolved.values.startDate)
    start.setDate(22)
    const deadline = new Date(start.getTime() + 3600000)
    expect(screen.getByLabelText(/^Submission deadline/).textContent).toContain(
      format(deadline, 'PPP HH:mm'),
    )
    expect(
      screen.queryByRole('button', {
        name: 'Reset Submission deadline to preset',
      }),
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(createEvent).toHaveBeenCalledWith(
        { name: 'Winter Cup', presetId: 'one', startDate: start.getTime() },
        expect.anything(),
      ),
    )
  })
  it('keeps an edited date when the start moves later', () => {
    const base = resolved.values
    const edited = { ...base, submissionDeadline: base.startDate + 7200000 }
    const moved = moveWithStart(
      edited,
      { ...edited, startDate: base.startDate + 1000 },
      base,
    )
    expect(moved.submissionDeadline).toBe(base.startDate + 7200000)
    const following = moveWithStart(
      base,
      { ...base, startDate: base.startDate + 1000 },
      base,
    )
    expect(following.submissionDeadline).toBe(base.submissionDeadline! + 1000)
    expect(
      createPayload('Cup', resolved, {
        ...resolvedValues(resolved),
        settings: moved,
      }),
    ).toEqual({
      name: 'Cup',
      presetId: 'one',
      startDate: base.startDate + 1000,
      submissionDeadline: base.startDate + 7200000,
    })
  })
  it("warns that the preset's installation is unavailable", async () => {
    vi.mocked(api.resolvePreset).mockResolvedValue({
      ...resolved,
      warnings: [unavailable],
    })
    await createPage()
    expect(screen.getByRole('status').textContent).toContain(unavailable)
    fireEvent.click(screen.getByText('Adjust settings'))
    const picker = screen.getByLabelText('GitHub installation')
    expect(picker.parentElement?.textContent).toContain(unavailable)
    expect(screen.getAllByText(unavailable)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(createEvent).toHaveBeenCalledWith(
        { name: 'Winter Cup', presetId: 'one' },
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
const row = (detail: PresetDetail, extra = {}) => ({
  ...detail,
  updatedBy: null,
  eventCount: 0,
  ...extra,
})
const second: PresetDetail = {
  ...preset,
  id: 'two',
  name: 'Second',
  isDefault: false,
  version: 7,
  settings: { ...defaultSettings, location: 'Second venue' },
}
function openMenu(name: string) {
  fireEvent.keyDown(
    screen.getByRole('button', { name: `Actions for ${name}` }),
    {
      key: 'Enter',
    },
  )
}
describe('preset list', () => {
  it('splits active and archived presets into tabs', async () => {
    vi.mocked(api.getAdminPresets).mockResolvedValue([
      row(preset, { updatedBy: { id: 'u', username: 'paul' } }),
      row(second, { archivedAt: '2026-11-01' }),
    ])
    await mount(<PresetsPage />)
    expect(api.getAdminPresets).toHaveBeenCalledWith(true)
    const archivedTab = await screen.findByRole('tab', { name: 'Archived (1)' })
    expect(screen.getByRole('tab', { name: 'Active (1)' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Default' })).toBeTruthy()
    expect(screen.getByText(/@paul/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Second' })).toBeNull()
    fireEvent.mouseDown(archivedTab)
    expect(await screen.findByRole('link', { name: 'Second' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Default' })).toBeNull()
    openMenu('Second')
    expect(
      await screen.findByRole('menuitem', { name: 'Unarchive' }),
    ).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Set default' })).toBeNull()
  })
  it('opens the editor from a row or its menu', async () => {
    await mount(<PresetsPage />)
    const link = await screen.findByRole('link', { name: 'Default' })
    expect(link.getAttribute('href')).toBe('/admin/presets/one')
    expect(
      screen.getByRole('link', { name: 'New preset' }).getAttribute('href'),
    ).toBe('/admin/presets/new')
    fireEvent.click(screen.getByText('v2'))
    expect(navigate).toHaveBeenCalledWith({
      to: '/admin/presets/$id',
      params: { id: 'one' },
    })
    navigate.mockClear()
    openMenu('Default')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    expect(navigate).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith({
      to: '/admin/presets/$id',
      params: { id: 'one' },
    })
  })
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
    vi.mocked(api.getAdminPresets).mockResolvedValue([row(second)])
    vi.mocked(api.setDefaultPreset).mockResolvedValue(preset)
    await mount(<PresetsPage />)
    await screen.findByRole('link', { name: 'Second' })
    openMenu('Second')
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Set default' }),
    )
    await waitFor(() =>
      expect(api.setDefaultPreset).toHaveBeenCalledWith('two'),
    )
    expect(api.updatePreset).not.toHaveBeenCalled()
    expect(api.getAdminPreset).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
  it('duplicates a preset and refreshes the list', async () => {
    vi.mocked(api.duplicatePreset).mockResolvedValue(second)
    const client = await mount(<PresetsPage />)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await screen.findByRole('link', { name: 'Default' })
    openMenu('Default')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['admin', 'presets'],
      }),
    )
    expect(api.duplicatePreset).toHaveBeenCalledWith('one')
  })
  it('shows default archive conflict beside the row', async () => {
    vi.mocked(api.archivePreset).mockRejectedValue(
      conflict('Cannot archive the default preset'),
    )
    await mount(<PresetsPage />)
    await screen.findByRole('link', { name: 'Default' })
    openMenu('Default')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Archive' }))
    expect(
      (await screen.findByText('Cannot archive the default preset')).closest(
        'tr',
      )?.textContent,
    ).toContain('Default')
  })
  it('badges presets whose installation is unavailable', async () => {
    vi.mocked(api.getAdminPresets).mockResolvedValue([
      row(preset, { warnings: [unavailable] }),
    ])
    await mount(<PresetsPage />)
    const badge = await screen.findByTitle(unavailable)
    expect(badge.textContent).toBe(`1 warning: ${unavailable}`)
  })
})
type Location = { pathname: string }
const leaving = {
  current: { pathname: '/admin/presets/new' },
  next: { pathname: '/admin/presets' },
}
const lastBlocker = () =>
  vi.mocked(useBlocker).mock.calls.at(-1)?.[0] as unknown as {
    shouldBlockFn: (locations: { current: Location; next: Location }) => boolean
    enableBeforeUnload: boolean
  }
describe('preset editor page', () => {
  it('initializes new presets from the default detail without copying identity', async () => {
    const defaults = {
      ...preset,
      settings: { ...defaultSettings, location: 'Default venue' },
      starterTemplates: [
        {
          name: 'Starter',
          basePath: 'bots/c',
          myCoreBotDockerImage: 'image:dev',
        },
      ],
      githubInstallation: { id: 'uuid', accountLogin: 'core' },
    }
    vi.mocked(api.getAdminPreset).mockResolvedValue(defaults)
    vi.mocked(api.getAdminInstallations).mockResolvedValue([
      { ...installation, sharedAt: 'now' },
    ])
    vi.mocked(api.createPreset).mockResolvedValue(preset)
    await mount(<PresetEditorPage />)
    expect(
      (await screen.findByLabelText<HTMLInputElement>('Location')).value,
    ).toBe('Default venue')
    expect(screen.getByLabelText<HTMLInputElement>('Preset name').value).toBe(
      '',
    )
    expect(screen.getByText('0 changes from default')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Preset name'), {
      target: { value: 'New copy' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create preset' }))
    await waitFor(() =>
      expect(api.createPreset).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New copy',
          description: '',
          isDefault: false,
          settings: defaults.settings,
          starterTemplates: defaults.starterTemplates,
          githubInstallationId: 'uuid',
        }),
      ),
    )
    expect(api.getAdminPreset).toHaveBeenCalledWith('one')
    expect(api.updatePreset).not.toHaveBeenCalled()
  })
  it('keeps a new draft when the default list and detail change', async () => {
    const defaults = {
      ...preset,
      settings: { ...defaultSettings, location: 'Original venue' },
    }
    vi.mocked(api.getAdminPreset).mockResolvedValue(defaults)
    const client = await mount(<PresetEditorPage />)
    fireEvent.change(await screen.findByLabelText('Preset name'), {
      target: { value: 'My draft' },
    })

    const replacement = {
      ...preset,
      id: 'two',
      settings: { ...defaultSettings, location: 'New venue' },
    }
    vi.mocked(api.getAdminPresets).mockResolvedValue([row(replacement)])
    vi.mocked(api.getAdminPreset).mockImplementation(async (id) =>
      id === 'one' ? { ...replacement, id, version: 3 } : replacement,
    )
    await act(async () => {
      await client.refetchQueries({ queryKey: ['admin', 'presets'] })
      await client.refetchQueries({ queryKey: ['admin', 'preset', 'one'] })
    })

    expect(screen.getByLabelText<HTMLInputElement>('Preset name').value).toBe(
      'My draft',
    )
    expect(screen.getByLabelText<HTMLInputElement>('Location').value).toBe(
      'Original venue',
    )
    expect(api.getAdminPreset).not.toHaveBeenCalledWith('two')
  })
  it('refreshes caches after a late save without leaving the next page', async () => {
    const save = deferred<PresetDetail>()
    vi.mocked(api.updatePreset).mockReturnValue(save.promise)
    const client = await mount(<PresetEditorPage id="one" />)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    fireEvent.change(await screen.findByLabelText('Preset name'), {
      target: { value: 'First draft' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save as v3' }))
    await waitFor(() => expect(api.updatePreset).toHaveBeenCalledOnce())
    cleanup()
    await act(async () => save.resolve({ ...preset, version: 3 }))

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['admin', 'preset'],
      }),
    )
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'presets'] })
    expect(navigate).not.toHaveBeenCalled()
  })
  it('uses blank values when there is no default preset', async () => {
    vi.mocked(api.getAdminPresets).mockResolvedValue([])
    await mount(<PresetEditorPage />)
    expect(
      (await screen.findByLabelText<HTMLInputElement>('Location')).value,
    ).toBe('')
    expect(api.getAdminPreset).not.toHaveBeenCalled()
  })
  it('retries a failed default detail before opening the editor', async () => {
    vi.mocked(api.getAdminPreset).mockRejectedValueOnce(
      new Error('Unavailable'),
    )
    await mount(<PresetEditorPage />)
    await screen.findByText(/Could not load default preset/)
    expect(screen.queryByLabelText('Preset name')).toBeNull()
    fireEvent.click(screen.getByText('Retry'))
    await screen.findByLabelText('Preset name')
  })
  it('blocks leaving with unsaved edits and discards them only after confirmation', async () => {
    await mount(<PresetEditorPage />)
    const discard = await screen.findByRole('button', { name: 'Discard' })
    expect(discard.hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText('Preset name'), {
      target: { value: 'Unsaved' },
    })
    const blocker = lastBlocker()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    expect(blocker.enableBeforeUnload).toBe(true)
    expect(blocker.shouldBlockFn(leaving)).toBe(true)
    // Section links only change the hash.
    expect(
      blocker.shouldBlockFn({
        current: { pathname: '/admin/presets/new' },
        next: { pathname: '/admin/presets/new' },
      }),
    ).toBe(false)
    fireEvent.click(discard)
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText<HTMLInputElement>('Preset name').value).toBe(
      'Unsaved',
    )
    confirm.mockReturnValue(true)
    fireEvent.click(discard)
    expect(screen.getByLabelText<HTMLInputElement>('Preset name').value).toBe(
      '',
    )
    expect(lastBlocker().enableBeforeUnload).toBe(false)
  })
  it('saves without a discard prompt and returns to the list', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    vi.mocked(api.createPreset).mockResolvedValue({
      ...preset,
      name: 'New preset',
    })
    await mount(<PresetEditorPage />)
    fireEvent.change(await screen.findByLabelText('Preset name'), {
      target: { value: 'New preset' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create preset' }))
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/admin/presets' }),
    )
    expect(api.createPreset).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New preset' }),
    )
    expect(toast.success).toHaveBeenCalledWith('Preset saved.')
    expect(lastBlocker().shouldBlockFn(leaving)).toBe(false)
    expect(confirm).not.toHaveBeenCalled()
  })
  it('counts changes from the default preset and resets a field to it', async () => {
    vi.mocked(api.getAdminPresets).mockResolvedValue([
      row(preset),
      row(second, { eventCount: 4 }),
    ])
    vi.mocked(api.getAdminPreset).mockImplementation(async (id) =>
      id === 'two' ? second : preset,
    )
    await mount(<PresetEditorPage id="two" />)
    expect(await screen.findByText('1 change from default')).toBeTruthy()
    expect(await screen.findByText('v7 · 4 events')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save as v8' })).toBeTruthy()
    const nav = screen.getByRole('navigation', { name: 'Sections' })
    expect(
      within(nav).getByRole('link', { name: /Event details/ }).textContent,
    ).toContain('1 change')
    const location = screen.getByLabelText<HTMLInputElement>('Location')
    expect(location.closest('[data-changed]')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Max team size'), {
      target: { value: '6' },
    })
    expect(screen.getByText('2 changes from default')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset Location to default' }),
    )
    expect(location.value).toBe('')
    expect(location.closest('[data-changed]')).toBeNull()
    expect(screen.getByText('1 change from default')).toBeTruthy()
  })
  it('counts unsaved changes of the default preset against its saved version', async () => {
    await mount(<PresetEditor preset={preset} onSaved={vi.fn()} />)
    expect(screen.getByText('0 unsaved changes')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Preset name'), {
      target: { value: 'Renamed' },
    })
    fireEvent.change(screen.getByLabelText('Start time'), {
      target: { value: '12:00' },
    })
    expect(screen.getByText('2 unsaved changes')).toBeTruthy()
    const nav = screen.getByRole('navigation', { name: 'Sections' })
    expect(
      within(nav).getByRole('link', { name: /Schedule/ }).textContent,
    ).toContain('1 change')
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset Start time to saved value' }),
    )
    expect(screen.getByLabelText<HTMLInputElement>('Start time').value).toBe(
      '10:00',
    )
    expect(screen.getByText('1 unsaved change')).toBeTruthy()
    expect(
      within(nav)
        .getByRole('link', { name: /Basics/ })
        .getAttribute('aria-current'),
    ).toBe('location')
  })
  it('previews the schedule from the current values in Berlin time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-19T12:00:00Z'))
    await mount(<PresetEditor preset={preset} onSaved={vi.fn()} />)
    const card = screen
      .getByRole('heading', { name: 'Preview · if created today' })
      .closest('div')!
    expect(card.textContent).toContain('DateFri, 20 Nov 2026')
    expect(card.textContent).toContain('IntroductionOff')
    fireEvent.change(screen.getByLabelText('Start time'), {
      target: { value: '18:30' },
    })
    fireEvent.change(screen.getByLabelText('Submission deadline after hours'), {
      target: { value: '30' },
    })
    fireEvent.click(
      screen.getByRole('switch', { name: 'Optional introduction' }),
    )
    expect(card.textContent).toContain('Start18:30')
    expect(card.textContent).toContain('Introduction18:15')
    expect(card.textContent).toContain('Submission deadlineSun 22 Nov, 00:30')
    expect(card.textContent).toContain('Team size1–4')
    expect(card.textContent).toContain('Game serverdev')
    expect(card.textContent).toContain('Europe/Berlin')
    vi.useRealTimers()
  })
  it('keeps a cleared required schedule offset invalid and suppresses the preview', async () => {
    await mount(<PresetEditor preset={preset} onSaved={vi.fn()} />)
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
    expect(
      within(screen.getByRole('navigation', { name: 'Sections' })).getByRole(
        'link',
        { name: /Schedule/ },
      ).textContent,
    ).toContain('has issues')
    fireEvent.click(screen.getByRole('button', { name: 'Save as v3' }))
    await screen.findByRole('alert')
    expect(api.updatePreset).not.toHaveBeenCalled()
  })
  it('refuses a submission deadline at the start, as the API does', async () => {
    await mount(<PresetEditor preset={preset} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Submission deadline after hours'), {
      target: { value: '0' },
    })
    expect(
      screen.getByText(/An event created today would start on \w/),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save as v3' }))
    await screen.findByText(
      'Submission deadline after hours: The submission deadline must be after the start',
    )
    expect(api.updatePreset).not.toHaveBeenCalled()
  })
  it('does not let the default preset be unmarked as default', async () => {
    await mount(<PresetEditor preset={preset} onSaved={vi.fn()} />)
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
      <PresetEditor preset={preset} onSaved={vi.fn()} onReload={reload} />,
    )
    fireEvent.change(await screen.findByLabelText('Preset name'), {
      target: { value: 'My changes' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save as v3' }))
    fireEvent.click(await screen.findByText('Reload preset and discard edits'))
    expect(reload).toHaveBeenCalledOnce()
    expect(screen.getByLabelText<HTMLInputElement>('Preset name').value).toBe(
      'My changes',
    )
  })
  it('keeps the edited version until explicitly reloading after a conflict', async () => {
    const newer = { ...preset, name: 'Server version', version: 3 }
    vi.mocked(api.updatePreset).mockRejectedValue(
      conflict('Preset was changed by someone else'),
    )
    const client = await mount(<PresetEditorPage id="one" />)
    fireEvent.change(await screen.findByLabelText('Preset name'), {
      target: { value: 'My changes' },
    })

    vi.mocked(api.getAdminPreset).mockResolvedValue(newer)
    await act(async () => {
      await client.refetchQueries({ queryKey: ['admin', 'preset', 'one'] })
    })
    expect(screen.getByLabelText<HTMLInputElement>('Preset name').value).toBe(
      'My changes',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save as v3' }))
    fireEvent.click(await screen.findByText('Reload preset and discard edits'))
    expect(api.updatePreset).toHaveBeenCalledWith(
      'one',
      expect.objectContaining({ name: 'My changes', version: 2 }),
    )
    await screen.findByRole('heading', { level: 1, name: 'Server version' })
    expect(screen.getByLabelText<HTMLInputElement>('Preset name').value).toBe(
      'Server version',
    )
    expect(screen.getByRole('button', { name: 'Save as v4' })).toBeTruthy()
  })

  it('shows name conflicts inline without a version reload prompt', async () => {
    vi.mocked(api.updatePreset).mockRejectedValue(
      conflict('Preset name is already taken'),
    )
    await mount(<PresetEditor preset={preset} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save as v3' }))
    await screen.findByText('Preset name is already taken')
    expect(screen.queryByText('Reload preset and discard edits')).toBeNull()
  })
  it('offers only shared, active installations in the editor', async () => {
    vi.mocked(api.getAdminInstallations).mockResolvedValue([
      installation,
      {
        ...installation,
        id: 'shared',
        accountLogin: 'shared-core',
        sharedAt: '2026-11-13',
      },
      {
        ...installation,
        id: 'suspended',
        accountLogin: 'suspended-core',
        sharedAt: '2026-11-13',
        status: 'suspended',
      },
    ])
    await mount(<PresetEditor preset={preset} onSaved={vi.fn()} />)
    await screen.findByText('shared-core')
    expect(screen.queryByRole('option', { name: 'core' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'suspended-core' })).toBeNull()
  })
  it('keeps an unavailable installation on save and warns until it is replaced', async () => {
    const stale = {
      ...preset,
      githubInstallation: { id: 'uuid', accountLogin: 'core' },
      warnings: [unavailable],
    }
    vi.mocked(api.updatePreset).mockResolvedValue(stale)
    await mount(<PresetEditor preset={stale} onSaved={vi.fn()} />)
    const option = await screen.findByRole<HTMLOptionElement>('option', {
      name: 'core (unavailable)',
    })
    expect(option.disabled).toBe(true)
    expect(screen.getByText('1 warning').getAttribute('title')).toBe(
      unavailable,
    )
    expect(screen.getByRole('status').textContent).toContain(unavailable)
    expect(
      within(screen.getByRole('navigation', { name: 'Sections' })).getByRole(
        'link',
        { name: /GitHub/ },
      ).textContent,
    ).toContain('has issues')
    fireEvent.click(screen.getByRole('button', { name: 'Save as v3' }))
    await waitFor(() =>
      expect(api.updatePreset).toHaveBeenCalledWith(
        'one',
        expect.objectContaining({ githubInstallationId: 'uuid', version: 2 }),
      ),
    )
    fireEvent.change(screen.getByLabelText('Shared GitHub installation'), {
      target: { value: '' },
    })
    expect(screen.queryByRole('status')).toBeNull()
  })
})
describe('installation sharing', () => {
  const open = async () =>
    fireEvent.click(await screen.findByRole('button', { name: /^core/ }))
  const shareSwitch = () =>
    screen.getByRole('switch', { name: 'Shared with event creators' })
  it('explains and confirms sharing, then refreshes the list', async () => {
    vi.mocked(api.shareInstallation).mockResolvedValue({
      ...installation,
      sharedAt: 'now',
    })
    const client = await mount(<InstallationsPage />)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await open()
    fireEvent.click(shareSwitch())
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
  it('filters by sharing state and status with counts', async () => {
    vi.mocked(api.getAdminInstallations).mockResolvedValue([
      installation,
      { ...installation, id: 'b', accountLogin: 'berlin', sharedAt: 'now' },
      { ...installation, id: 'c', accountLogin: 'gone', status: 'uninstalled' },
    ])
    await mount(<InstallationsPage />)
    const chip = await screen.findByRole('button', { name: /^Inactive/ })
    expect(chip.textContent).toContain('1')
    fireEvent.click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /^gone/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^berlin/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Shared/ }))
    expect(screen.getByRole('button', { name: /^berlin/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^core/ })).toBeNull()
  })
  it('shows the events, permissions and GitHub link of an installation', async () => {
    await mount(<InstallationsPage />)
    await open()
    expect(
      (await screen.findByText('CORE Berlin'))
        .closest('a')
        ?.getAttribute('href'),
    ).toBe('/events/event')
    expect(screen.getByText('Members (read)').textContent).toContain('Missing')
    expect(screen.getByText('Contents (write)').textContent).toContain(
      'Granted',
    )
    expect(
      screen.getByRole('link', { name: 'Open on GitHub' }).getAttribute('href'),
    ).toBe('https://github.com/organizations/core/settings/installations/77')
  })
  it('sends the admin to GitHub to install the App on an organization', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    vi.mocked(api.getAdminInstallUrl).mockResolvedValue(
      'https://github.com/apps/core/installations/new?state=s',
    )
    await mount(<InstallationsPage />)
    const button = await screen.findByRole('button', {
      name: 'Install on an organization',
    })
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
    fireEvent.click(button)
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        'https://github.com/apps/core/installations/new?state=s',
      ),
    )
    vi.unstubAllGlobals()
  })
  it('disables installing when the App is not configured', async () => {
    vi.mocked(isGithubAppAvailable).mockResolvedValueOnce(false)
    await mount(<InstallationsPage />)
    expect(
      await screen.findByText(/not configured on this server/),
    ).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Install on an organization' })
        .hasAttribute('disabled'),
    ).toBe(true)
  })
  it('shows when an installation is no longer active', async () => {
    vi.mocked(api.getAdminInstallations).mockResolvedValue([
      { ...installation, sharedAt: 'now', status: 'suspended' },
    ])
    await mount(<InstallationsPage />)
    await open()
    expect(
      screen.getByText(/Not checked while the App is suspended/),
    ).toBeTruthy()
    expect(api.getAdminInstallation).toHaveBeenCalledWith('uuid')
  })
  it('unshares only after confirmation', async () => {
    vi.mocked(api.getAdminInstallations).mockResolvedValue([
      { ...installation, sharedAt: 'now' },
    ])
    await mount(<InstallationsPage />)
    await open()
    fireEvent.click(shareSwitch())
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
