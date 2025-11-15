"use client";

import { useState } from "react";
import { revealMatch } from "@/app/actions/tournament";
import { Button } from "@/components/ui/button";

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
          revealMatch(props.matchId).finally(() => {
            setLoading(false);
            setRevealed(true);
          });
        }}
        disabled={loading || revealed}
      >
        Reveal
      </Button>
    </div>
  );
}
