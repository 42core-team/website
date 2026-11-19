import { isAxiosError } from 'axios'
import axiosInstance from '@/app/actions/axios'
import type { UserSearchResult } from '@/app/actions/user'

export const ROLE_LABELS = {
  ADMIN: 'Admin',
  MODERATOR: 'Moderator',
  PUBLIC_EVENT_CREATOR: 'Public event creator',
  PRIVATE_EVENT_CREATOR: 'Private event creator',
} as const
export type Role = keyof typeof ROLE_LABELS
export interface RoleGrant {
  id: string
  role: Role
  eventId: string | null
  event?: { id: string; name: string } | null
  user: UserSearchResult
  grantedBy?: { id: string; username: string } | null
  createdAt: string
}
export interface GrantRoleParams {
  userId: string
  role: Role
  eventId?: string
}
export interface AdminEventSearchResult {
  id: string
  name: string
  isPrivate: boolean
  startDate: string
}
export async function searchAdminEvents(q: string) {
  return (
    await axiosInstance.get<AdminEventSearchResult[]>('/admin/events', {
      params: { q, limit: 20 },
    })
  ).data
}
export async function getRoles(
  filters: { userId?: string; eventId?: string } = {},
) {
  return (
    await axiosInstance.get<RoleGrant[]>('/admin/roles', { params: filters })
  ).data
}
export async function grantRole(params: GrantRoleParams) {
  return (await axiosInstance.post<RoleGrant>('/admin/roles', params)).data
}
export async function removeRole(id: string) {
  await axiosInstance.delete(`/admin/roles/${encodeURIComponent(id)}`)
}
/** `eventScoped` tells a removal's two 409s apart: global or event admin. */
export function roleErrorMessage(
  error: unknown,
  operation: 'grant' | 'remove',
  eventScoped = false,
) {
  if (isAxiosError(error)) {
    switch (error.response?.status) {
      case 409:
        if (operation === 'grant') return 'This user already has that role.'
        return eventScoped
          ? "Can't remove the last admin of this event."
          : "Can't remove the last global admin."
      case 400:
        return 'Invalid role or event scope. Only Admin and Moderator can be scoped to an event.'
      case 404:
        return 'The user, event, or role no longer exists. Refresh and try again.'
      case 403:
        return 'You no longer have permission to manage roles.'
    }
  }
  return operation === 'grant'
    ? 'Failed to grant role. Please try again.'
    : 'Failed to remove role. Please try again.'
}
