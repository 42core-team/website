"use client";
import type { Node } from "reactflow";
import type { Match } from "@/app/actions/tournament-model";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import ReactFlow, { Background, useNodesState } from "reactflow";
import { MatchState } from "@/app/actions/tournament-model";
import { MatchNode } from "@/components/match";
import { Switch } from "@/components/ui/switch";
import "reactflow/dist/style.css";

// Custom node types for ReactFlow
const RoundNode = ({ data }: { data: { label: string } }) => (
  <div className="flex items-center justify-center h-full w-full bg-card/90 backdrop-blur-md border border-border/50 rounded-xl shadow-sm text-foreground font-bold text-sm tracking-tight px-4 uppercase">
    {data.label}
  </div>
);

const nodeTypes = {
  matchNode: MatchNode,
  roundNode: RoundNode,
};

export default function GraphView({
  matches,
  eventAdmin,
  isAdminView,
}: {
  matches: Match[];
  eventAdmin: boolean;
  isAdminView: boolean;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);

  const router = useRouter();
  const eventId = useParams().id as string;

  useEffect(() => {
    if (!matches || matches.length === 0) return;

    const matchesByRound = matches.reduce(
      (acc, match) => {
        if (!acc[match.round]) acc[match.round] = [];
        acc[match.round].push(match);
        return acc;
      },
      {} as Record<number, Match[]>,
    );

    const rounds = Object.keys(matchesByRound)
      .map(Number)
      .sort((a, b) => a - b);

    const newNodes: Node[] = [];

    const COLUMN_WIDTH = 320;
    const ROW_HEIGHT = 130;
    const PADDING = 20;
    const MATCH_WIDTH = 280;
    const MATCH_HEIGHT = 100;

    rounds.forEach((round, roundIndex) => {
      const roundMatches = matchesByRound[round];

      // Add round header
      newNodes.push({
        id: `round-${round}`,
        type: "roundNode",
        position: {
          x: roundIndex * COLUMN_WIDTH + PADDING,
          y: PADDING,
        },
        data: {
          label: `Round ${round}`,
        },
        style: {
          width: COLUMN_WIDTH - PADDING * 2,
          height: 60,
        },
        draggable: false,
        selectable: false,
      });

      // Add match nodes
      roundMatches.forEach((match, matchIndex) => {
        const xPos =
          roundIndex * COLUMN_WIDTH +
          PADDING +
          (COLUMN_WIDTH - MATCH_WIDTH - PADDING * 2) / 2;
        const yPos = (matchIndex + 1) * ROW_HEIGHT + PADDING + 20;

        newNodes.push({
          id: match.id ?? `match-${round}-${matchIndex}`,
          type: "matchNode",
          position: { x: xPos, y: yPos },
          data: {
            match,
            width: MATCH_WIDTH,
            height: MATCH_HEIGHT,
            onClick: (clickedMatch: Match) => {
              if (
                (match.state === MatchState.FINISHED || eventAdmin) &&
                clickedMatch.id
              )
                router.push(`/events/${eventId}/match/${clickedMatch.id}`);
            },
          },
        });
      });
    });

    setNodes(newNodes);
  }, [matches, eventAdmin, eventId, router]);

  return (
    <div className="w-full h-full">
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
        <Background
          color="currentColor"
          className="opacity-10"
          gap={20}
          variant={undefined}
        />
      </ReactFlow>
    </div>
  );
}
