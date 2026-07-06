'use client'

import type { Match } from '@/app/actions/tournament-model'
import type { Node } from 'reactflow'
import { useEffect } from 'react'
import ReactFlow, { Background, useNodesState } from 'reactflow'
import { MatchState } from '@/app/actions/tournament-model'
import { MatchNode } from '@/components/match'
import { useParams, useRouter } from '@/lib/router-hooks'
import 'reactflow/dist/style.css'

function RoundNode({ data }: { data: { label: string } }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-xl border border-border/50 bg-card/90 px-4 text-sm font-bold tracking-tight text-foreground uppercase shadow-sm backdrop-blur-md">
      {data.label}
    </div>
  )
}

const nodeTypes = {
  matchNode: MatchNode,
  roundNode: RoundNode,
}

interface GroupPhaseGraphViewProps {
  matches: Match[]
  isEventAdmin: boolean
}

export function GroupPhaseGraphView({
  matches,
  isEventAdmin,
}: GroupPhaseGraphViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const router = useRouter()
  const params = useParams()
  const eventId = params.id ?? ''

  useEffect(() => {
    if (matches.length === 0) {
      setNodes([])
      return
    }

    const matchesByRound = matches.reduce<Record<number, Match[]>>(
      (acc, match) => {
        acc[match.round] = acc[match.round] ?? []
        acc[match.round].push(match)
        return acc
      },
      {},
    )

    const rounds = Object.keys(matchesByRound)
      .map(Number)
      .sort((a, b) => a - b)

    const newNodes: Node[] = []
    const columnWidth = 320
    const rowHeight = 130
    const padding = 20
    const matchWidth = 280
    const matchHeight = 100

    rounds.forEach((round, roundIndex) => {
      const roundMatches = matchesByRound[round]

      newNodes.push({
        id: `round-${round}`,
        type: 'roundNode',
        position: {
          x: roundIndex * columnWidth + padding,
          y: padding,
        },
        data: {
          label: `Round ${round}`,
        },
        style: {
          width: columnWidth - padding * 2,
          height: 60,
        },
        draggable: false,
        selectable: false,
      })

      roundMatches.forEach((match, matchIndex) => {
        const xPos =
          roundIndex * columnWidth +
          padding +
          (columnWidth - matchWidth - padding * 2) / 2
        const yPos = (matchIndex + 1) * rowHeight + padding + 20

        newNodes.push({
          id: match.id ?? `match-${round}-${matchIndex}`,
          type: 'matchNode',
          position: { x: xPos, y: yPos },
          data: {
            match,
            width: matchWidth,
            height: matchHeight,
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
      })
    })

    setNodes(newNodes)
  }, [matches, isEventAdmin, eventId, router, setNodes])

  if (matches.length === 0) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-muted-foreground">
        Matches will appear here once the group phase starts.
      </div>
    )
  }

  return (
    <ReactFlow
      nodes={nodes}
      onNodesChange={onNodesChange}
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
      minZoom={0.1}
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
