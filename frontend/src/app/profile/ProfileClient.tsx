'use client'

import { useSession } from '@/lib/auth'
import { useRouter } from '@/lib/router-hooks'
import { useEffect } from 'react'
import { ProfileView } from '@/components/profile/ProfileView'
import { PageLoader } from '@/components/ui/page-loader'
import { takeFortyTwoLinkingReturn } from '@/hooks/use42Linking'

export default function ProfileClient() {
  const router = useRouter()
  const { data: session, status } = useSession()

  // Deployments whose 42 redirect still points at /profile send the linking
  // result here; it belongs on the settings page.
  useEffect(() => {
    if (takeFortyTwoLinkingReturn(window.location.search))
      router.replace(`/settings${window.location.search}`)
  }, [router])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/')
    }
  }, [status, router])

  if (status === 'loading') return <PageLoader />
  if (!session) return null

  return <ProfileView username={session.user.username} />
}
