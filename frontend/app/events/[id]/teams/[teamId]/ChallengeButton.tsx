"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { challengeTeam } from "@/app/actions/team";
import { Button } from "@/components/ui/button";
import { Swords } from "lucide-react";
import { isActionError } from "@/app/actions/errors";

interface ChallengeButtonProps {
  eventId: string;
  targetTeamId: string;
  targetTeamName: string;
  disabled?: boolean;
}

export default function ChallengeButton({
  eventId,
  targetTeamId,
  targetTeamName,
  disabled = false,
}: Readonly<ChallengeButtonProps>) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleChallenge = async () => {
    setIsPending(true);
    setError(null);
    try {
      const result = await challengeTeam(eventId, targetTeamId);
      if (isActionError(result)) {
        setError(result.error);
      } else {
        router.push(`/events/${eventId}/queue`);
      }
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        onClick={handleChallenge}
        disabled={isPending || disabled}
        className="flex items-center gap-2"
      >
        <Swords className="size-4" />
        {isPending ? "Challenging..." : `Challenge ${targetTeamName}`}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
