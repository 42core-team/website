"use client";
import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Info, Loader2, Terminal } from "lucide-react";
import { usePlausible } from "next-plausible";
import { useParams } from "next/navigation";
import { useState } from "react";
import axiosInstance from "@/app/actions/axios";
import { isActionError } from "@/app/actions/errors";

import { getStarterTemplates } from "@/app/actions/event";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { validateTeamName } from "@/lib/utils/validation";

export default function TeamCreationForm() {
  const plausible = usePlausible();

  const [newTeamName, setNewTeamName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const eventId = useParams().id as string;
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
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
    <Card className="mx-auto max-w-4xl overflow-hidden shadow-xl">
      <div className="flex flex-col md:flex-row">
        {/* Context Sidebar */}
        <div className="border-r border-border/50 bg-muted/30 p-8 md:w-5/12">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Prepare for Battle
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your team is your identity. Choose a name that reflects your
                skill.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="mt-1 h-fit rounded-full bg-primary/10 p-1.5">
                  <Terminal className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">
                    Immediate Git Access
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Instantly receive a repository with boilerplate code and a
                    ready-to-use devcontainer to start your development.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-1 h-fit rounded-full bg-primary/10 p-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">
                    Join the Competition
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Invite your team members, push your changes, and start
                    testing your bot's logic in the queue.
                  </p>
                </div>
              </div>
            </div>

            {templates.length > 0 && (
              <div className="border-t border-border/50 pt-4">
                <TooltipProvider delayDuration={0}>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 flex-shrink-0 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="center"
                        className="max-w-[250px] text-xs"
                      >
                        <p>
                          Templates are fixed once selected. However, you can
                          leave your team and create a new one to pick a
                          different foundation.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                    <span>Templates can't be changed later.</span>
                  </div>
                </TooltipProvider>
              </div>
            )}
          </div>
        </div>

        {/* Creation Form */}
        <div className="bg-background p-8 md:w-7/12">
          <div className="mx-auto max-w-sm space-y-8">
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Team Details</h2>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label
                  htmlFor="team-name"
                  className="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                >
                  Name
                </Label>
                <Input
                  id="team-name"
                  placeholder="e.g. MasseIstMacht"
                  className="h-10"
                  value={newTeamName}
                  onChange={(e) => handleTeamNameChange(e.target.value)}
                />
                {validationError && (
                  <p className="text-xs font-medium text-destructive">
                    {validationError}
                  </p>
                )}
              </div>

              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    Starter Template
                  </Label>
                  <Select
                    value={selectedTemplateId}
                    onValueChange={setSelectedTemplateId}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose your foundation" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {errorMessage && (
                <div className="rounded-md border border-destructive/10 bg-destructive/5 p-3 text-sm text-destructive">
                  {errorMessage}
                </div>
              )}

              <Button
                className="w-full shadow-lg shadow-primary/20"
                size="lg"
                onClick={handleCreateTeam}
                disabled={
                  !newTeamName ||
                  !!validationError ||
                  (templates.length > 0 && !selectedTemplateId) ||
                  isLoading ||
                  createTeamMutation.isPending
                }
              >
                {createTeamMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  "Create My Team"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
