"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { browserTournamentApi } from "@/lib/backend/browser";
import { getBackendErrorMessage } from "@/lib/backend/http/errors";

export default function MatchActions(props: {
  matchId: string;
  isMatchRevealed: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(props.isMatchRevealed);

  return (
    <div className="flex">
      <Button
        onClick={async () => {
          setLoading(true);
          try {
            await browserTournamentApi.revealMatch(props.matchId);
            setRevealed(true);
          }
          catch (error) {
            toast.error(getBackendErrorMessage(error, "Failed to reveal match."));
          }
          finally {
            setLoading(false);
          }
        }}
        disabled={loading || revealed}
      >
        Reveal
      </Button>
    </div>
  );
}
