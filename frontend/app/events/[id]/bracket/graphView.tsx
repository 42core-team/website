"use client";
import type { Node } from "reactflow";
import type { Match } from "@/app/actions/tournament-model";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import ReactFlow, { Background, useEdgesState, useNodesState } from "reactflow";
import { MatchState } from "@/app/actions/tournament-model";
import { MatchNode } from "@/components/match";
import { Switch } from "@/components/ui/switch";
import "reactflow/dist/style.css";

const MATCH_WIDTH = 200;
const MATCH_HEIGHT = 80;
const ROUND_SPACING = 280;
const VERTICAL_SPACING = 100;

const nodeTypes = {
  matchNode: MatchNode,
};

function createTreeCoordinate(matchCount: number): { x: number; y: number }[] {
  const coordinates: { x: number; y: number }[] = [];
  const totalRounds = Math.ceil(Math.log2(matchCount + 1));

  for (let round = 0; round < totalRounds; round++) {
    const matchesInRound = 2 ** (totalRounds - round - 1);
    const spacing = 2 ** round * VERTICAL_SPACING;

    for (let match = 0; match < matchesInRound; match++) {
      const x = round * ROUND_SPACING;
      const y = match * spacing + spacing / 2;

      coordinates.push({ x, y });
    }
  }

  return coordinates;
}

function getTotalRounds(teamCount: number) {
  if (teamCount <= 1) return 1;
  return Math.ceil(Math.log2(teamCount));
}

export default function GraphView({
  matches,
  teamCount,
  isEventAdmin,
  isAdminView,
}: {
  matches: Match[];
  teamCount: number;
  isEventAdmin: boolean;
  isAdminView: boolean;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, _setEdges, onEdgesChange] = useEdgesState([]);

  const router = useRouter();
  const eventId = useParams().id as string;

  useEffect(() => {
    if (!matches || matches.length === 0) {
      // Create placeholder nodes for visualization
      const newNodes = createTreeCoordinate(teamCount / 2).map(
        (coord, index): Node => {
          const placeholderMatch: Match = {
            id: ``,
            isRevealed: false,
            round: index + 1,
            state: "PLANNED" as any,
            phase: "ELIMINATION" as any,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            teams: [],
            results: [],
          };

          return {
            id: index.toString(),
            type: "matchNode",
            position: { x: coord.x, y: coord.y },
            data: {
              match: placeholderMatch,
              width: MATCH_WIDTH,
              height: MATCH_HEIGHT,
            },
          };
        },
      );
      setNodes(newNodes);
      return;
    }

    // Create nodes from actual match data
    const sortedMatches = [...matches].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const matchesByRound = new Map<number, Match[]>();
    for (const match of sortedMatches) {
      if (!matchesByRound.has(match.round)) {
        matchesByRound.set(match.round, []);
      }
      matchesByRound.get(match.round)!.push(match);
    }

    const totalRounds = getTotalRounds(teamCount);
    const lastRound = totalRounds - 1;
    const newNodes: Node[] = [];

    const roundKeys = Array.from(matchesByRound.keys()).sort((a, b) => a - b);
    for (const round of roundKeys) {
      const roundMatches = matchesByRound.get(round) || [];
      const placementMatch =
        round === lastRound
          ? roundMatches.find((match) => match.isPlacementMatch)
          : undefined;
      const bracketMatches =
        round === lastRound
          ? roundMatches.filter((match) => !match.isPlacementMatch)
          : roundMatches;
      const spacing = 2 ** round * VERTICAL_SPACING;

      bracketMatches.forEach((match, index) => {
        const coord = {
          x: round * ROUND_SPACING,
          y: index * spacing + spacing / 2,
        };

        newNodes.push({
          id: match.id ?? `match-${index}`,
          type: "matchNode",
          position: { x: coord.x, y: coord.y },
          data: {
            match,
            width: MATCH_WIDTH,
            height: MATCH_HEIGHT,
            onClick: (clickedMatch: Match) => {
              if (
                (match.state === MatchState.FINISHED || isEventAdmin) &&
                clickedMatch.id
              )
                router.push(`/events/${eventId}/match/${clickedMatch.id}`);
            },
          },
        });
      });

      if (placementMatch) {
        const placementCoord = {
          x: round * ROUND_SPACING,
          y: spacing / 2 + VERTICAL_SPACING * 2,
        };

        newNodes.push({
          id: placementMatch.id ?? `placement-${round}`,
          type: "matchNode",
          position: { x: placementCoord.x, y: placementCoord.y },
          data: {
            match: placementMatch,
            width: MATCH_WIDTH,
            height: MATCH_HEIGHT,
            onClick: (clickedMatch: Match) => {
              if (
                (placementMatch.state === MatchState.FINISHED ||
                  isEventAdmin) &&
                clickedMatch.id
              )
                router.push(`/events/${eventId}/match/${clickedMatch.id}`);
            },
          },
        });
      }
    }

    setNodes(newNodes);
  }, [matches, teamCount, isEventAdmin, router, eventId, setNodes]);

  return (
    <div className="w-full">
      <div style={{ width: "100%", height: "80vh" }}>
        <style jsx global>
          {`
            .react-flow__handle {
              display: none;
            }

            .react-flow__node {
              font-family:
                -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                "Helvetica Neue", Arial, sans-serif;
            }
          `}
        </style>
        {isEventAdmin && (
          <div className="flex items-center mb-2 mt-2 gap-4">
            Toggle admin view
            <Switch
              onCheckedChange={(value: boolean) => {
                const params = new URLSearchParams(window.location.search);
                params.set("adminReveal", value ? "true" : "false");
                router.replace(`?${params.toString()}`);
              }}
              defaultChecked={isAdminView}
            />
          </div>
        )}
        <ReactFlow
          nodesDraggable={false}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesConnectable={false}
          minZoom={0.0002}
          maxZoom={5.5}
        >
          <Background color="#f0f0f0" gap={16} />
        </ReactFlow>
      </div>
    </div>
  );
}
