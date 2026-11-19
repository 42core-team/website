import type { ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useSession } from '@/lib/auth'
import { PageLoader } from '@/components/ui/page-loader'

export function AdminGuard({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  if (status === 'loading') return <PageLoader frame="workspace" />
  if (!session?.user.abilities.admin) return <Navigate to="/" replace />
  return children
}
