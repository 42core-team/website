'use client'

import type { Team } from '@/app/actions/team'
import type { Match } from '@/app/actions/tournament-model'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BarChart3, Expand, Network, Rows3 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { myTeamQueryFn, myTeamQueryKey } from '@/app/events/my-team-queries'
import {
  AdminBracketStepper,
  getStreamVisibleMatches,
} from '@/components/tournament/admin-bracket-stepper'
import { BracketGraphView } from '@/components/tournament/bracket-graph-view'
import { BracketRankingTable } from '@/components/tournament/bracket-ranking-table'
import { GroupPhaseGraphView } from '@/components/tournament/group-phase-graph-view'
import { GroupPhaseRankingTable } from '@/components/tournament/group-phase-ranking-table'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTabParam } from '@/hooks/useTabParam'

interface GroupPhaseTabsProps {
  eventId: string
  matches: Match[]
  teams: Team[]
  isEventAdmin: boolean
  advancementCount: number
}

export function GroupPhaseTabs({
  eventId,
  matches,
  teams,
  isEventAdmin,
  advancementCount,
}: GroupPhaseTabsProps) {
  const { currentTab, onTabChange } = useTabParam('graph')
  const myTeamQuery = useQuery({
    queryKey: myTeamQueryKey(eventId),
    queryFn: () => myTeamQueryFn(eventId),
  })

  return (
    <Tabs value={currentTab} onValueChange={onTabChange} className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <TabsList className="border bg-muted/50 p-1">
          <TabsTrigger value="graph" className="gap-2 px-4">
            <Rows3 className="h-4 w-4" />
            Rounds
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-2 px-4">
            <BarChart3 className="h-4 w-4" />
            Ranking
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="graph" className="mt-0">
        <GroupPhaseGraphView
          matches={matches}
          isEventAdmin={isEventAdmin}
          myTeamId={myTeamQuery.data?.id}
        />
      </TabsContent>

      <TabsContent value="ranking" className="mt-0">
        <GroupPhaseRankingTable
          teams={teams}
          matches={matches}
          eventId={eventId}
          advancementCount={advancementCount}
        />
      </TabsContent>
    </Tabs>
  )
}

interface BracketTabsProps {
  eventId: string
  matches: Match[]
  teams: Team[]
  isEventAdmin: boolean
  teamCount: number
  isAdminReveal: boolean
}

export function BracketTabs({
  eventId,
  matches,
  teams,
  isEventAdmin,
  teamCount,
  isAdminReveal,
}: BracketTabsProps) {
  const { currentTab, onTabChange } = useTabParam('graph')
  const [selectedMatchId, setSelectedMatchId] = useState<string>()
  const [isRevealDialogOpen, setRevealDialogOpen] = useState(isAdminReveal)
  const streamVisibleMatches = useMemo(
    () => getStreamVisibleMatches(matches),
    [matches],
  )
  const selectMatch = useCallback((matchId?: string) => {
    setSelectedMatchId(matchId)
  }, [])

  useEffect(() => {
    setRevealDialogOpen(isAdminReveal)
  }, [isAdminReveal])

  return (
    <>
      <Tabs value={currentTab} onValueChange={onTabChange} className="w-full">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList className="border bg-muted/50 p-1">
            <TabsTrigger value="graph" className="gap-2 px-4">
              <Network className="h-4 w-4" />
              Graph
            </TabsTrigger>
            <TabsTrigger value="ranking" className="gap-2 px-4">
              <BarChart3 className="h-4 w-4" />
              Ranking
            </TabsTrigger>
          </TabsList>
          {isEventAdmin && isAdminReveal && (
            <Button onClick={() => setRevealDialogOpen(true)}>
              <Expand />
              Open reveal mode
            </Button>
          )}
        </div>

        <TabsContent value="graph" className="mt-0">
          <div className="relative h-[60vh] min-h-[400px] overflow-hidden rounded-xl border bg-card/50 text-card-foreground shadow-sm md:h-[75vh] md:min-h-[600px] md:rounded-2xl">
            <BracketGraphView
              matches={streamVisibleMatches}
              teamCount={teamCount}
              isEventAdmin={isEventAdmin}
            />
          </div>
        </TabsContent>

        <TabsContent value="ranking" className="mt-0">
          <BracketRankingTable
            teams={teams}
            matches={streamVisibleMatches}
            eventId={eventId}
          />
        </TabsContent>
      </Tabs>

      {isEventAdmin && isAdminReveal && (
        <Dialog open={isRevealDialogOpen} onOpenChange={setRevealDialogOpen}>
          <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[96rem] grid-rows-none flex-col gap-4 overflow-hidden border-primary/20 bg-background/95 p-4 shadow-2xl backdrop-blur-xl duration-500 data-[state=closed]:slide-out-to-bottom-8 data-[state=closed]:zoom-out-90 data-[state=open]:slide-in-from-bottom-8 data-[state=open]:zoom-in-90 sm:p-6">
            <motion.div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent"
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.15, duration: 0.6, ease: 'easeOut' }}
            />
            <DialogHeader className="shrink-0 pr-8">
              <DialogTitle className="text-xl">Admin reveal mode</DialogTitle>
              <DialogDescription>
                Review matches from left to right. Nothing is revealed until you
                use the controls below.
              </DialogDescription>
            </DialogHeader>

            <motion.div
              className="shrink-0"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.35, ease: 'easeOut' }}
            >
              <AdminBracketStepper
                eventId={eventId}
                matches={matches}
                onSelectedMatchChange={selectMatch}
              />
            </motion.div>

            <motion.div
              className="relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-card/50 text-card-foreground shadow-sm"
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.22, duration: 0.42, ease: 'easeOut' }}
            >
              <BracketGraphView
                matches={streamVisibleMatches}
                teamCount={teamCount}
                isEventAdmin={isEventAdmin}
                highlightedMatchId={selectedMatchId}
              />
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
