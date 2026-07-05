import { createFileRoute } from '@tanstack/react-router'
import ImpressumPage from '@/app/ImpressumPage'

export const Route = createFileRoute('/impressum')({
  component: ImpressumPage,
})
