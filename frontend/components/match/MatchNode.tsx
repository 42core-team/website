"use client";

import type { Match } from "@/app/actions/tournament-model";
import { motion } from "framer-motion";
import { memo } from "react";
import { MatchState } from "@/app/actions/tournament-model";
import { useParams, useRouter } from "next/navigation";
import { Handle, Position } from "reactflow";

interface MatchNodeData {
  match: Match;
  width?: number;
  height?: number;
  onClick?: (match: Match) => void;
  showTargetHandle?: boolean;
  showSourceHandle?: boolean;
}

interface MatchNodeProps {
  data: MatchNodeData;
}

function getMatchStateStyles(state: MatchState) {
  switch (state) {
    case MatchState.FINISHED:
      return {
        backgroundColor: "#dcfce7",
        borderColor: "#16a34a",
        textColor: "#15803d",
      };
    case MatchState.PLANNED:
      return {
        backgroundColor: "#f8fafc",
        borderColor: "#64748b",
        textColor: "#475569",
      };
    case MatchState.IN_PROGRESS:
      return {
        backgroundColor: "#fff7ed",
        borderColor: "#ea580c",
        textColor: "#c2410c",
      };
    default:
      return {
        backgroundColor: "#f8fafc",
        borderColor: "#64748b",
        textColor: "#475569",
      };
  }
}

function getMatchStateIcon(state: MatchState) {
  switch (state) {
    case MatchState.FINISHED:
      return "✓";
    case MatchState.PLANNED:
      return "⏳";
    case MatchState.IN_PROGRESS:
      return null; // We'll use the animated circle
    default:
      return "?";
  }
}

function MatchNode({ data }: MatchNodeProps) {
  const {
    match,
    width = 200,
    height = 80,
    onClick,
    showTargetHandle = false,
    showSourceHandle = false,
  } = data;
  const styles = getMatchStateStyles(match.state);
  const icon = getMatchStateIcon(match.state);
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const rawId = params?.id;
  const eventId = rawId ?? "";

  const handleClick = () => {
    onClick?.(match);
  };

  const formatTeamName = (teamName: string, maxLength: number = 12) => {
    return teamName.length > maxLength
      ? `${teamName.substring(0, maxLength)}...`
      : teamName;
  };

  return (
    <motion.div
      className="relative rounded-lg border-2 shadow-xs cursor-pointer transition-all duration-200 hover:shadow-sm"
      style={{
        width,
        height,
        backgroundColor: styles.backgroundColor,
        borderColor: styles.borderColor,
        color: styles.textColor,
      }}
      onClick={handleClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-2 h-2 !bg-muted-foreground border-2 border-background"
          style={{ left: -4 }}
        />
      )}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-2 h-2 !bg-muted-foreground border-2 border-background"
          style={{ right: -4 }}
        />
      )}

      {/* Animated progress indicator for IN_PROGRESS matches */}
      {match.state === MatchState.IN_PROGRESS && (
        <motion.div
          className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* State icon */}
      {icon && (
        <div className="absolute top-2 right-2 text-sm font-bold">{icon}</div>
      )}

      <div className="p-3 h-full flex flex-col justify-between">
        {/* Match info */}
        <div className="flex-1">
          <div className="text-xs font-semibold mb-1 opacity-75">
            Match {match.id?.slice(0, 4) ?? "TBD"}
          </div>

          {/* Teams */}
          <div className="space-y-1">
            {match.teams &&
            match.state === MatchState.FINISHED &&
            match.teams.length > 0 ? (
              match.teams.map((team, index) => (
                <div
                  key={index}
                  className={`text-sm font-medium flex justify-between items-center ${
                    match.winner?.name === team.name ? "font-bold" : ""
                  }`}
                >
                  <div className="truncate flex-1">
                    <span
                      className="hover:underline transition-all duration-200 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (team.id) {
                          router.push(`/events/${eventId}/teams/${team.id}`);
                        }
                      }}
                    >
                      {formatTeamName(team.name)}
                    </span>
                    {team.id === match.winner?.id && (
                      <span className="ml-1 text-green-600">👑</span>
                    )}
                  </div>
                  {match.state === MatchState.FINISHED &&
                    team.score !== undefined && (
                      <span className="ml-2 text-xs">
                        {(match.results || []).find(
                          (result) => result?.team?.id === team.id,
                        )?.score ?? team.score}
                      </span>
                    )}
                </div>
              ))
            ) : (
              <div className="text-sm font-medium text-center opacity-60">
                TBD
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(MatchNode);
