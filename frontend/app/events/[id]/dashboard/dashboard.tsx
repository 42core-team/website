"use client";

import type { Event } from "@/app/actions/event";
import { useSession } from "next-auth/react";
import React, { useEffect, useState } from "react";
import { isActionError } from "@/app/actions/errors";
import {
  addEventAdmin,
  getEventAdmins,
  getEventById,
  getParticipantsCountForEvent,
  getStarterTemplates,
  getTeamsCountForEvent,
  isEventAdmin,
  removeEventAdmin,
  setEventTeamsLockDate,
  updateEventSettings,
} from "@/app/actions/event";

import { lockEvent, unlockEvent } from "@/app/actions/team";
import {
  revealAllMatches,
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
import {
  CalendarIcon,
  Loader2,
  Maximize2,
  Minimize2,
  Save,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { searchUsers, type UserSearchResult } from "@/app/actions/user";
import { Calendar } from "@/components/ui/calendar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StarterTemplatesManagement } from "./components/StarterTemplatesManagement";

interface DashboardPageProps {
  eventId: string;
}

export function DashboardPage({ eventId }: DashboardPageProps) {
  const session = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [teamAutoLockTime, setTeamAutoLockTime] = useState<string>("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGameConfigExpanded, setIsGameConfigExpanded] = useState(false);
  const [isServerConfigExpanded, setIsServerConfigExpanded] = useState(false);

  // Local state for event settings
  const [pendingSettings, setPendingSettings] = useState<Partial<Event>>({});

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

  useEffect(() => {
    if (event) {
      setPendingSettings(event);
    }
  }, [event]);

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

  const { data: admins = [], isLoading: isAdminsLoading } = useQuery({
    queryKey: ["event", eventId, "admins"],
    queryFn: async () => {
      const result = await getEventAdmins(eventId);
      if (isActionError(result)) throw new Error(result.error);
      return result;
    },
    enabled: isAdmin,
  });

  const { data: starterTemplates = [] } = useQuery({
    queryKey: ["event", eventId, "templates"],
    queryFn: async () => {
      const result = await getStarterTemplates(eventId);
      if (isActionError(result)) throw new Error(result.error);
      return result;
    },
    enabled: !!eventId,
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

  const revealMatchesMutation = useMutation({
    mutationFn: async (phase: string) => {
      const result = await revealAllMatches(eventId, phase);
      if (isActionError(result)) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: async () => {
      toast.success("Matches revealed.");
      await queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    },
    onError: (e: any) => {
      toast.error(e.message || "Failed to reveal matches.");
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
    mutationFn: async (settings: any) => {
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
    onError: (e: any) => {
      toast.error(e.message || "Failed to update event settings.");
    },
  });

  const addAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      const result = await addEventAdmin(eventId, userId);
      if (isActionError(result)) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success("Admin added.");
      queryClient.invalidateQueries({ queryKey: ["event", eventId, "admins"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      const result = await removeEventAdmin(eventId, userId);
      if (isActionError(result)) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success("Admin removed.");
      queryClient.invalidateQueries({ queryKey: ["event", eventId, "admins"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    if (event?.repoLockDate) {
      setTeamAutoLockTime(new Date(event.repoLockDate).toISOString());
      return;
    }
    setTeamAutoLockTime("");
  }, [event?.repoLockDate]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (userSearchQuery.length > 2) {
        setIsSearching(true);
        const result = await searchUsers(userSearchQuery);
        if (!isActionError(result)) {
          setSearchResults(result);
        }
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [userSearchQuery]);

  const handleSaveSettings = () => {
    const updates: any = {};

    const finalSettings = {
      ...pendingSettings,
    };

    const fields = [
      "name",
      "description",
      "location",
      "canCreateTeam",
      "processQueue",
      "isPrivate",
      "minTeamSize",
      "maxTeamSize",
      "gameServerDockerImage",
      "myCoreBotDockerImage",
      "visualizerDockerImage",
      "monorepoUrl",
      "monorepoVersion",
      "basePath",
      "gameConfig",
      "serverConfig",
      "githubOrg",
      "githubOrgSecret",
      "startDate",
      "endDate",
    ];

    fields.forEach((field) => {
      if ((finalSettings as any)[field] !== (event as any)[field]) {
        updates[field] = (finalSettings as any)[field];
      }
    });

    if (updates.startDate)
      updates.startDate = new Date(updates.startDate).getTime();
    if (updates.endDate) updates.endDate = new Date(updates.endDate).getTime();

    if (Object.keys(updates).length > 0) {
      updateEventSettingsMutation.mutate(updates);
      // Update local state to show formatted text
      setPendingSettings(finalSettings);
    } else {
      toast.info("No changes to save.");
    }
  };

  const isLoading =
    isEventLoading || isTeamsLoading || isParticipantsLoading || isAdminLoading;

  if (isLoading || !event) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        Loading dashboard...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        You are not authorized to access this dashboard.
      </div>
    );
  }

  const hasChanges = Object.keys(pendingSettings).some(
    (key) => (pendingSettings as any)[key] !== (event as any)[key],
  );

  return (
    <div className="container mx-auto flex flex-col gap-6 min-h-lvh py-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Event Dashboard: {event.name}</h1>
        {hasChanges && (
          <Button
            onClick={handleSaveSettings}
            className="fixed bottom-8 right-8 shadow-xl z-50 animate-in fade-in slide-in-from-bottom-4"
            disabled={updateEventSettingsMutation.isPending}
          >
            {updateEventSettingsMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        )}
      </div>

      <Tabs
        value={currentTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="operation">Operation</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="admins">Admins</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Event Overview</CardTitle>
              <CardDescription>
                Key live metrics for this event.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-lg border p-4 bg-muted/30">
                  <h3 className="text-xs font-medium mb-1 opacity-70 uppercase">
                    Participants
                  </h3>
                  <p className="text-2xl font-bold">{participantsCount}</p>
                </div>
                <div className="rounded-lg border p-4 bg-muted/30">
                  <h3 className="text-xs font-medium mb-1 opacity-70 uppercase">
                    Teams
                  </h3>
                  <p className="text-2xl font-bold">{teamsCount}</p>
                </div>
                <div className="rounded-lg border p-4 bg-muted/30">
                  <h3 className="text-xs font-medium mb-1 opacity-70 uppercase">
                    Current Round
                  </h3>
                  <p className="text-2xl font-bold">{event.currentRound}</p>
                </div>
                <div className="rounded-lg border p-4 bg-muted/30">
                  <h3 className="text-xs font-medium mb-1 opacity-70 uppercase">
                    Privacy
                  </h3>
                  <p className="text-2xl font-bold">
                    {event.isPrivate ? "Private" : "Public"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border">
                  <Label className="text-xs font-medium opacity-60 uppercase">
                    Start Date
                  </Label>
                  <p className="text-base font-semibold mt-1">
                    {format(new Date(event.startDate), "PPP p")}
                  </p>
                </div>
                <div className="p-4 rounded-lg border">
                  <Label className="text-xs font-medium opacity-60 uppercase">
                    End Date
                  </Label>
                  <p className="text-base font-semibold mt-1">
                    {format(new Date(event.endDate), "PPP p")}
                  </p>
                </div>
                <div className="p-4 rounded-lg border">
                  <Label className="text-xs font-medium opacity-60 uppercase">
                    Location
                  </Label>
                  <p className="text-base font-semibold mt-1">
                    {event.location || "Online"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuration Snapshot</CardTitle>
              <CardDescription>Current technical setup.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1 lg:col-span-2">
                  <Label className="text-xs opacity-70 uppercase">
                    Monorepo URL
                  </Label>
                  <p className="font-mono text-sm break-all bg-muted/50 p-2 rounded border">
                    {event.monorepoUrl || "Not set"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs opacity-70 uppercase">
                    Monorepo Version
                  </Label>
                  <p className="font-mono text-sm break-all bg-muted/50 p-2 rounded border">
                    {event.monorepoVersion}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs opacity-70 uppercase">
                  Base Path
                </Label>
                <p className="font-mono text-sm break-all bg-muted/50 p-2 rounded border">
                  {event.basePath}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs opacity-70 uppercase">
                    Game Server Image
                  </Label>
                  <p className="font-mono text-xs break-all bg-muted/50 p-2 rounded border">
                    {event.gameServerDockerImage}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs opacity-70 uppercase">
                    Bot Image (default)
                  </Label>
                  <p className="font-mono text-xs break-all bg-muted/50 p-2 rounded border">
                    {event.myCoreBotDockerImage}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs opacity-70 uppercase">
                    Visualizer Image
                  </Label>
                  <p className="font-mono text-xs break-all bg-muted/50 p-2 rounded border">
                    {event.visualizerDockerImage}
                  </p>
                </div>
              </div>

              {starterTemplates && starterTemplates.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-xs opacity-70 uppercase">
                    Starter Templates
                  </Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Path</TableHead>
                        <TableHead>Docker Image</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {starterTemplates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium">
                            {template.name}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {template.basePath}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground break-all">
                            {template.myCoreBotDockerImage}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Operation Controls</CardTitle>
              <CardDescription>
                Immediate actions for running the event.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-10">
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Repository Management
                </h3>
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={
                      event.lockedAt != null || lockEventMutation.isPending
                    }
                    onClick={() => lockEventMutation.mutate()}
                    variant="default"
                  >
                    Lock Team Repositories
                  </Button>
                  <Button
                    disabled={
                      event.lockedAt == null || unlockEventMutation.isPending
                    }
                    onClick={() => unlockEventMutation.mutate()}
                    variant="outline"
                  >
                    Unlock Team Repositories
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Group Phase
                </h3>
                <div className="flex flex-wrap gap-3">
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
                    disabled={revealMatchesMutation.isPending}
                    onClick={() => revealMatchesMutation.mutate("SWISS")}
                    variant="secondary"
                  >
                    Reveal Group Phase Matches
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Tournament Phase
                </h3>
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={startTournamentMatchesMutation.isPending}
                    onClick={() => startTournamentMatchesMutation.mutate()}
                    variant="secondary"
                  >
                    Start Tournament Phase
                  </Button>
                  <Button
                    disabled={revealMatchesMutation.isPending}
                    onClick={() => revealMatchesMutation.mutate("ELIMINATION")}
                    variant="secondary"
                  >
                    Reveal Tournament Matches
                  </Button>
                </div>
              </div>

              <div className="pt-8 border-t">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-4">
                  Scheduling Auto-Lock
                </h3>
                <div className="flex gap-4 items-end max-w-md">
                  <div className="flex-1 space-y-2">
                    <Label>Repo Lock Date & Time</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !teamAutoLockTime && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {teamAutoLockTime
                            ? format(new Date(teamAutoLockTime), "PPP p")
                            : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={
                            teamAutoLockTime
                              ? new Date(teamAutoLockTime)
                              : undefined
                          }
                          onSelect={(d) =>
                            d && setTeamAutoLockTime(d.toISOString())
                          }
                        />
                        <div className="p-3 border-t">
                          <Input
                            type="time"
                            value={
                              teamAutoLockTime
                                ? format(new Date(teamAutoLockTime), "HH:mm")
                                : ""
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              const parts = val.split(":");
                              if (parts.length !== 2) return;

                              const h = parseInt(parts[0], 10);
                              const m = parseInt(parts[1], 10);
                              if (isNaN(h) || isNaN(m)) return;

                              const current = teamAutoLockTime
                                ? new Date(teamAutoLockTime)
                                : new Date();
                              const d = isNaN(current.getTime())
                                ? new Date()
                                : current;
                              d.setHours(h, m, 0, 0);
                              setTeamAutoLockTime(d.toISOString());
                            }}
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Button
                    onClick={() =>
                      setTeamsLockDateMutation.mutate(
                        new Date(teamAutoLockTime).getTime(),
                      )
                    }
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setTeamsLockDateMutation.mutate(null)}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
              <CardDescription>Basic details about the event.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Event Name</Label>
                  <Input
                    value={pendingSettings.name || ""}
                    onChange={(e) =>
                      setPendingSettings({
                        ...pendingSettings,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    value={pendingSettings.location || ""}
                    onChange={(e) =>
                      setPendingSettings({
                        ...pendingSettings,
                        location: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Description (Markdown)</Label>
                  <Textarea
                    value={pendingSettings.description || ""}
                    onChange={(e) =>
                      setPendingSettings({
                        ...pendingSettings,
                        description: e.target.value,
                      })
                    }
                    className="min-h-[100px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="datetime-local"
                    value={
                      pendingSettings.startDate
                        ? format(
                            new Date(pendingSettings.startDate),
                            "yyyy-MM-dd'T'HH:mm",
                          )
                        : ""
                    }
                    onChange={(e) =>
                      setPendingSettings({
                        ...pendingSettings,
                        startDate: e.target.value as any,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="datetime-local"
                    value={
                      pendingSettings.endDate
                        ? format(
                            new Date(pendingSettings.endDate),
                            "yyyy-MM-dd'T'HH:mm",
                          )
                        : ""
                    }
                    onChange={(e) =>
                      setPendingSettings({
                        ...pendingSettings,
                        endDate: e.target.value as any,
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Participation & Privacy</CardTitle>
              <CardDescription>
                Manage who can join and strictness of the event.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Min Team Size</Label>
                  <Input
                    type="number"
                    value={pendingSettings.minTeamSize || 0}
                    onChange={(e) =>
                      setPendingSettings({
                        ...pendingSettings,
                        minTeamSize: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Team Size</Label>
                  <Input
                    type="number"
                    value={pendingSettings.maxTeamSize || 0}
                    onChange={(e) =>
                      setPendingSettings({
                        ...pendingSettings,
                        maxTeamSize: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-semibold">Toggles</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <Label className="cursor-pointer" htmlFor="canCreateTeam">
                      Allow Team Creation
                    </Label>
                    <Switch
                      id="canCreateTeam"
                      checked={pendingSettings.canCreateTeam || false}
                      onCheckedChange={(v) =>
                        setPendingSettings({
                          ...pendingSettings,
                          canCreateTeam: v,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <Label className="cursor-pointer" htmlFor="processQueue">
                      Process Queue
                    </Label>
                    <Switch
                      id="processQueue"
                      checked={pendingSettings.processQueue || false}
                      onCheckedChange={(v) =>
                        setPendingSettings({
                          ...pendingSettings,
                          processQueue: v,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <Label className="cursor-pointer" htmlFor="isPrivate">
                      Private Event
                    </Label>
                    <Switch
                      id="isPrivate"
                      checked={pendingSettings.isPrivate || false}
                      onCheckedChange={(v) =>
                        setPendingSettings({ ...pendingSettings, isPrivate: v })
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Technical Configuration</CardTitle>
              <CardDescription>
                Docker images and repository settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Monorepo URL</Label>
                  <Input
                    value={pendingSettings.monorepoUrl || ""}
                    onChange={(e) =>
                      setPendingSettings({
                        ...pendingSettings,
                        monorepoUrl: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monorepo Version</Label>
                    <Input
                      value={pendingSettings.monorepoVersion || ""}
                      onChange={(e) =>
                        setPendingSettings({
                          ...pendingSettings,
                          monorepoVersion: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Base Path</Label>
                    <Input
                      value={pendingSettings.basePath || ""}
                      onChange={(e) =>
                        setPendingSettings({
                          ...pendingSettings,
                          basePath: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Game Server Image</Label>
                  <Input
                    value={pendingSettings.gameServerDockerImage || ""}
                    onChange={(e) =>
                      setPendingSettings({
                        ...pendingSettings,
                        gameServerDockerImage: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bot Image (default)</Label>
                  <Input
                    value={pendingSettings.myCoreBotDockerImage || ""}
                    onChange={(e) =>
                      setPendingSettings({
                        ...pendingSettings,
                        myCoreBotDockerImage: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Visualizer Image</Label>
                  <Input
                    value={pendingSettings.visualizerDockerImage || ""}
                    onChange={(e) =>
                      setPendingSettings({
                        ...pendingSettings,
                        visualizerDockerImage: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <StarterTemplatesManagement eventId={eventId} />

          <Card>
            <CardHeader>
              <CardTitle>Advanced / Secrets</CardTitle>
              <CardDescription>
                Sensitive configuration and JSON configs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>GitHub Organization</Label>
                <Input
                  value={pendingSettings.githubOrg || ""}
                  onChange={(e) =>
                    setPendingSettings({
                      ...pendingSettings,
                      githubOrg: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>GitHub Organization Secret (Token)</Label>
                <Input
                  type="password"
                  placeholder="Enter new token to update (leave blank to keep current)"
                  onChange={(e) =>
                    setPendingSettings({
                      ...pendingSettings,
                      githubOrgSecret: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Game Config (JSON)</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setIsGameConfigExpanded(!isGameConfigExpanded)
                      }
                    >
                      {isGameConfigExpanded ? (
                        <Minimize2 className="h-4 w-4 mr-2" />
                      ) : (
                        <Maximize2 className="h-4 w-4 mr-2" />
                      )}
                      {isGameConfigExpanded ? "Minimize" : "Expand"}
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={pendingSettings.gameConfig || ""}
                  onChange={(e) =>
                    setPendingSettings({
                      ...pendingSettings,
                      gameConfig: e.target.value,
                    })
                  }
                  className={cn(
                    "font-mono text-xs transition-all duration-200",
                    isGameConfigExpanded ? "min-h-[1200px]" : "min-h-[200px]",
                  )}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Server Config (JSON)</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setIsServerConfigExpanded(!isServerConfigExpanded)
                      }
                    >
                      {isServerConfigExpanded ? (
                        <Minimize2 className="h-4 w-4 mr-2" />
                      ) : (
                        <Maximize2 className="h-4 w-4 mr-2" />
                      )}
                      {isServerConfigExpanded ? "Minimize" : "Expand"}
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={pendingSettings.serverConfig || ""}
                  onChange={(e) =>
                    setPendingSettings({
                      ...pendingSettings,
                      serverConfig: e.target.value,
                    })
                  }
                  className={cn(
                    "font-mono text-xs transition-all duration-200",
                    isServerConfigExpanded ? "min-h-[1200px]" : "min-h-[200px]",
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admins" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Event Administrators</CardTitle>
              <CardDescription>
                Manage who can control this event.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="relative">
                <div className="flex gap-4 items-end max-w-md">
                  <div className="flex-1 space-y-2">
                    <Label>Search User to add as Admin</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or username..."
                        className="pl-9"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full max-w-md mt-1 rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in zoom-in-95">
                    <div className="p-1">
                      {searchResults.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2 rounded-sm hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => {
                            addAdminMutation.mutate(user.id);
                            setUserSearchQuery("");
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={user.profilePicture}
                              alt={user.name}
                              className="h-8 w-8 rounded-full border bg-muted"
                            />
                            <div>
                              <p className="text-sm font-medium leading-none">
                                {user.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                @{user.username}
                              </p>
                            </div>
                          </div>
                          <UserPlus className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {isSearching && (
                  <div className="absolute z-10 w-full max-w-md mt-1 p-4 rounded-md border bg-popover text-center text-sm text-muted-foreground flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                    Searching...
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-semibold mb-4">
                  Current Administrators
                </h3>

                {isAdminsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead className="w-[100px] text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {admins.map((admin: any) => (
                        <TableRow key={admin.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <img
                                src={admin.profilePicture}
                                alt={admin.name}
                                className="h-10 w-10 rounded-full border bg-background"
                              />
                              <div>
                                <p className="font-semibold leading-none">
                                  {admin.name || "Unknown User"}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono mt-1">
                                  @{admin.username}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={
                                removeAdminMutation.isPending ||
                                admins.length <= 1
                              }
                              onClick={() =>
                                removeAdminMutation.mutate(admin.id)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
