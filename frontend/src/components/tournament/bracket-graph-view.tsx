'use client'

import type { Match } from '@/app/actions/tournament-model'
import type { Edge, Node } from 'reactflow'
import { useEffect } from 'react'
import ReactFlow, { Background, useEdgesState, useNodesState } from 'reactflow'
import { MatchPhase, MatchState } from '@/app/actions/tournament-model'
import { MatchNode } from '@/components/match'
import { useParams, useRouter } from '@/lib/router-hooks'
import 'reactflow/dist/style.css'

const matchWidth = 200
const matchHeight = 80
const roundSpacing = 280
const verticalSpacing = 100

const nodeTypes = {
  matchNode: MatchNode,
}

function getTotalRounds(teamCount: number) {
  if (teamCount <= 1) return 1
  return Math.ceil(Math.log2(teamCount))
}

function createPlaceholderMatch(round: number): Match {
  return {
    id: '',
    isRevealed: false,
    round,
    state: MatchState.PLANNED,
    phase: MatchPhase.ELIMINATION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teams: [],
    results: [],
  }
}

interface BracketGraphViewProps {
  matches: Match[]
  teamCount: number
  isEventAdmin: boolean
  highlightedMatchId?: string
}

export function BracketGraphView({
  matches,
  teamCount,
  isEventAdmin,
  highlightedMatchId,
}: BracketGraphViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const router = useRouter()
  const params = useParams()
  const eventId = params.id ?? ''

  useEffect(() => {
    const newNodes: Node[] = []
    const newEdges: Edge[] = []
    const nodeIdsByRound = new Map<number, string[]>()

    if (matches.length === 0) {
      const totalRounds = getTotalRounds(teamCount)

      for (let round = 0; round < totalRounds; round += 1) {
        const matchesInRound = 2 ** (totalRounds - round - 1)
        const spacing = 2 ** round * verticalSpacing
        const roundNodeIds: string[] = []

        for (let match = 0; match < matchesInRound; match += 1) {
          const id = `placeholder-${round}-${match}`
          const x = round * roundSpacing
          const y = match * spacing + spacing / 2

          newNodes.push({
            id,
            type: 'matchNode',
            position: { x, y },
            data: {
              match: createPlaceholderMatch(round),
              width: matchWidth,
              height: matchHeight,
              showTargetHandle: round > 0,
              showSourceHandle: round < totalRounds - 1,
            },
          })
          roundNodeIds.push(id)
        }
        nodeIdsByRound.set(round, roundNodeIds)
      }
    } else {
      const sortedMatches = [...matches].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      const matchesByRound = new Map<number, Match[]>()
      for (const match of sortedMatches) {
        matchesByRound.set(match.round, matchesByRound.get(match.round) ?? [])
        matchesByRound.get(match.round)?.push(match)
      }

      const totalRounds = getTotalRounds(teamCount)
      const lastRoundIndex = totalRounds - 1
      const roundKeys = Array.from(matchesByRound.keys()).sort((a, b) => a - b)

      for (const round of roundKeys) {
        const roundIndex = round
        const roundMatches = matchesByRound.get(round) ?? []
        const isLastRound = roundIndex === lastRoundIndex
        const bracketMatches = isLastRound
          ? roundMatches.filter((match) => !match.isPlacementMatch)
          : [...roundMatches]

        bracketMatches.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )

        const spacing = 2 ** roundIndex * verticalSpacing
        const roundNodeIds: string[] = []

        bracketMatches.forEach((match, index) => {
          const id = match.id ?? `match-${roundIndex}-${index}`
          const x = roundIndex * roundSpacing
          const y = index * spacing + spacing / 2

          newNodes.push({
            id,
            type: 'matchNode',
            position: { x, y },
            data: {
              match,
              width: matchWidth,
              height: matchHeight,
              showTargetHandle: roundIndex > 0,
              showSourceHandle: roundIndex < lastRoundIndex,
              hideScore: true,
              isHighlighted: match.id === highlightedMatchId,
              onClick: (clickedMatch: Match) => {
                if (
                  (match.state === MatchState.FINISHED || isEventAdmin) &&
                  clickedMatch.id
                ) {
                  router.push(`/events/${eventId}/match/${clickedMatch.id}`)
                }
              },
            },
          })
          roundNodeIds.push(id)
        })
        nodeIdsByRound.set(roundIndex, roundNodeIds)

        const placementMatch = isLastRound
          ? roundMatches.find((match) => match.isPlacementMatch)
          : undefined
        if (placementMatch) {
          const placementId = placementMatch.id ?? `placement-${roundIndex}`
          newNodes.push({
            id: placementId,
            type: 'matchNode',
            position: {
              x: roundIndex * roundSpacing,
              y: spacing / 2 + verticalSpacing * 1.5,
            },
            data: {
              match: placementMatch,
              width: matchWidth,
              height: matchHeight,
              showTargetHandle: false,
              showSourceHandle: false,
              hideScore: true,
              isHighlighted: placementMatch.id === highlightedMatchId,
              onClick: (clickedMatch: Match) => {
                if (
                  (placementMatch.state === MatchState.FINISHED ||
                    isEventAdmin) &&
                  clickedMatch.id
                ) {
                  router.push(`/events/${eventId}/match/${clickedMatch.id}`)
                }
              },
            },
          })
        }
      }
    }

    const rounds = Array.from(nodeIdsByRound.keys()).sort((a, b) => a - b)
    for (let i = 0; i < rounds.length - 1; i += 1) {
      const currentRound = rounds[i]
      const nextRound = rounds[i + 1]
      const currentNodes = nodeIdsByRound.get(currentRound) ?? []
      const nextNodes = nodeIdsByRound.get(nextRound) ?? []

      currentNodes.forEach((nodeId, index) => {
        const targetIndex = Math.floor(index / 2)
        if (nextNodes[targetIndex]) {
          newEdges.push({
            id: `edge-${currentRound}-${index}`,
            source: nodeId,
            target: nextNodes[targetIndex],
            type: 'smoothstep',
            animated: false,
            style: {
              stroke: '#64748b',
              strokeWidth: 2,
              opacity: 0.5,
            },
          })
        }
      })
    }

    setNodes(newNodes)
    setEdges(newEdges)
  }, [
    matches,
    teamCount,
    isEventAdmin,
    highlightedMatchId,
    router,
    eventId,
    setNodes,
    setEdges,
  ])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{
        padding: 0.15,
        minZoom: 0.2,
        maxZoom: 1,
      }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={true}
      minZoom={0.05}
      maxZoom={1.5}
      zoomOnScroll={true}
      panOnScroll={false}
      zoomOnPinch={true}
      panOnDrag={true}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="currentColor" className="opacity-10" gap={20} />
    </ReactFlow>
  )
}
