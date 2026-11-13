import { AxiosError } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import axiosInstance from '@/app/actions/axios'
import { getRoles, grantRole, removeRole, roleErrorMessage } from './roles'

afterEach(() => vi.restoreAllMocks())
describe('roles API contract', () => {
  it('passes filters, scope, and role ids to the admin API', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: [] })
    const post = vi
      .spyOn(axiosInstance, 'post')
      .mockResolvedValue({ data: { id: 'grant' } })
    const del = vi
      .spyOn(axiosInstance, 'delete')
      .mockResolvedValue({ status: 204 })
    await expect(getRoles({ userId: 'ada', eventId: 'cup' })).resolves.toEqual(
      [],
    )
    expect(get).toHaveBeenCalledWith('/admin/roles', {
      params: { userId: 'ada', eventId: 'cup' },
    })
    await expect(
      grantRole({ userId: 'ada', role: 'MODERATOR', eventId: 'cup' }),
    ).resolves.toEqual({ id: 'grant' })
    expect(post).toHaveBeenCalledWith('/admin/roles', {
      userId: 'ada',
      role: 'MODERATOR',
      eventId: 'cup',
    })
    await removeRole('grant')
    expect(del).toHaveBeenCalledWith('/admin/roles/grant')
  })
  it.each([
    [409, 'grant', 'already has that role'],
    [409, 'remove', "Can't remove the last global admin"],
    [400, 'grant', 'Only Admin and Moderator'],
    [404, 'grant', 'no longer exists'],
    [403, 'remove', 'no longer have permission'],
  ] as const)('explains %s on %s', (status, operation, message) => {
    const error = new AxiosError('request failed')
    error.response = { status } as AxiosError['response']
    expect(roleErrorMessage(error, operation)).toContain(message)
  })
  it('names the event when its last admin cannot be removed', () => {
    const error = new AxiosError('request failed')
    error.response = { status: 409 } as AxiosError['response']
    expect(roleErrorMessage(error, 'remove', true)).toBe(
      "Can't remove the last admin of this event.",
    )
  })
})
