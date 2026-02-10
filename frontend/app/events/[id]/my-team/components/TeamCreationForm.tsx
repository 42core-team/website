"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlausible } from "next-plausible";
import { useParams } from "next/navigation";
import { useState } from "react";
import { TeamCreationSection } from "@/components/team";
import { validateTeamName } from "@/lib/utils/validation";
import axiosInstance from "@/app/actions/axios";
import { AxiosError } from "axios";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  getStarterTemplates,
  type EventStarterTemplate,
} from "@/app/actions/event";
import { useQuery } from "@tanstack/react-query";
import { isActionError } from "@/app/actions/errors";

export default function TeamCreationForm() {
  const plausible = usePlausible();

  const [newTeamName, setNewTeamName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const eventId = useParams().id as string;
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ["event", eventId, "templates"],
    queryFn: async () => {
      const result = await getStarterTemplates(eventId);
      if (isActionError(result)) throw new Error(result.error);
      return result;
    },
  });

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

      // If templates exist, require selection
      if (templates.length > 0 && !selectedTemplateId) {
        throw new Error("Please select a starter template.");
      }

      await axiosInstance.post(`team/event/${eventId}/create`, {
        name: newTeamName,
        starterTemplateId: selectedTemplateId || undefined,
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
    onError: (error: AxiosError) => {
      if (error.response?.status === 400) {
        // Handle specific 400 errors if needed, or generic message
        if (
          typeof error.response.data === "object" &&
          (error.response.data as any).message
        ) {
          setErrorMessage((error.response.data as any).message);
          return;
        }
        setErrorMessage(
          "A team with this name already exists. Please choose a different name.",
        );
        return;
      }

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
    <div className="space-y-6">
      <TeamCreationSection
        newTeamName={newTeamName}
        setNewTeamName={handleTeamNameChange}
        handleCreateTeam={handleCreateTeam}
        isLoading={createTeamMutation.isPending}
        errorMessage={errorMessage}
        validationError={validationError}
      />
      {templates.length > 0 && (
        <div className="space-y-2">
          <Label>Starter Template</Label>
          <Select
            value={selectedTemplateId}
            onValueChange={setSelectedTemplateId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            This will determine your team's base code and bot environment.
          </p>
        </div>
      )}
    </div>
  );
}
