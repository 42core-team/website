import { PageHeader, PageLayout } from '@/layouts/page-layout'
import { useEffect } from 'react'
import { UserAppearanceEditor } from '@/components/profile/UserAppearanceEditor'
import SocialAccountsDisplay from '@/components/social-accounts-display'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageLoader } from '@/components/ui/page-loader'
import { User } from '@/components/user'
import { useSession } from '@/lib/auth'
import { userAvatarSrc } from '@/lib/user-avatar'
import { useRouter } from '@/lib/router-hooks'
import SignOutEverywhereCard from './SignOutEverywhereCard'

export default function SettingsClient() {
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/')
    }
  }, [status, router])

  if (!session) return <PageLoader frame="form" />

  return (
    <PageLayout frame="form">
      <PageHeader
        title="Settings"
        description="Manage your account and linked social platforms"
      />

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <User
            name={session.user.name}
            description={session.user.email}
            avatarProps={{
              src: userAvatarSrc(session.user) || '/placeholder-avatar.png',
              size: 'lg',
              isBordered: true,
            }}
            className="justify-start gap-4"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-2 pb-4">
          <UserAppearanceEditor user={session.user} kind="background" />
          <div className="flex items-center gap-4">
            <UserAppearanceEditor user={session.user} kind="picture" />
            <p className="text-sm text-muted-foreground">
              Upload a picture and background for your profile. Without a
              picture, your GitHub avatar is used.
            </p>
          </div>
        </CardContent>
      </Card>

      <SocialAccountsDisplay />

      <SignOutEverywhereCard />
    </PageLayout>
  )
}
