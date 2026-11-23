import { createFileRoute } from '@tanstack/react-router'
import { AdminGuard } from '@/components/presets/admin-guard'
import { PresetEditorPage } from '@/components/presets/preset-editor'

export const Route = createFileRoute('/admin/presets/$id')({
  component: PresetRoute,
})
function PresetRoute() {
  const { id } = Route.useParams()
  return (
    <AdminGuard>
      <PresetEditorPage key={id} id={id} />
    </AdminGuard>
  )
}
