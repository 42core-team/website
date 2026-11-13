import { createFileRoute } from '@tanstack/react-router'
import SettingsClient from '@/app/settings/SettingsClient'

export const Route = createFileRoute('/settings')({
  component: SettingsClient,
})
