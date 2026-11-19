import { PageLayout } from '@/layouts/page-layout'
import type { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { PageError } from '@/components/ui/page-error'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getUserProfile, profileQueryKeys } from '@/app/actions/profile'
import { useTabParam } from '@/hooks/useTabParam'
import { ProfileHeader } from './ProfileHeader'
import { ProfileMatches } from './ProfileMatches'
import { ProfileOverview } from './ProfileOverview'
import { ProfileTeams } from './ProfileTeams'
import { totalMatches } from './profile-stats'

const TABS = ['overview', 'teams', 'matches'] as const

export function ProfileView({ username }: { username: string }) {
  const { currentTab, onTabChange } = useTabParam('overview')
  const query = useQuery({
    queryKey: profileQueryKeys.profile(username),
    queryFn: () => getUserProfile(username),
    retry: (count, error) =>
      (error as AxiosError).response?.status !== 404 && count < 2,
  })

  if (query.isPending) return <ProfileSkeleton />
  if (query.isError) {
    const status = (query.error as AxiosError).response?.status
    return (
      <PageError
        title={
          status === 404 ? 'Player not found' : 'Could not load this profile'
        }
        description={
          status === 404
            ? `Nobody called @${username} has played CORE yet.`
            : 'Try again in a moment.'
        }
      />
    )
  }

  const profile = query.data
  const tab = TABS.includes(currentTab as (typeof TABS)[number])
    ? currentTab
    : 'overview'

  return (
    <PageLayout>
      <ProfileHeader profile={profile} />
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="teams">
            Teams ({profile.teams.length})
          </TabsTrigger>
          <TabsTrigger value="matches">
            Match History ({totalMatches(profile.summary.record)})
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
    </PageLayout>
  )
}

function ProfileSkeleton() {
  return (
    <PageLayout aria-busy>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-9 w-full max-w-80 rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </PageLayout>
  )
}
