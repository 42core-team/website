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
const nodeTypes = {
  matchNode: MatchNode,
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

    const COLUMN_WIDTH = 300;
    const ROW_HEIGHT = 130;
    const PADDING = 20;
    const MATCH_WIDTH = 250;
    const MATCH_HEIGHT = 80;

    rounds.forEach((round, roundIndex) => {
      const roundMatches = matchesByRound[round];

      // Add round header
      newNodes.push({
        id: `round-${round}`,
        position: {
          x: roundIndex * COLUMN_WIDTH + PADDING,
          y: PADDING,
        },
        data: {
          label: `Round ${round}`,
        },
        style: {
          width: COLUMN_WIDTH - PADDING * 2,
          height: 40,
          textAlign: "center",
          fontWeight: "bold",
          padding: "10px",
          backgroundColor: "#f1f5f9",
          border: "2px solid #cbd5e1",
          borderRadius: "8px",
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
        const yPos = (matchIndex + 1) * ROW_HEIGHT + PADDING + 20; // +60 for header space

        newNodes.push({
          id: match.id,
          type: "matchNode",
          position: { x: xPos, y: yPos },
          data: {
            match,
            width: MATCH_WIDTH,
            height: MATCH_HEIGHT,
            onClick: (clickedMatch: Match) => {
              if (match.state === MatchState.FINISHED || eventAdmin)
                router.push(`/events/${eventId}/match/${clickedMatch.id}`);
            },
          },
        });
      });
    });

    setNodes(newNodes);
  }, [matches]);

  return (
    <div className="w-full h-[80vh]">
      {eventAdmin && (
        <div className="flex items-center mb-2 mt-2 gap-4">
          Toggle admin view
          <Switch
            onCheckedChange={(value) => {
              const params = new URLSearchParams(window.location.search);
              params.set("adminReveal", value ? "true" : "false");
              router.replace(`?${params.toString()}`);
            }}
            defaultChecked={isAdminView}
          />
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#f0f0f0" gap={16} />
      </ReactFlow>
    </div>
  );
}
