import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import axiosInstance from '@/app/actions/axios'

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

async function fetchCurrentUser(): Promise<ClientSession | null> {
  const response = await axiosInstance.get<ClientUser>('/auth/me')
  return {
    user: {
      ...response.data,
      name: response.data.name || response.data.username,
    },
  }
}

export function useSession() {
  const query = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
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
  return children
}

export function useSignOut() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => axiosInstance.post('/auth/logout'),
    onSettled: async () => {
      queryClient.setQueryData(['auth', 'session'], null)
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })
}
