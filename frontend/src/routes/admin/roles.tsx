import { createFileRoute, Navigate } from '@tanstack/react-router'
import { UsersManager } from '@/components/users/users-manager'
import { Spinner } from '@/components/ui/spinner'
import { useSession } from '@/lib/auth'

export const Route = createFileRoute('/admin/roles')({ component: UsersRoute })

function UsersRoute() {
  const { data: session, status } = useSession()
  if (status === 'loading')
    return (
      <main className="flex justify-center p-16">
        <Spinner />
      </main>
    )
  if (!session?.user.abilities.admin) return <Navigate to="/" replace />
  return (
    <main className="container mx-auto px-4 py-8">
      <UsersManager />
    </main>
  )
}
