"use client";
import type { Node, Edge } from "reactflow";
import type { Match } from "@/app/actions/tournament-model";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import ReactFlow, { Background, useEdgesState, useNodesState } from "reactflow";
import { MatchState } from "@/app/actions/tournament-model";
import { MatchNode } from "@/components/match";
import "reactflow/dist/style.css";

const MATCH_WIDTH = 200;
const MATCH_HEIGHT = 80;
const ROUND_SPACING = 280;
const VERTICAL_SPACING = 100;

const nodeTypes = {
  matchNode: MatchNode,
};

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
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const router = useRouter();
  const eventId = useParams().id as string;

  useEffect(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const nodeIdsByRound: Map<number, string[]> = new Map();

    if (!matches || matches.length === 0) {
      // Create placeholder nodes for visualization
      const totalRounds = Math.ceil(Math.log2(teamCount));

      for (let round = 0; round < totalRounds; round++) {
        const matchesInRound = 2 ** (totalRounds - round - 1);
        const spacing = 2 ** round * VERTICAL_SPACING;
        const roundNodeIds: string[] = [];

        for (let match = 0; match < matchesInRound; match++) {
          const id = `placeholder-${round}-${match}`;
          const x = round * ROUND_SPACING;
          const y = match * spacing + spacing / 2;

          const placeholderMatch: Match = {
            id: ``,
            isRevealed: false,
            round: round + 1,
            state: "PLANNED" as any,
            phase: "ELIMINATION" as any,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            teams: [],
            results: [],
          };

          newNodes.push({
            id,
            type: "matchNode",
            position: { x, y },
            data: {
              match: placeholderMatch,
              width: MATCH_WIDTH,
              height: MATCH_HEIGHT,
              showTargetHandle: round > 0,
              showSourceHandle: round < totalRounds - 1,
            },
          });
          roundNodeIds.push(id);
        }
        nodeIdsByRound.set(round, roundNodeIds);
      }
    } else {
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
      const roundKeys = Array.from(matchesByRound.keys()).sort((a, b) => a - b);

      for (const round of roundKeys) {
        const roundMatches = matchesByRound.get(round) || [];
        const bracketMatches =
          round === lastRound
            ? roundMatches.filter((match) => !match.isPlacementMatch)
            : roundMatches;

        // Ensure bracket matches are sorted consistently for edge creation
        bracketMatches.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        const spacing = 2 ** round * VERTICAL_SPACING;
        const roundNodeIds: string[] = [];

        bracketMatches.forEach((match, index) => {
          const id = match.id ?? `match-${round}-${index}`;
          const coord = {
            x: round * ROUND_SPACING,
            y: index * spacing + spacing / 2,
          };

          newNodes.push({
            id,
            type: "matchNode",
            position: { x: coord.x, y: coord.y },
            data: {
              match,
              width: MATCH_WIDTH,
              height: MATCH_HEIGHT,
              showTargetHandle: round > 0,
              showSourceHandle: round < lastRound,
              onClick: (clickedMatch: Match) => {
                if (
                  (match.state === MatchState.FINISHED || isEventAdmin) &&
                  clickedMatch.id
                )
                  router.push(`/events/${eventId}/match/${clickedMatch.id}`);
              },
            },
          });
          roundNodeIds.push(id);
        });
        nodeIdsByRound.set(round, roundNodeIds);

        const placementMatch =
          round === lastRound
            ? roundMatches.find((match) => match.isPlacementMatch)
            : undefined;
        if (placementMatch) {
          const placementId = placementMatch.id ?? `placement-${round}`;
          const placementCoord = {
            x: round * ROUND_SPACING,
            y: spacing / 2 + VERTICAL_SPACING * 2,
          };

          newNodes.push({
            id: placementId,
            type: "matchNode",
            position: { x: placementCoord.x, y: placementCoord.y },
            data: {
              match: placementMatch,
              width: MATCH_WIDTH,
              height: MATCH_HEIGHT,
              showTargetHandle: false,
              showSourceHandle: false,
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
    }

    // Generate edges between rounds
    const rounds = Array.from(nodeIdsByRound.keys()).sort((a, b) => a - b);
    for (let i = 0; i < rounds.length - 1; i++) {
      const currentRound = rounds[i];
      const nextRound = rounds[i + 1];
      const currentNodes = nodeIdsByRound.get(currentRound) || [];
      const nextNodes = nodeIdsByRound.get(nextRound) || [];

      currentNodes.forEach((nodeId, index) => {
        const targetIndex = Math.floor(index / 2);
        if (nextNodes[targetIndex]) {
          newEdges.push({
            id: `edge-${currentRound}-${index}`,
            source: nodeId,
            target: nextNodes[targetIndex],
            type: "smoothstep",
            animated: false,
            style: {
              stroke: "#64748b", // Muted slate color
              strokeWidth: 2,
              opacity: 0.5,
            },
          });
        }
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [matches, teamCount, isEventAdmin, router, eventId, setNodes, setEdges]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodesDraggable={false}
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
