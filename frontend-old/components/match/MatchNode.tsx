"use client";

import type { Match } from "@/app/actions/tournament-model";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { memo } from "react";
import { Handle, Position } from "reactflow";
import { MatchState } from "@/app/actions/tournament-model";

interface MatchNodeData {
  match: Match;
  width?: number;
  height?: number;
  onClick?: (match: Match) => void;
  showTargetHandle?: boolean;
  showSourceHandle?: boolean;
  hideScore?: boolean;
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
    hideScore = false,
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
      className="relative cursor-pointer rounded-lg border-2 shadow-xs transition-all duration-200 hover:shadow-sm"
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
          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-orange-500"
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

      <div className="flex h-full flex-col justify-between p-3">
        {/* Match info */}
        <div className="flex-1">
          <div className="mb-1 text-xs font-semibold opacity-75">
            Match
            {" "}
            {match.id?.slice(0, 4) ?? "TBD"}
          </div>

          {/* Teams */}
          <div className="space-y-1">
            {match.teams
              && match.state === MatchState.FINISHED
              && match.teams.length > 0
              ? (
                  match.teams.map((team, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between text-sm font-medium ${
                        match.winner?.name === team.name ? "font-bold" : ""
                      }`}
                    >
                      <div className="flex-1 truncate">
                        <span
                          className="cursor-pointer transition-all duration-200 hover:underline"
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
                      {!hideScore
                        && match.state === MatchState.FINISHED
                        && team.score !== undefined && (
                        <span className="ml-2 text-xs">
                          {(match.results || []).find(
                            result => result?.team?.id === team.id,
                          )?.score ?? team.score}
                        </span>
                      )}
                    </div>
                  ))
                )
              : (
                  <div className="text-center text-sm font-medium opacity-60">
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
