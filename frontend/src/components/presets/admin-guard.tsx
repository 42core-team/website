import type { ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useSession } from '@/lib/auth'
import { Spinner } from '@/components/ui/spinner'

export function AdminGuard({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  if (status === 'loading') return <Spinner />
  if (!session?.user.abilities.admin) return <Navigate to="/" replace />
  return children
}
