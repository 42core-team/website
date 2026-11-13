import type { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getUserProfile } from '@/app/actions/profile'
import { useTabParam } from '@/hooks/useTabParam'
import { ProfileHeader } from './ProfileHeader'
import { ProfileMatches } from './ProfileMatches'
import { ProfileOverview } from './ProfileOverview'
import { ProfileTeams } from './ProfileTeams'

export function profileQueryKey(username: string) {
  return ['profile', username.toLowerCase()] as const
}

const TABS = ['overview', 'teams', 'matches'] as const

export function ProfileView({ username }: { username: string }) {
  const { currentTab, onTabChange } = useTabParam('overview')
  const query = useQuery({
    queryKey: profileQueryKey(username),
    queryFn: () => getUserProfile(username),
    retry: (count, error) =>
      (error as AxiosError).response?.status !== 404 && count < 2,
  })

  if (query.isPending) return <ProfileSkeleton />
  if (query.isError) {
    const status = (query.error as AxiosError).response?.status
    return (
      <div className="container mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">
          {status === 404 ? 'Player not found' : 'Could not load this profile'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {status === 404
            ? `Nobody called @${username} has played CORE yet.`
            : 'Try again in a moment.'}
        </p>
      </div>
    )
  }

  const profile = query.data
  const tab = TABS.includes(currentTab as (typeof TABS)[number])
    ? currentTab
    : 'overview'

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="space-y-6">
        <ProfileHeader profile={profile} />
        <Tabs value={tab} onValueChange={onTabChange}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="teams">
              Teams ({profile.teams.length})
            </TabsTrigger>
            <TabsTrigger value="matches">
              Match History ({profile.matches.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6">
            <ProfileOverview profile={profile} />
          </TabsContent>
          <TabsContent value="teams" className="mt-6">
            <ProfileTeams profile={profile} />
          </TabsContent>
          <TabsContent value="matches" className="mt-6">
            <ProfileMatches profile={profile} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

function ProfileSkeleton() {
  return (
    <main aria-busy className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-9 w-80 rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </main>
  )
}
