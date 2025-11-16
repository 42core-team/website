"use client";
import { usePlausible } from "next-plausible";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { isActionError } from "@/app/actions/errors";
import { createTeam } from "@/app/actions/team";
import { TeamCreationSection } from "@/components/team";
import { validateTeamName } from "@/lib/utils/validation";

export default function TeamCreationForm() {
  const plausible = usePlausible();

  const [newTeamName, setNewTeamName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const eventId = useParams().id as string;
  const router = useRouter();

  function handleTeamNameChange(name: string) {
    setNewTeamName(name);
    const validation = validateTeamName(name);
    setValidationError(validation.isValid ? null : validation.error!);
  }

  async function handleCreateTeam() {
    plausible("create_team");

    const validation = validateTeamName(newTeamName);
    if (!validation.isValid) {
      setValidationError(validation.error!);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      setValidationError(null);
      const result = await createTeam(newTeamName, eventId);

      if (isActionError(result)) {
        setErrorMessage(result.error);
        return;
      }

      // Use Next.js router to refresh the page
      router.refresh();
    }
    catch (err) {
      console.error("Error creating team:", err);
      setErrorMessage("An unexpected error occurred while creating the team.");
    }
    finally {
      setIsLoading(false);
    }
  }

  return (
    <TeamCreationSection
      newTeamName={newTeamName}
      setNewTeamName={handleTeamNameChange}
      handleCreateTeam={handleCreateTeam}
      isLoading={isLoading}
      errorMessage={errorMessage}
      validationError={validationError}
    />
  );
}
