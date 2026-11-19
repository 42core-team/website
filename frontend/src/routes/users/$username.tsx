import { createFileRoute } from '@tanstack/react-router'
import GithubLoginButton from '@/components/github'
import { ProfileView } from '@/components/profile/ProfileView'
import { PageLoader } from '@/components/ui/page-loader'
import { useSession } from '@/lib/auth'

export const Route = createFileRoute('/users/$username')({
  component: UserProfileRoute,
})

function UserProfileRoute() {
  const { username } = Route.useParams()
  const { data: session, status } = useSession()

  if (status === 'loading') return <PageLoader />
  if (!session)
    return (
      <div className="container mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Sign in to see player profiles</h1>
        <p className="text-muted-foreground">
          Profiles list matches and replays, which are only shown to signed-in
          players.
        </p>
        <GithubLoginButton />
      </div>
    )

  return <ProfileView key={username} username={username} />
}
