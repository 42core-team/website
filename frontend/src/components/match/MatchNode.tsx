'use client'

import type { Match } from '@/app/actions/tournament-model'
import { motion, useReducedMotion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { useParams, useRouter } from '@/lib/router-hooks'
import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { MatchState } from '@/app/actions/tournament-model'
import { cn } from '@/lib/utils'

interface MatchNodeData {
  match: Match
  width?: number
  height?: number
  onClick?: (match: Match) => void
  showTargetHandle?: boolean
  showSourceHandle?: boolean
  hideScore?: boolean
  isHighlighted?: boolean
}

interface MatchNodeProps {
  data: MatchNodeData
}

function getMatchStateClass(state: MatchState) {
  switch (state) {
    case MatchState.FINISHED:
      return 'border-success-border bg-success-surface text-success'
    case MatchState.IN_PROGRESS:
      return 'border-info-border bg-info-surface text-info'
    default:
      return 'border-input bg-card text-muted-foreground'
  }
}

function getMatchStateIcon(state: MatchState) {
  switch (state) {
    case MatchState.FINISHED:
      return '✓'
    case MatchState.PLANNED:
      return '⏳'
    case MatchState.IN_PROGRESS:
      return null // We'll use the animated circle
    default:
      return '?'
  }
}

// Only a revealed result has a score; teams carry no standings.
function getResultScore(match: Match, teamId: string) {
  return match.results?.find((result) => result.team.id === teamId)?.score
}

function MatchNode({ data }: MatchNodeProps) {
  const {
    match,
    width = 200,
    height = 80,
    onClick,
    showTargetHandle = false,
    showSourceHandle = false,
    hideScore = false,
    isHighlighted = false,
  } = data
  const prefersReducedMotion = useReducedMotion()
  const icon = getMatchStateIcon(match.state)
  const router = useRouter()
  const params = useParams()
  const rawId = params?.id
  const eventId = rawId ?? ''

  const handleClick = () => {
    onClick?.(match)
  }

  const formatTeamName = (teamName: string, maxLength: number = 12) => {
    return teamName.length > maxLength
      ? `${teamName.substring(0, maxLength)}...`
      : teamName
  }

  return (
    <motion.div
      className={cn(
        'relative cursor-pointer rounded-lg border-2 shadow-xs transition-all duration-200 hover:shadow-sm',
        getMatchStateClass(match.state),
        isHighlighted &&
          'ring-4 ring-ring ring-offset-2 ring-offset-background',
      )}
      aria-current={isHighlighted ? 'step' : undefined}
      animate={
        isHighlighted && !prefersReducedMotion
          ? {
              scale: [1, 1.055, 1],
              boxShadow: [
                '0 0 0 0 transparent',
                '0 0 24px 4px color-mix(in oklab, var(--primary) 30%, transparent)',
                '0 0 0 0 transparent',
              ],
            }
          : { scale: 1, boxShadow: '0 0 0 0 transparent' }
      }
      transition={
        isHighlighted && !prefersReducedMotion
          ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.2 }
      }
      style={{
        width,
        height,
      }}
      onClick={handleClick}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
    >
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className="h-2 w-2 border-2 border-background !bg-muted-foreground"
          style={{ left: -4 }}
        />
      )}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className="h-2 w-2 border-2 border-background !bg-muted-foreground"
          style={{ right: -4 }}
        />
      )}

      {/* Animated progress indicator for IN_PROGRESS matches */}
      {match.state === MatchState.IN_PROGRESS && (
        <motion.div
          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-info"
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  scale: [1, 1.3, 1],
                  opacity: [0.8, 1, 0.8],
                }
          }
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* State icon */}
      {icon && (
        <div className="absolute top-2 right-2 text-sm font-bold">{icon}</div>
      )}

      <div className="flex h-full flex-col justify-between p-3">
        {/* Match info */}
        <div className="flex-1">
          <div className="mb-1 text-xs font-semibold opacity-75">
            Match {match.id?.slice(0, 4) ?? 'TBD'}
          </div>

          {/* Teams */}
          <div className="space-y-1">
            {match.teams &&
            match.state === MatchState.FINISHED &&
            match.teams.length > 0 ? (
              match.teams.map((team, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between text-sm font-medium ${
                    match.winner?.name === team.name ? 'font-bold' : ''
                  }`}
                >
                  <div className="flex-1 truncate">
                    <span
                      className="cursor-pointer transition-all duration-200 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (team.id) {
                          router.push(`/events/${eventId}/teams/${team.id}`)
                        }
                      }}
                    >
                      {formatTeamName(team.name)}
                    </span>
                    {team.id === match.winner?.id && (
                      <Trophy className="ml-1 inline size-3 text-amber-500" />
                    )}
                  </div>
                  {!hideScore &&
                    match.state === MatchState.FINISHED &&
                    getResultScore(match, team.id) !== undefined && (
                      <span className="ml-2 text-xs">
                        {getResultScore(match, team.id)}
                      </span>
                    )}
                </div>
              ))
            ) : (
              <div className="text-center text-sm font-medium opacity-60">
                TBD
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default memo(MatchNode)
