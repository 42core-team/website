"use client";

import type { MatchLogs } from "@/app/actions/tournament-model";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MatchLogsDisplayProps {
  logs: MatchLogs;
}

// ANSI color code to CSS color mapping
const ansiColorMap: Record<string, string> = {
  30: "black",
  31: "red",
  32: "green",
  33: "yellow",
  34: "blue",
  35: "magenta",
  36: "cyan",
  37: "white",
  90: "gray",
  91: "lightred",
  92: "lightgreen",
  93: "lightyellow",
  94: "lightblue",
  95: "lightmagenta",
  96: "lightcyan",
  97: "white",
};

// Parse ANSI color codes in log text
function parseAnsiColorCodes(text: string) {
  // If no text or no color codes, return the text as is
  if (!text || !text.includes("[")) {
    return [{ text, color: undefined }];
  }

  const parts: { text: string; color?: string }[] = [];

  // Regular expression to match ANSI color codes - updated to handle the exact format
  // This matches codes like [32m exactly as they appear in your logs
  const colorCodeRegex = /\[(\d+)m/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let currentColor: string | undefined;

  // Find all color codes and their positions
  match = colorCodeRegex.exec(text);
  while (match !== null) {
    // Add text before this color code with previous color
    if (match.index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, match.index),
        color: currentColor,
      });
    }

    // Get the color code and update current color
    const colorCode = match[1];
    currentColor = ansiColorMap[colorCode];

    // Move past this color code
    lastIndex = match.index + match[0].length;

    match = colorCodeRegex.exec(text);
  }

  // Add remaining text with the last color
  if (lastIndex < text.length) {
    parts.push({
      text: text.substring(lastIndex),
      color: currentColor,
    });
  }

  // If no parts were created (no valid color codes), return original text
  if (parts.length === 0) {
    return [{ text, color: undefined }];
  }

  return parts;
}

export default function MatchLogsDisplay({ logs }: MatchLogsDisplayProps) {
  const [selectedTab, setSelectedTab] = useState<string>(
    logs.length > 0 ? logs[0].container : "",
  );
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Filter logs based on search query
  const getFilteredLogs = (logArray: string[]) => {
    if (!searchQuery.trim())
      return logArray;

    return logArray.filter(log =>
      log.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  };

  return (
    <div className="w-full space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Match Logs</h2>
        <div className="w-1/3">
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      <Tabs
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="w-full"
      >
        <TabsList>
          {logs.map(log => (
            <TabsTrigger key={log.container} value={log.container}>
              {log.team || log.container}
            </TabsTrigger>
          ))}
        </TabsList>
        {logs.map(log => (
          <TabsContent key={log.container} value={log.container}>
            <div
              className="overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 300px)" }}
            >
              <pre className="rounded-md p-4 whitespace-pre-wrap">
                {getFilteredLogs(log.logs).map((line, index) => (
                  <div key={index}>
                    {parseAnsiColorCodes(line).map((part, partIndex) => (
                      <span key={partIndex} style={{ color: part.color }}>
                        {part.text}
                      </span>
                    ))}
                  </div>
                ))}
              </pre>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
