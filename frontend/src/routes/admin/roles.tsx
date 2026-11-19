import { PageHeader, PageLayout } from '@/layouts/page-layout'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { UsersTable } from '@/components/users/users-table'
import { PageLoader } from '@/components/ui/page-loader'
import { useSession } from '@/lib/auth'

export const Route = createFileRoute('/admin/roles')({ component: UsersRoute })

function UsersRoute() {
  const { data: session, status } = useSession()
  if (status === 'loading') return <PageLoader frame="workspace" />
  if (!session?.user.abilities.admin) return <Navigate to="/" replace />
  return (
    <PageLayout frame="workspace">
      <PageHeader title="Users" />
      <UsersTable />
    </PageLayout>
  )
}
