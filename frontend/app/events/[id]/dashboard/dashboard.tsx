"use client";

import type { Event } from "@/app/actions/event";
import { useSession } from "next-auth/react";
import React, { useEffect, useState } from "react";
import { isActionError } from "@/app/actions/errors";
import {
  getEventById,
  getParticipantsCountForEvent,
  getTeamsCountForEvent,
  isEventAdmin,
  setEventTeamsLockDate,
  updateEventSettings,
} from "@/app/actions/event";

import { lockEvent, unlockEvent } from "@/app/actions/team";
import {
  startSwissMatches,
  startTournamentMatches,
} from "@/app/actions/tournament";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

interface DashboardPageProps {
  eventId: string;
}

export function DashboardPage({ eventId }: DashboardPageProps) {
  const session = useSession();
  const queryClient = useQueryClient();

  const [teamAutoLockTime, setTeamAutoLockTime] = useState<string>("");

  const { data: event, isLoading: isEventLoading } = useQuery<Event>({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const eventData = await getEventById(eventId);
      if (isActionError(eventData)) {
        throw new Error(eventData.error);
      }
      return eventData;
    },
  });

  const { data: teamsCount = 0, isLoading: isTeamsLoading } = useQuery<number>({
    queryKey: ["event", eventId, "teams-count"],
    queryFn: async () => await getTeamsCountForEvent(eventId),
  });

  const { data: participantsCount = 0, isLoading: isParticipantsLoading } =
    useQuery<number>({
      queryKey: ["event", eventId, "participants-count"],
      queryFn: async () => await getParticipantsCountForEvent(eventId),
    });

  const { data: isAdmin = false, isLoading: isAdminLoading } =
    useQuery<boolean>({
      queryKey: ["event", eventId, "is-admin"],
      queryFn: async () => {
        const adminCheck = await isEventAdmin(eventId);
        if (isActionError(adminCheck)) {
          return false;
        }
        return adminCheck;
      },
      enabled: session.status !== "loading",
    });

  const lockEventMutation = useMutation({
    mutationFn: async () => await lockEvent(eventId),
    onSuccess: async () => {
      toast.success("Team repositories locked.");
      await queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    },
    onError: () => {
      toast.error("Failed to lock team repositories.");
    },
  });

  const unlockEventMutation = useMutation({
    mutationFn: async () => await unlockEvent(eventId),
    onSuccess: async () => {
      toast.success("Team repositories unlocked.");
      await queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    },
    onError: () => {
      toast.error("Failed to unlock team repositories.");
    },
  });

  const startSwissMatchesMutation = useMutation({
    mutationFn: async () => await startSwissMatches(eventId),
    onSuccess: async () => {
      toast.success("Started group phase.");
      await queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    },
    onError: () => {
      toast.error("Failed to start group phase.");
    },
  });

  const startTournamentMatchesMutation = useMutation({
    mutationFn: async () => await startTournamentMatches(eventId),
    onSuccess: async () => {
      toast.success("Started tournament phase.");
      await queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    },
    onError: () => {
      toast.error("Failed to start tournament phase.");
    },
  });

  const setTeamsLockDateMutation = useMutation({
    mutationFn: async (lockDate: number | null) => {
      const result = await setEventTeamsLockDate(eventId, lockDate);
      if (isActionError(result)) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: async () => {
      toast.success("Team auto lock date updated.");
      await queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    },
    onError: () => {
      toast.error("Failed to update team auto lock date.");
    },
  });

  const updateEventSettingsMutation = useMutation({
    mutationFn: async (settings: {
      canCreateTeam?: boolean;
      processQueue?: boolean;
      isPrivate?: boolean;
      showConfigs?: boolean;
    }) => {
      const result = await updateEventSettings(eventId, settings);
      if (isActionError(result)) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: async () => {
      toast.success("Event settings updated.");
      await queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    },
    onError: () => {
      toast.error("Failed to update event settings.");
    },
  });

  useEffect(() => {
    if (event?.repoLockDate) {
      setTeamAutoLockTime(new Date(event.repoLockDate).toISOString());
      return;
    }
    setTeamAutoLockTime("");
  }, [event?.repoLockDate]);

  const isLoading =
    isEventLoading || isTeamsLoading || isParticipantsLoading || isAdminLoading;

  if (isLoading || !event) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="container mx-auto flex flex-col gap-6 min-h-lvh py-6">
      <h1 className="text-3xl font-bold">Event Dashboard</h1>

      {/* Admin Actions */}
      {isAdmin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Event Overview</CardTitle>
              <CardDescription>
                Key live metrics for this event.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-medium mb-2">Participants</h3>
                  <p className="text-2xl font-bold">{participantsCount}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-medium mb-2">Teams</h3>
                  <p className="text-2xl font-bold">{teamsCount}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-medium mb-2">Current Round</h3>
                  <p className="text-2xl font-bold">{event.currentRound}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Docker Configuration</CardTitle>
              <CardDescription>
                Images & repository info configured for this event.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {event.monorepoUrl && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <div className="rounded-lg border p-4">
                    <h3 className="text-sm font-medium mb-2">Monorepo URL</h3>
                    <a
                      href={event.monorepoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline break-all"
                    >
                      {event.monorepoUrl}
                    </a>
                  </div>
                  <div className="rounded-lg border p-4">
                    <h3 className="text-sm font-medium mb-2">
                      Monorepo Version
                    </h3>
                    <p className="font-mono break-all">
                      {event.monorepoVersion}
                    </p>
                  </div>
                </div>
              )}

              {event.gameServerDockerImage && (
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-medium mb-2">
                    Game Server Docker Image
                  </h3>
                  <p className="font-mono break-all">
                    {event.gameServerDockerImage}
                  </p>
                </div>
              )}

              {event.myCoreBotDockerImage && (
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-medium mb-2">
                    My Core Bot Docker Image
                  </h3>
                  <p className="font-mono break-all">
                    {event.myCoreBotDockerImage}
                  </p>
                </div>
              )}

              {event.visualizerDockerImage && (
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-medium mb-2">
                    Visualizer Docker Image
                  </h3>
                  <p className="font-mono break-all">
                    {event.visualizerDockerImage}
                  </p>
                </div>
              )}

              {!event.monorepoUrl &&
                !event.gameServerDockerImage &&
                !event.myCoreBotDockerImage && (
                  <p className="text-muted-foreground italic">
                    No Docker configuration set for this event.
                  </p>
                )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Admin Actions</CardTitle>
              <CardDescription>
                Operational controls for advancing the event.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={event.lockedAt != null || lockEventMutation.isPending}
                  onClick={() => lockEventMutation.mutate()}
                  variant="secondary"
                >
                  Lock Team Repositories
                </Button>
                <Button
                  disabled={
                    event.lockedAt == null || unlockEventMutation.isPending
                  }
                  onClick={() => unlockEventMutation.mutate()}
                  variant="secondary"
                >
                  Unlock Team Repositories
                </Button>

                <Button
                  disabled={
                    event.currentRound !== 0 ||
                    startSwissMatchesMutation.isPending
                  }
                  onClick={() => startSwissMatchesMutation.mutate()}
                  variant="secondary"
                >
                  Start Group Phase
                </Button>

                <Button
                  disabled={startTournamentMatchesMutation.isPending}
                  onClick={() => startTournamentMatchesMutation.mutate()}
                  variant="secondary"
                >
                  Start Tournament Phase
                </Button>
              </div>

              <h3 className="mt-4 text-sm font-medium">Team auto lock</h3>

              <div className="mt-2 flex gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !teamAutoLockTime && "text-muted-foreground",
                      )}
                    >
                      {teamAutoLockTime ? (
                        format(teamAutoLockTime, "PPP p")
                      ) : (
                        <span>Pick a date and time</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={new Date(teamAutoLockTime)}
                      onSelect={(value) => {
                        if (!value) return;

                        setTeamAutoLockTime(value.toISOString());
                      }}
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0))
                      }
                      autoFocus={true}
                    />
                    <div className="p-3 border-t">
                      <Input
                        type="time"
                        value={
                          teamAutoLockTime
                            ? format(teamAutoLockTime, "HH:mm")
                            : ""
                        }
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(":");
                          const newDate = teamAutoLockTime
                            ? new Date(teamAutoLockTime)
                            : new Date();
                          newDate.setHours(
                            Number.parseInt(hours),
                            Number.parseInt(minutes),
                          );
                          setTeamAutoLockTime(newDate.toISOString());
                        }}
                      />
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  disabled={setTeamsLockDateMutation.isPending}
                  onClick={() => {
                    setTeamsLockDateMutation.mutate(
                      new Date(teamAutoLockTime).getTime(),
                    );
                  }}
                >
                  Save
                </Button>
                <Button
                  variant="secondary"
                  disabled={setTeamsLockDateMutation.isPending}
                  onClick={() => {
                    setTeamsLockDateMutation.mutate(null, {
                      onSuccess: () => {
                        setTeamAutoLockTime("");
                      },
                    });
                  }}
                >
                  Reset
                </Button>
              </div>

              <h3 className="mt-6 text-sm font-medium">Event settings</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">Allow team creation</p>
                    <p className="text-xs text-muted-foreground">
                      Enables participants to create teams.
                    </p>
                  </div>
                  <Switch
                    checked={event.canCreateTeam}
                    disabled={updateEventSettingsMutation.isPending}
                    onCheckedChange={(value) =>
                      updateEventSettingsMutation.mutate({
                        canCreateTeam: value,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">Process queue</p>
                    <p className="text-xs text-muted-foreground">
                      Allows match queue processing.
                    </p>
                  </div>
                  <Switch
                    checked={event.processQueue}
                    disabled={updateEventSettingsMutation.isPending}
                    onCheckedChange={(value) =>
                      updateEventSettingsMutation.mutate({
                        processQueue: value,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">Private event</p>
                    <p className="text-xs text-muted-foreground">
                      Restricts access to invited users.
                    </p>
                  </div>
                  <Switch
                    checked={event.isPrivate}
                    disabled={updateEventSettingsMutation.isPending}
                    onCheckedChange={(value) =>
                      updateEventSettingsMutation.mutate({ isPrivate: value })
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">Show configurations</p>
                    <p className="text-xs text-muted-foreground">
                      Enable to show game and server configurations to all participants.
                    </p>
                  </div>
                  <Switch
                    checked={event.showConfigs}
                    disabled={updateEventSettingsMutation.isPending}
                    onCheckedChange={(value) =>
                      updateEventSettingsMutation.mutate({ showConfigs: value })
                    }
                  />
                </div>
              </div>

              <p className="text-sm text-muted-foreground mt-4">
                Note: Advancing the tournament will move to the next round or
                phase depending on the current state.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
