import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import axiosInstance, { onSessionExpired } from '@/app/actions/axios'

export interface ClientUser {
  id: string
  username: string
  name: string
  email: string
  profilePicture: string
}

export interface ClientSession {
  user: ClientUser
}

const SESSION_QUERY_KEY = ['auth', 'session'] as const

async function fetchCurrentUser(): Promise<ClientSession | null> {
  const response = await axiosInstance.get<ClientUser>('/auth/me')
  return {
    user: {
      ...response.data,
      name: response.data.name || response.data.username,
    },
  }
}

/**
 * Marks the user as logged out and drops everything cached for them, such as
 * admin-only team data, so the next user of this tab cannot read it. Resetting
 * also discards responses still in flight. Active queries refetch; if those
 * hit a 401 and end here again, the session is already gone and nothing resets,
 * so this cannot loop.
 */
function endSession(queryClient: QueryClient) {
  const hadSession = Boolean(queryClient.getQueryData(SESSION_QUERY_KEY))
  queryClient.setQueryData(SESSION_QUERY_KEY, null)
  if (hadSession) {
    void queryClient.resetQueries({
      predicate: (query) => query.queryKey[0] !== 'auth',
    })
  }
}

async function clearSession(queryClient: QueryClient) {
  endSession(queryClient)
  await queryClient.invalidateQueries({ queryKey: ['auth'] })
}

export function useSession() {
  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchCurrentUser,
    retry: false,
  })

  return {
    data: query.data ?? null,
    status: query.isPending
      ? 'loading'
      : query.data
        ? 'authenticated'
        : 'unauthenticated',
    update: query.refetch,
  } as const
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  useEffect(
    () =>
      onSessionExpired(() => {
        endSession(queryClient)
      }),
    [queryClient],
  )

  return children
}

export function useSignOut() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => axiosInstance.post('/auth/logout'),
    onSettled: () => clearSession(queryClient),
  })
}

/**
 * Revokes every session of the current user, on all devices (ADR 0002).
 * Unlike `useSignOut`, the local session is only cleared on success, so a
 * failed request does not pretend the other devices were logged out.
 */
export function useSignOutEverywhere() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => axiosInstance.post('/auth/logout-all'),
    onSuccess: () => clearSession(queryClient),
  })
}
