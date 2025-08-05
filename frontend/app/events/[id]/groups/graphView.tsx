"use client";
import { useCallback, useEffect } from "react";
import ReactFlow, {
  Background,
  Node,
  NodeMouseHandler,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { MatchNode } from "@/components/match";
import { Match } from "@/app/actions/tournament-model";

// Custom node types for ReactFlow
const nodeTypes = {
  matchNode: MatchNode,
};

export default function GraphView({ matches }: { matches: Match[] }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);

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

        console.log("Creating node for match:", match.id, "at position:", {
          x: xPos,
          y: yPos,
        });

        newNodes.push({
          id: match.id,
          type: "matchNode",
          position: { x: xPos, y: yPos },
          data: {
            match,
            width: MATCH_WIDTH,
            height: MATCH_HEIGHT,
            onClick: (clickedMatch: Match) => {
              console.log("Match clicked:", clickedMatch);
              // Add any match interaction logic here
            },
          },
        });
      });
    });

    setNodes(newNodes);
  }, [matches]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      const match = matches.find((m) => m.id === node.id);
      if (match) {
        console.log("Match clicked:", match);
        // Add any additional match interaction logic here
      }
    },
    [matches],
  );

  return (
    <div className="w-full h-[80vh]">
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        onNodeClick={handleNodeClick}
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
