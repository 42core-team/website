'use client'

import type { Match } from '@/app/actions/tournament-model'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { revealMatch } from '@/app/actions/tournament'
import { MatchState } from '@/app/actions/tournament-model'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRouter } from '@/lib/router-hooks'

interface AdminBracketStepperProps {
  eventId: string
  matches: Match[]
  onSelectedMatchChange: (matchId?: string) => void
}

export function orderMatchesForReveal(matches: Match[]) {
  return matches
    .map((match, originalIndex) => ({ match, originalIndex }))
    .sort((left, right) => {
      if (left.match.round !== right.match.round) {
        return left.match.round - right.match.round
      }

      if (
        Boolean(left.match.isPlacementMatch) !==
        Boolean(right.match.isPlacementMatch)
      ) {
        return left.match.isPlacementMatch ? 1 : -1
      }

      const createdAtDifference =
        new Date(left.match.createdAt).getTime() -
        new Date(right.match.createdAt).getTime()

      return createdAtDifference || left.originalIndex - right.originalIndex
    })
    .map(({ match }) => match)
}

export function getInitialRevealIndex(matches: Match[]) {
  const firstReadyMatch = matches.findIndex(
    (match) => !match.isRevealed && match.state === MatchState.FINISHED,
  )
  if (firstReadyMatch >= 0) return firstReadyMatch

  const firstUnrevealedMatch = matches.findIndex((match) => !match.isRevealed)
  return Math.max(firstUnrevealedMatch, 0)
}

export function getStreamVisibleMatches(matches: Match[]): Match[] {
  return matches.map((match) => {
    if (match.isRevealed) return match

    return {
      ...match,
      state: MatchState.PLANNED,
      winner: undefined,
      results: [],
    }
  })
}

function getMatchLabel(match: Match, index: number) {
  if (match.isPlacementMatch) return 'Third-place match'
  return `Match ${index + 1}`
}

function getCompetitors(match: Match) {
  if (match.teams.length === 0) return 'Teams to be decided'
  return match.teams.map((team) => team.name).join(' vs ')
}

export function AdminBracketStepper({
  eventId,
  matches,
  onSelectedMatchChange,
}: AdminBracketStepperProps) {
  const orderedMatches = useMemo(
    () => orderMatchesForReveal(matches),
    [matches],
  )
  const [currentIndex, setCurrentIndex] = useState(() =>
    getInitialRevealIndex(orderedMatches),
  )
  const queryClient = useQueryClient()
  const router = useRouter()
  const matchListRef = useRef<HTMLDivElement>(null)

  const safeIndex = Math.min(
    currentIndex,
    Math.max(orderedMatches.length - 1, 0),
  )
  const currentMatch: Match | undefined = orderedMatches.at(safeIndex)

  useEffect(() => {
    if (currentIndex !== safeIndex) setCurrentIndex(safeIndex)
  }, [currentIndex, safeIndex])

  useEffect(() => {
    onSelectedMatchChange(currentMatch?.id)
  }, [currentMatch?.id, onSelectedMatchChange])

  useEffect(() => {
    const selectedMatch = matchListRef.current?.querySelector(
      `[data-match-index="${safeIndex}"]`,
    )
    selectedMatch?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [safeIndex])

  const revealMutation = useMutation({
    mutationFn: ({ matchId }: { matchId: string; index: number }) =>
      revealMatch(matchId),
    onSuccess: async (_data, { index }) => {
      await queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      toast.success('Match revealed. The tournament tree is up to date.')
      setCurrentIndex((selectedIndex) =>
        selectedIndex === index
          ? Math.min(index + 1, orderedMatches.length - 1)
          : selectedIndex,
      )
    },
    onError: () => toast.error('Failed to reveal this match.'),
  })

  if (!currentMatch) return null

  const isLastMatch = safeIndex === orderedMatches.length - 1
  const canReveal =
    Boolean(currentMatch.id) && currentMatch.state === MatchState.FINISHED
  const nextLabel = currentMatch.isRevealed
    ? isLastMatch
      ? 'All matches reviewed'
      : 'Next match'
    : isLastMatch
      ? 'Reveal match'
      : 'Reveal & next'

  const goToNextMatch = () => {
    if (currentMatch.isRevealed) {
      setCurrentIndex((index) => Math.min(index + 1, orderedMatches.length - 1))
      return
    }

    if (currentMatch.id && canReveal) {
      revealMutation.mutate({ matchId: currentMatch.id, index: safeIndex })
    }
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-3 shadow-sm md:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Reveal order</p>
        <Badge variant="outline" className="w-fit whitespace-nowrap">
          {safeIndex + 1} of {orderedMatches.length}
        </Badge>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-emerald-500"
          initial={false}
          animate={{
            width: `${((safeIndex + 1) / orderedMatches.length) * 100}%`,
          }}
          transition={{ type: 'spring', stiffness: 180, damping: 24 }}
        />
      </div>

      <div
        ref={matchListRef}
        role="list"
        aria-label="Tournament matches in reveal order"
        className="flex gap-2 overflow-x-auto pb-2"
      >
        {orderedMatches.map((match, index) => {
          const isSelected = index === safeIndex
          return (
            <motion.button
              key={match.id ?? `${match.round}-${index}`}
              type="button"
              data-match-index={index}
              role="listitem"
              aria-current={isSelected ? 'step' : undefined}
              onClick={() => setCurrentIndex(index)}
              disabled={revealMutation.isPending}
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: isSelected ? 1.025 : 1,
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{
                delay: Math.min(index * 0.035, 0.28),
                duration: 0.25,
              }}
              className={cn(
                'min-w-40 rounded-lg border px-3 py-2 text-left shadow-xs transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                isSelected
                  ? 'border-primary bg-primary/10 shadow-primary/10'
                  : 'bg-background hover:bg-muted/60',
              )}
            >
              <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Round {match.round + 1}</span>
                {match.isRevealed && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Check className="size-3" />
                    Revealed
                  </span>
                )}
              </span>
              <span className="mt-1 block text-sm font-semibold">
                {getMatchLabel(match, index)}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {match.isRevealed
                  ? getCompetitors(match)
                  : 'Teams hidden until reveal'}
              </span>
            </motion.button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentMatch.id ?? safeIndex}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <p className="font-medium">
                {getMatchLabel(currentMatch, safeIndex)} · Round{' '}
                {currentMatch.round + 1}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {getCompetitors(currentMatch)}
              </p>
              {!currentMatch.isRevealed && !canReveal && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  This match can be revealed after it has finished.
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => setCurrentIndex((index) => Math.max(index - 1, 0))}
            disabled={safeIndex === 0 || revealMutation.isPending}
          >
            <ChevronLeft />
            Back
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (currentMatch.id) {
                router.push(`/events/${eventId}/match/${currentMatch.id}`)
              }
            }}
            disabled={!currentMatch.id || revealMutation.isPending}
          >
            View match
            <ExternalLink />
          </Button>
          <Button
            onClick={goToNextMatch}
            isLoading={revealMutation.isPending}
            disabled={
              (!currentMatch.isRevealed && !canReveal) ||
              (currentMatch.isRevealed && isLastMatch)
            }
          >
            {nextLabel}
            {!isLastMatch && <ChevronRight />}
          </Button>
        </div>
      </div>
    </div>
  )
}
