"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { browserTournamentApi } from "@/lib/backend/browser";

export default function MatchActions(props: {
  matchId: string;
  isMatchRevealed: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(props.isMatchRevealed);

  return (
    <div className="flex">
      <Button
        onClick={() => {
          setLoading(true);
          browserTournamentApi.revealMatch(props.matchId)
            .then(() => setRevealed(true))
            .finally(() => {
              setLoading(false);
            });
        }}
        disabled={loading || revealed}
      >
        Reveal
      </Button>
    </div>
  );
}
