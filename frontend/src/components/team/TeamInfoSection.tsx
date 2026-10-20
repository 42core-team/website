import type { Team, TeamMember } from '@/app/actions/team'

import { DialogTrigger } from '@radix-ui/react-dialog'
import {
  CircleAlert,
  ExternalLink,
  Lock,
  Plus,
  TriangleAlert,
} from 'lucide-react'
import { useParams } from '@/lib/router-hooks'
import { useState } from 'react'

import { GithubIcon } from '@/components/icons'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import TeamInviteModal from './TeamInviteModal'
import TeamMemberDisplay from './TeamMemberDisplay'
import { TeamProfileHeader } from './TeamProfileHeader'
import { TeamAppearanceEditor } from './TeamAppearanceEditor'

interface TeamInfoSectionProps {
  canEdit?: boolean
  myTeam: Team
  onLeaveTeam: () => Promise<boolean>
  isLeaving: boolean
  teamMembers: TeamMember[]
  githubOrg: string
  isRepoPending: boolean
  isRepoCreating: boolean
}

export function TeamInfoSection({
  myTeam,
  onLeaveTeam,
  isLeaving,
  teamMembers,
  isRepoPending,
  isRepoCreating,
  githubOrg,
  canEdit = true,
}: Readonly<TeamInfoSectionProps>) {
  const eventId = useParams().id as string
  const [isOpen, setIsOpen] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false)

  const getRepoUrl = () => {
    return `https://github.com/${githubOrg}/${myTeam.repo}`
  }

  const repositoryIcon = myTeam.locked ? (
    <span
      className="inline-flex shrink-0 items-center text-destructive"
      aria-label="Repository locked"
      title="Repository locked"
    >
      <Lock className="size-4" aria-hidden="true" />
    </span>
  ) : (
    <GithubIcon aria-hidden="true" />
  )

  const handleConfirmLeave = async () => {
    setLeaveError(null)
    const success = await onLeaveTeam()
    if (!success) {
      setLeaveError(
        'Failed to leave team. Try refreshing the page or trying again later.',
      )
      return
    }

    setIsLeaveDialogOpen(false)
  }

  return (
    <Card className="gap-0 overflow-hidden pt-0">
      <TeamProfileHeader
        team={myTeam}
        showBack={false}
        cover={
          canEdit ? (
            <TeamAppearanceEditor
              team={myTeam}
              eventId={eventId}
              kind="background"
            />
          ) : undefined
        }
        picture={
          canEdit ? (
            <TeamAppearanceEditor team={myTeam} eventId={eventId} />
          ) : undefined
        }
      />
      <CardContent className="flex flex-col gap-2">
        {myTeam.repositoryStatus === 'FAILED' && (
          <Alert variant="destructive">
            <CircleAlert className="size-4" aria-hidden="true" />
            <AlertTitle>Repository setup failed</AlertTitle>
            <AlertDescription>
              {myTeam.repositoryError ??
                'GitHub did not confirm your repository.'}{' '}
              Ask an event admin to fix it.
            </AlertDescription>
          </Alert>
        )}
        {myTeam.tournamentExcluded && (
          <Alert variant="warning" role="status">
            <TriangleAlert className="size-4" aria-hidden="true" />
            <AlertTitle>Excluded from the tournament</AlertTitle>
            <AlertDescription>
              This team will not play in the tournament.
            </AlertDescription>
          </Alert>
        )}
        <div className="mb-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Repository</p>
            <div className="font-medium">
              {myTeam.repo && githubOrg ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={cn(
                    'max-w-full gap-2 px-3',
                    myTeam.locked &&
                      'border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive',
                  )}
                >
                  <a
                    href={getRepoUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${myTeam.repo} repository on GitHub${myTeam.locked ? ' (locked)' : ''}`}
                  >
                    {repositoryIcon}
                    <span className="truncate">{myTeam.repo}</span>
                    <ExternalLink
                      className={
                        myTeam.locked
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      }
                      aria-hidden="true"
                    />
                  </a>
                </Button>
              ) : myTeam.repo ? (
                <span
                  className={cn(
                    'inline-flex max-w-full items-center gap-2',
                    myTeam.locked && 'text-destructive',
                  )}
                >
                  {repositoryIcon}
                  <span className="truncate">{myTeam.repo}</span>
                </span>
              ) : isRepoPending ? (
                <p className="text-sm text-gray-200">
                  Repository will be created when the event starts.
                </p>
              ) : isRepoCreating ? (
                <p className="text-sm text-gray-200">
                  Repository is being created...
                </p>
              ) : (
                <Skeleton className="m-2 h-5 w-72 rounded-md" />
              )}
            </div>
          </div>
        </div>

        {/* Team Members Section */}
        <section aria-label="Team members" className="rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Members</h3>
            {canEdit && (
              <Button size="sm" onClick={() => setIsOpen(true)}>
                <Plus className="size-4" />
                Invite Others
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-3">
            {teamMembers.length > 0 ? (
              teamMembers.map((member) => (
                <TeamMemberDisplay
                  key={member.id}
                  member={member}
                  highlightAdmin
                />
              ))
            ) : (
              <p className="col-span-full text-center text-muted-foreground">
                No team members found
              </p>
            )}
          </div>
        </section>

        {/* Team Management Compartment */}
        <div>
          {leaveError && (
            <div className="bg-danger-50 text-destructive-700 border-danger-200 mb-4 rounded-md border px-4 py-3">
              {leaveError}
            </div>
          )}
          <div className="flex items-center justify-end">
            {canEdit && (
              <Dialog
                open={isLeaveDialogOpen}
                onOpenChange={setIsLeaveDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="destructive" disabled={isLeaving}>
                    Leave Team
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">
                      Leave Team
                    </DialogTitle>
                  </DialogHeader>
                  <DialogDescription asChild>
                    <div>
                      Are you sure you want to leave this team? This action
                      cannot be undone.
                      {teamMembers.length === 1 && (
                        <div className="mt-2 text-destructive">
                          Warning: You are the last member of this team. Leaving
                          will delete the team.
                        </div>
                      )}
                    </div>
                  </DialogDescription>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button className="mr-2">Cancel</Button>
                    </DialogClose>
                    <Button
                      type="submit"
                      variant="destructive"
                      onClick={handleConfirmLeave}
                      isLoading={isLeaving}
                    >
                      Leave Team
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Invite Modal */}
        <TeamInviteModal
          isOpen={isOpen && canEdit}
          onClose={() => setIsOpen(false)}
          teamId={myTeam.id}
          eventId={eventId}
        />
      </CardContent>
    </Card>
  )
}

export default TeamInfoSection
