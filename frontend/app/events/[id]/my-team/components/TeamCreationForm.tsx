"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlausible } from "next-plausible";
import { useParams } from "next/navigation";
import { useState } from "react";
import { TeamCreationSection } from "@/components/team";
import { validateTeamName } from "@/lib/utils/validation";
import axiosInstance from "@/app/actions/axios";

export default function TeamCreationForm() {
  const plausible = usePlausible();

  const [newTeamName, setNewTeamName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const eventId = useParams().id as string;
  const queryClient = useQueryClient();

  function handleTeamNameChange(name: string) {
    setNewTeamName(name);
    const validation = validateTeamName(name);
    setValidationError(validation.isValid ? null : validation.error!);
  }

  const createTeamMutation = useMutation({
    mutationFn: async () => {
      const validation = validateTeamName(newTeamName);
      if (!validation.isValid) {
        throw new Error(validation.error!);
      }

      await axiosInstance.post(`team/event/${eventId}/create`, {
        name: newTeamName,
      });
    },
    onMutate: () => {
      plausible("create_team");
      setErrorMessage(null);
      setValidationError(null);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["event", eventId, "my-team"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["event", eventId, "pending-invites"],
        }),
      ]);
    },
    onError: (error: Error) => {
      console.log(error);
      if (error.message && !error.message.startsWith("An unexpected")) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(
          "An unexpected error occurred while creating the team.",
        );
      }
    },
  });

  async function handleCreateTeam() {
    await createTeamMutation.mutateAsync();
  }

  return (
    <TeamCreationSection
      newTeamName={newTeamName}
      setNewTeamName={handleTeamNameChange}
      handleCreateTeam={handleCreateTeam}
      isLoading={createTeamMutation.isPending}
      errorMessage={errorMessage}
      validationError={validationError}
    />
  );
}
