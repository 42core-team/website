import { createFileRoute } from '@tanstack/react-router'
import DatenschutzPage from '@/app/DatenschutzPage'

export const Route = createFileRoute('/datenschutz')({
  component: DatenschutzPage,
})
