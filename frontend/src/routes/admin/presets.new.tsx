import { createFileRoute } from '@tanstack/react-router'
import { AdminGuard } from '@/components/presets/admin-guard'
import { PresetEditorPage } from '@/components/presets/preset-editor'

export const Route = createFileRoute('/admin/presets/new')({
  component: () => (
    <AdminGuard>
      <PresetEditorPage />
    </AdminGuard>
  ),
})
