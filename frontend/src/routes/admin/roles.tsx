import { createFileRoute, Navigate } from '@tanstack/react-router'
import { UsersTable } from '@/components/users/users-table'
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
    <main className="page-frame page-workspace space-y-4 py-8">
      <h1 className="page-title">Users</h1>
      <UsersTable />
    </main>
  )
}
