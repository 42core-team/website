import { afterEach, describe, expect, it, vi } from 'vitest'
import axiosInstance from './axios'
import * as api from './presets'
import { defaultSettings } from '@/components/presets/settings'

afterEach(() => vi.restoreAllMocks())
describe('presets API contract', () => {
  it('uses organizer and admin list/detail endpoints', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: [] })
    await api.getPresets()
    expect(get).toHaveBeenLastCalledWith('/event-presets')
    await api.resolvePreset('id')
    expect(get).toHaveBeenLastCalledWith('/event-presets/id/resolved')
    await api.getAdminPresets(true)
    expect(get).toHaveBeenLastCalledWith('/admin/event-presets', {
      params: { includeArchived: true },
    })
    await api.getAdminPreset('id')
    expect(get).toHaveBeenLastCalledWith('/admin/event-presets/id')
    await api.getAdminInstallations()
    expect(get).toHaveBeenLastCalledWith('/admin/github-installations')
    await api.getCreateInstallations()
    expect(get).toHaveBeenLastCalledWith('/github/installations')
  })
  it('uses versioned updates and separate duplicate/archive actions', async () => {
    const post = vi
      .spyOn(axiosInstance, 'post')
      .mockResolvedValue({ data: { id: 'id' } })
    const put = vi
      .spyOn(axiosInstance, 'put')
      .mockResolvedValue({ data: { id: 'id' } })
    const input = { name: 'Cup', settings: defaultSettings }
    await api.createPreset(input)
    expect(post).toHaveBeenLastCalledWith('/admin/event-presets', input)
    await api.updatePreset('id', { ...input, version: 3 })
    expect(put).toHaveBeenLastCalledWith('/admin/event-presets/id', {
      ...input,
      version: 3,
    })
    await api.duplicatePreset('id')
    expect(post).toHaveBeenLastCalledWith('/admin/event-presets/id/duplicate')
    await api.archivePreset('id')
    expect(post).toHaveBeenLastCalledWith('/admin/event-presets/id/archive')
    await api.unarchivePreset('id')
    expect(post).toHaveBeenLastCalledWith('/admin/event-presets/id/unarchive')
  })
  it('shares with POST and unshares with DELETE using the entity UUID', async () => {
    const post = vi
      .spyOn(axiosInstance, 'post')
      .mockResolvedValue({ data: { id: 'uuid' } })
    const remove = vi
      .spyOn(axiosInstance, 'delete')
      .mockResolvedValue({ status: 204 })
    await expect(api.shareInstallation('uuid')).resolves.toEqual({ id: 'uuid' })
    expect(post).toHaveBeenCalledWith('/admin/github-installations/uuid/share')
    await expect(api.unshareInstallation('uuid')).resolves.toBeUndefined()
    expect(remove).toHaveBeenCalledWith(
      '/admin/github-installations/uuid/share',
    )
  })
})
