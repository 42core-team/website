import { PageLayout } from '@/layouts/page-layout'
import { createFileRoute } from '@tanstack/react-router'
import AboutPageClient from '@/app/aboutPage'

export const Route = createFileRoute('/about')({
  component: AboutRoute,
})

function AboutRoute() {
  return (
    <PageLayout>
      <AboutPageClient />
    </PageLayout>
  )
}
