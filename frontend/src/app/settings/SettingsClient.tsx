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

  if (status === 'loading') return <PageLoader />
  if (!session) return null

  return (
    <main className="page-frame page-form py-8">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="page-title">Settings</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Manage your account and linked social platforms
          </p>
        </div>

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
      </div>
    </main>
  )
}
