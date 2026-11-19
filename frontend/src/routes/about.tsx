import { createFileRoute } from '@tanstack/react-router'
import AboutPageClient from '@/app/aboutPage'

export const Route = createFileRoute('/about')({
  component: AboutRoute,
})

function AboutRoute() {
  return (
    <main className="page-frame py-12">
      <AboutPageClient />
    </main>
  )
}
