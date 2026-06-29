import type { Event } from "@/app/actions/event";
import type { UserSearchResult } from "@/app/actions/user";
import type { UseMutationResult } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
  cleanupAllMatches,
  revealAllMatches,
  startSwissMatches,
  startTournamentMatches,
} from "@/app/actions/tournament";
import { searchUsers } from "@/app/actions/user";
import { StarterTemplatesManagement } from "@/components/dashboard/starter-templates-management";
import { WhitelistManagement } from "@/components/dashboard/whitelist-management";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useTabParam } from "@/hooks/useTabParam";
import { useSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/events/$id/dashboard")({
  component: DashboardRoute,
});

type PendingEventSettings = Partial<
  Omit<Event, "startDate" | "endDate"> & {
    startDate: string | number;
    endDate: string | number;
  }
>;
type EventSettingsUpdate = Parameters<typeof updateEventSettings>[1];
type VoidMutation = UseMutationResult<unknown, Error, void, unknown>;
type PhaseMutation = UseMutationResult<unknown, Error, string, unknown>;
type StringMutation = UseMutationResult<unknown, Error, string, unknown>;
type TeamLockDateMutation = UseMutationResult<
  unknown,
  Error,
  number | null,
  unknown
>;

interface EventAdmin {
  id: string;
  username: string;
  name: string;
  profilePicture?: string;
}

const SETTINGS_FIELDS = [
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
] as const;

function DashboardRoute() {
  const { id } = Route.useParams();
  const session = useSession();
  const queryClient = useQueryClient();
  const { currentTab, onTabChange } = useTabParam("overview");

  const [teamAutoLockTime, setTeamAutoLockTime] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGameConfigExpanded, setIsGameConfigExpanded] = useState(false);
  const [isServerConfigExpanded, setIsServerConfigExpanded] = useState(false);
  const [pendingSettings, setPendingSettings] = useState<PendingEventSettings>(
    {},
  );

  const eventQuery = useQuery<Event>({
    queryKey: ["event", id],
    queryFn: () => getEventById(id),
  });

  useEffect(() => {
    if (eventQuery.data) {
      setPendingSettings(eventQuery.data);
    }
  }, [eventQuery.data]);

  const teamsCountQuery = useQuery({
    queryKey: ["event", id, "teams-count"],
    queryFn: () => getTeamsCountForEvent(id),
  });

  const participantsCountQuery = useQuery({
    queryKey: ["event", id, "participants-count"],
    queryFn: () => getParticipantsCountForEvent(id),
  });

  const isAdminQuery = useQuery({
    queryKey: ["event", id, "is-admin"],
    queryFn: isEventAdmin.bind(null, id),
    enabled: session.status !== "loading",
    retry: false,
  });

  const adminsQuery = useQuery<EventAdmin[]>({
    queryKey: ["event", id, "admins"],
    queryFn: () => getEventAdmins(id),
    enabled: isAdminQuery.data === true,
  });

  const starterTemplatesQuery = useQuery({
    queryKey: ["event", id, "templates"],
    queryFn: () => getStarterTemplates(id),
  });

  const lockEventMutation = useMutation({
    mutationFn: () => lockEvent(id),
    onSuccess: async () => {
      toast.success("Team repositories locked.");
      await queryClient.invalidateQueries({ queryKey: ["event", id] });
    },
    onError: () => toast.error("Failed to lock team repositories."),
  });

  const unlockEventMutation = useMutation({
    mutationFn: () => unlockEvent(id),
    onSuccess: async () => {
      toast.success("Team repositories unlocked.");
      await queryClient.invalidateQueries({ queryKey: ["event", id] });
    },
    onError: () => toast.error("Failed to unlock team repositories."),
  });

  const startSwissMatchesMutation = useMutation({
    mutationFn: () => startSwissMatches(id),
    onSuccess: async () => {
      toast.success("Started group phase.");
      await queryClient.invalidateQueries({ queryKey: ["event", id] });
    },
    onError: () => toast.error("Failed to start group phase."),
  });

  const startTournamentMatchesMutation = useMutation({
    mutationFn: () => startTournamentMatches(id),
    onSuccess: async () => {
      toast.success("Started tournament phase.");
      await queryClient.invalidateQueries({ queryKey: ["event", id] });
    },
    onError: () => toast.error("Failed to start tournament phase."),
  });

  const revealMatchesMutation = useMutation({
    mutationFn: (phase: string) => revealAllMatches(id, phase),
    onSuccess: async () => {
      toast.success("Matches revealed.");
      await queryClient.invalidateQueries({ queryKey: ["event", id] });
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to reveal matches.")),
  });

  const cleanupMatchesMutation = useMutation({
    mutationFn: (phase: string) => cleanupAllMatches(id, phase),
    onSuccess: async () => {
      toast.success("Matches cleaned up.");
      await queryClient.invalidateQueries({ queryKey: ["event", id] });
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to cleanup matches.")),
  });

  const setTeamsLockDateMutation = useMutation({
    mutationFn: (lockDate: number | null) => setEventTeamsLockDate(id, lockDate),
    onSuccess: async () => {
      toast.success("Team auto lock date updated.");
      await queryClient.invalidateQueries({ queryKey: ["event", id] });
    },
    onError: () => toast.error("Failed to update team auto lock date."),
  });

  const updateEventSettingsMutation = useMutation({
    mutationFn: (settings: EventSettingsUpdate) =>
      updateEventSettings(id, settings),
    onSuccess: async () => {
      toast.success("Event settings updated.");
      await queryClient.invalidateQueries({ queryKey: ["event", id] });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Failed to update event settings.")),
  });

  const addAdminMutation = useMutation({
    mutationFn: (userId: string) => addEventAdmin(id, userId),
    onSuccess: async () => {
      toast.success("Admin added.");
      await queryClient.invalidateQueries({
        queryKey: ["event", id, "admins"],
      });
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to add admin.")),
  });

  const removeAdminMutation = useMutation({
    mutationFn: (userId: string) => removeEventAdmin(id, userId),
    onSuccess: async () => {
      toast.success("Admin removed.");
      await queryClient.invalidateQueries({
        queryKey: ["event", id, "admins"],
      });
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to remove admin.")),
  });

  useEffect(() => {
    if (eventQuery.data?.repoLockDate) {
      setTeamAutoLockTime(new Date(eventQuery.data.repoLockDate).toISOString());
      return;
    }
    setTeamAutoLockTime("");
  }, [eventQuery.data?.repoLockDate]);

  useEffect(() => {
    const delayDebounceFn = window.setTimeout(async () => {
      if (userSearchQuery.length <= 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        setSearchResults(await searchUsers(userSearchQuery));
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to search users."));
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(delayDebounceFn);
  }, [userSearchQuery]);

  const event = eventQuery.data;
  const isLoading =
    eventQuery.isPending ||
    teamsCountQuery.isPending ||
    participantsCountQuery.isPending ||
    isAdminQuery.isPending;

  if (isLoading || !event) {
    return (
      <main className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </main>
    );
  }

  if (eventQuery.isError) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <p className="text-center text-destructive">
          Failed to load dashboard.
        </p>
      </main>
    );
  }

  if (!isAdminQuery.data) {
    return (
      <main className="flex min-h-[45vh] items-center justify-center px-4 text-center text-muted-foreground">
        You are not authorized to access this dashboard.
      </main>
    );
  }

  const hasChanges = Object.keys(pendingSettings).some(
    (key) =>
      pendingSettings[key as keyof PendingEventSettings] !==
      event[key as keyof Event],
  );

  const handleSaveSettings = () => {
    const updates: EventSettingsUpdate = {};

    SETTINGS_FIELDS.forEach((field) => {
      if (pendingSettings[field] !== event[field as keyof Event]) {
        Object.assign(updates, { [field]: pendingSettings[field] });
      }
    });

    if (updates.startDate) {
      updates.startDate = new Date(updates.startDate).getTime();
    }
    if (updates.endDate) {
      updates.endDate = new Date(updates.endDate).getTime();
    }

    if (Object.keys(updates).length === 0) {
      toast.info("No changes to save.");
      return;
    }

    updateEventSettingsMutation.mutate(updates);
  };

  const updatePendingSetting = <TKey extends keyof PendingEventSettings>(
    key: TKey,
    value: PendingEventSettings[TKey],
  ) => {
    setPendingSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <main className="container mx-auto flex min-h-lvh max-w-7xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Event Dashboard: {event.name}</h1>
        {hasChanges && (
          <Button
            onClick={handleSaveSettings}
            className="fixed right-8 bottom-8 z-50 shadow-xl"
            disabled={updateEventSettingsMutation.isPending}
          >
            {updateEventSettingsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        )}
      </div>

      <Tabs value={currentTab} onValueChange={onTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="operation">Operation</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="admins">Admins</TabsTrigger>
          <TabsTrigger value="whitelist">Whitelist</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab
            event={event}
            participantsCount={participantsCountQuery.data ?? 0}
            teamsCount={teamsCountQuery.data ?? 0}
            starterTemplates={starterTemplatesQuery.data ?? []}
          />
        </TabsContent>

        <TabsContent value="operation" className="space-y-6">
          <OperationTab
            event={event}
            teamAutoLockTime={teamAutoLockTime}
            setTeamAutoLockTime={setTeamAutoLockTime}
            lockEventMutation={lockEventMutation}
            unlockEventMutation={unlockEventMutation}
            startSwissMatchesMutation={startSwissMatchesMutation}
            startTournamentMatchesMutation={startTournamentMatchesMutation}
            revealMatchesMutation={revealMatchesMutation}
            cleanupMatchesMutation={cleanupMatchesMutation}
            setTeamsLockDateMutation={setTeamsLockDateMutation}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <SettingsTab
            pendingSettings={pendingSettings}
            updatePendingSetting={updatePendingSetting}
            isGameConfigExpanded={isGameConfigExpanded}
            setIsGameConfigExpanded={setIsGameConfigExpanded}
            isServerConfigExpanded={isServerConfigExpanded}
            setIsServerConfigExpanded={setIsServerConfigExpanded}
            eventId={id}
          />
        </TabsContent>

        <TabsContent value="admins" className="space-y-6">
          <AdminsTab
            admins={adminsQuery.data ?? []}
            isAdminsLoading={adminsQuery.isPending}
            userSearchQuery={userSearchQuery}
            setUserSearchQuery={setUserSearchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            addAdminMutation={addAdminMutation}
            removeAdminMutation={removeAdminMutation}
          />
        </TabsContent>

        <TabsContent value="whitelist" className="space-y-6">
          <WhitelistManagement eventId={id} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function OverviewTab({
  event,
  participantsCount,
  teamsCount,
  starterTemplates,
}: {
  event: Event;
  participantsCount: number;
  teamsCount: number;
  starterTemplates: NonNullable<Event["starterTemplates"]>;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Event Overview</CardTitle>
          <CardDescription>Key live metrics for this event.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Metric label="Participants" value={participantsCount} />
            <Metric label="Teams" value={teamsCount} />
            <Metric label="Current Round" value={event.currentRound} />
            <Metric label="Privacy" value={event.isPrivate ? "Private" : "Public"} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <InfoBlock label="Start Date" value={formatDateTime(event.startDate)} />
            <InfoBlock label="End Date" value={formatDateTime(event.endDate)} />
            <InfoBlock label="Location" value={event.location || "Online"} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuration Snapshot</CardTitle>
          <CardDescription>Current technical setup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <CodeBlock
              className="lg:col-span-2"
              label="Monorepo URL"
              value={event.monorepoUrl || "Not set"}
            />
            <CodeBlock label="Monorepo Version" value={event.monorepoVersion} />
          </div>
          <CodeBlock label="Base Path" value={event.basePath} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <CodeBlock
              label="Game Server Image"
              value={event.gameServerDockerImage}
              small
            />
            <CodeBlock
              label="Bot Image (default)"
              value={event.myCoreBotDockerImage}
              small
            />
            <CodeBlock
              label="Visualizer Image"
              value={event.visualizerDockerImage}
              small
            />
          </div>

          {starterTemplates.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs uppercase opacity-70">
                Starter Templates
              </Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Docker Image</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {starterTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {template.id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {template.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {template.basePath}
                      </TableCell>
                      <TableCell className="font-mono text-xs break-all text-muted-foreground">
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
    </>
  );
}

function OperationTab({
  event,
  teamAutoLockTime,
  setTeamAutoLockTime,
  lockEventMutation,
  unlockEventMutation,
  startSwissMatchesMutation,
  startTournamentMatchesMutation,
  revealMatchesMutation,
  cleanupMatchesMutation,
  setTeamsLockDateMutation,
}: {
  event: Event;
  teamAutoLockTime: string;
  setTeamAutoLockTime: (value: string) => void;
  lockEventMutation: VoidMutation;
  unlockEventMutation: VoidMutation;
  startSwissMatchesMutation: VoidMutation;
  startTournamentMatchesMutation: VoidMutation;
  revealMatchesMutation: PhaseMutation;
  cleanupMatchesMutation: PhaseMutation;
  setTeamsLockDateMutation: TeamLockDateMutation;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operation Controls</CardTitle>
        <CardDescription>Immediate actions for running the event.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-10">
        <OperationSection title="Repository Management">
          <Button
            disabled={event.lockedAt != null || lockEventMutation.isPending}
            onClick={() => lockEventMutation.mutate(undefined)}
          >
            Lock Team Repositories
          </Button>
          <Button
            disabled={event.lockedAt == null || unlockEventMutation.isPending}
            onClick={() => unlockEventMutation.mutate(undefined)}
            variant="outline"
          >
            Unlock Team Repositories
          </Button>
        </OperationSection>

        <OperationSection title="Group Phase">
          <Button
            disabled={
              event.currentRound !== 0 || startSwissMatchesMutation.isPending
            }
            onClick={() => startSwissMatchesMutation.mutate(undefined)}
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
          <Button
            disabled={cleanupMatchesMutation.isPending}
            onClick={() => {
              if (
                window.confirm(
                  "Are you sure you want to delete ALL Group Phase matches? This will also reset team scores!",
                )
              ) {
                cleanupMatchesMutation.mutate("SWISS");
              }
            }}
            variant="destructive"
          >
            {cleanupMatchesMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Clean Up Group Phase
          </Button>
        </OperationSection>

        <OperationSection title="Tournament Phase">
          <Button
            disabled={startTournamentMatchesMutation.isPending}
            onClick={() => startTournamentMatchesMutation.mutate(undefined)}
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
          <Button
            disabled={cleanupMatchesMutation.isPending}
            onClick={() => {
              if (
                window.confirm(
                  "Are you sure you want to delete ALL Tournament matches?",
                )
              ) {
                cleanupMatchesMutation.mutate("ELIMINATION");
              }
            }}
            variant="destructive"
          >
            {cleanupMatchesMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Clean Up Tournament Matches
          </Button>
        </OperationSection>

        <div className="border-t pt-8">
          <h3 className="mb-4 text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase">
            Scheduling Auto-Lock
          </h3>
          <div className="flex max-w-md flex-wrap items-end gap-4">
            <div className="min-w-60 flex-1 space-y-2">
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
                    <CalendarIcon className="h-4 w-4" />
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
                    onSelect={(date) =>
                      date && setTeamAutoLockTime(date.toISOString())
                    }
                  />
                  <div className="border-t p-3">
                    <Input
                      type="time"
                      value={
                        teamAutoLockTime
                          ? format(new Date(teamAutoLockTime), "HH:mm")
                          : ""
                      }
                      onChange={(changeEvent) => {
                        const value = changeEvent.target.value;
                        if (!value) return;

                        const [hours, minutes] = value
                          .split(":")
                          .map((part) => Number.parseInt(part, 10));
                        if (Number.isNaN(hours) || Number.isNaN(minutes)) {
                          return;
                        }

                        const current = teamAutoLockTime
                          ? new Date(teamAutoLockTime)
                          : new Date();
                        const date = Number.isNaN(current.getTime())
                          ? new Date()
                          : current;
                        date.setHours(hours, minutes, 0, 0);
                        setTeamAutoLockTime(date.toISOString());
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <Button
              onClick={() =>
                setTeamsLockDateMutation.mutate(
                  teamAutoLockTime
                    ? new Date(teamAutoLockTime).getTime()
                    : null,
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
  );
}

function SettingsTab({
  pendingSettings,
  updatePendingSetting,
  isGameConfigExpanded,
  setIsGameConfigExpanded,
  isServerConfigExpanded,
  setIsServerConfigExpanded,
  eventId,
}: {
  pendingSettings: PendingEventSettings;
  updatePendingSetting: <TKey extends keyof PendingEventSettings>(
    key: TKey,
    value: PendingEventSettings[TKey],
  ) => void;
  isGameConfigExpanded: boolean;
  setIsGameConfigExpanded: (value: boolean) => void;
  isServerConfigExpanded: boolean;
  setIsServerConfigExpanded: (value: boolean) => void;
  eventId: string;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>Basic details about the event.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DashboardInput
              label="Event Name"
              value={pendingSettings.name || ""}
              onChange={(value) => updatePendingSetting("name", value)}
            />
            <DashboardInput
              label="Location"
              value={pendingSettings.location || ""}
              onChange={(value) => updatePendingSetting("location", value)}
            />
            <div className="space-y-2 md:col-span-2">
              <Label>Description (Markdown)</Label>
              <Textarea
                value={pendingSettings.description || ""}
                onChange={(event) =>
                  updatePendingSetting("description", event.target.value)
                }
                className="min-h-[100px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 border-t pt-4 md:grid-cols-2">
            <DashboardInput
              label="Start Date"
              type="datetime-local"
              value={formatDateTimeInput(pendingSettings.startDate)}
              onChange={(value) => updatePendingSetting("startDate", value)}
            />
            <DashboardInput
              label="End Date"
              type="datetime-local"
              value={formatDateTimeInput(pendingSettings.endDate)}
              onChange={(value) => updatePendingSetting("endDate", value)}
            />
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DashboardInput
              label="Min Team Size"
              type="number"
              value={pendingSettings.minTeamSize ?? 0}
              onChange={(value) =>
                updatePendingSetting("minTeamSize", Number.parseInt(value, 10))
              }
            />
            <DashboardInput
              label="Max Team Size"
              type="number"
              value={pendingSettings.maxTeamSize ?? 0}
              onChange={(value) =>
                updatePendingSetting("maxTeamSize", Number.parseInt(value, 10))
              }
            />
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Toggles</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SettingSwitch
                id="canCreateTeam"
                label="Allow Team Creation"
                checked={pendingSettings.canCreateTeam || false}
                onCheckedChange={(value) =>
                  updatePendingSetting("canCreateTeam", value)
                }
              />
              <SettingSwitch
                id="processQueue"
                label="Process Queue"
                checked={pendingSettings.processQueue || false}
                onCheckedChange={(value) =>
                  updatePendingSetting("processQueue", value)
                }
              />
              <SettingSwitch
                id="isPrivate"
                label="Private Event"
                checked={pendingSettings.isPrivate || false}
                onCheckedChange={(value) => updatePendingSetting("isPrivate", value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Technical Configuration</CardTitle>
          <CardDescription>Docker images and repository settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <DashboardInput
            label="Monorepo URL"
            value={pendingSettings.monorepoUrl || ""}
            onChange={(value) => updatePendingSetting("monorepoUrl", value)}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DashboardInput
              label="Monorepo Version"
              value={pendingSettings.monorepoVersion || ""}
              onChange={(value) =>
                updatePendingSetting("monorepoVersion", value)
              }
            />
            <DashboardInput
              label="Base Path"
              value={pendingSettings.basePath || ""}
              onChange={(value) => updatePendingSetting("basePath", value)}
            />
          </div>
          <DashboardInput
            label="Game Server Image"
            value={pendingSettings.gameServerDockerImage || ""}
            onChange={(value) =>
              updatePendingSetting("gameServerDockerImage", value)
            }
          />
          <DashboardInput
            label="Bot Image (default)"
            value={pendingSettings.myCoreBotDockerImage || ""}
            onChange={(value) =>
              updatePendingSetting("myCoreBotDockerImage", value)
            }
          />
          <DashboardInput
            label="Visualizer Image"
            value={pendingSettings.visualizerDockerImage || ""}
            onChange={(value) =>
              updatePendingSetting("visualizerDockerImage", value)
            }
          />
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
          <DashboardInput
            label="GitHub Organization"
            value={pendingSettings.githubOrg || ""}
            onChange={(value) => updatePendingSetting("githubOrg", value)}
          />
          <DashboardInput
            label="GitHub Organization Secret (Token)"
            type="password"
            placeholder="Enter new token to update (leave blank to keep current)"
            value={pendingSettings.githubOrgSecret || ""}
            onChange={(value) => updatePendingSetting("githubOrgSecret", value)}
          />
          <ExpandableJsonTextarea
            label="Game Config (JSON)"
            value={pendingSettings.gameConfig || ""}
            expanded={isGameConfigExpanded}
            onExpandedChange={setIsGameConfigExpanded}
            onChange={(value) => updatePendingSetting("gameConfig", value)}
          />
          <ExpandableJsonTextarea
            label="Server Config (JSON)"
            value={pendingSettings.serverConfig || ""}
            expanded={isServerConfigExpanded}
            onExpandedChange={setIsServerConfigExpanded}
            onChange={(value) => updatePendingSetting("serverConfig", value)}
          />
        </CardContent>
      </Card>
    </>
  );
}

function AdminsTab({
  admins,
  isAdminsLoading,
  userSearchQuery,
  setUserSearchQuery,
  searchResults,
  isSearching,
  addAdminMutation,
  removeAdminMutation,
}: {
  admins: EventAdmin[];
  isAdminsLoading: boolean;
  userSearchQuery: string;
  setUserSearchQuery: (value: string) => void;
  searchResults: UserSearchResult[];
  isSearching: boolean;
  addAdminMutation: StringMutation;
  removeAdminMutation: StringMutation;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Administrators</CardTitle>
        <CardDescription>Manage who can control this event.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative">
          <div className="flex max-w-md items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label>Search User to add as Admin</Label>
              <div className="relative">
                <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or username..."
                  className="pl-9"
                  value={userSearchQuery}
                  onChange={(event) => setUserSearchQuery(event.target.value)}
                />
              </div>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-w-md rounded-md border bg-popover text-popover-foreground shadow-md">
              <div className="p-1">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between rounded-sm p-2 text-left transition-colors hover:bg-accent"
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
                        <p className="text-sm leading-none font-medium">
                          {user.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @{user.username}
                        </p>
                      </div>
                    </div>
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {isSearching && (
            <div className="absolute z-10 mt-1 flex w-full max-w-md items-center justify-center rounded-md border bg-popover p-4 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <h3 className="mb-4 text-sm font-semibold">
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
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={admin.profilePicture || "/placeholder-avatar.png"}
                          alt={admin.name}
                          className="h-10 w-10 rounded-full border bg-background"
                        />
                        <div>
                          <p className="leading-none font-semibold">
                            {admin.name || "Unknown User"}
                          </p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            @{admin.username}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={
                          removeAdminMutation.isPending || admins.length <= 1
                        }
                        onClick={() => removeAdminMutation.mutate(admin.id)}
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
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <h3 className="mb-1 text-xs font-medium uppercase opacity-70">{label}</h3>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <Label className="text-xs font-medium uppercase opacity-60">{label}</Label>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

function CodeBlock({
  label,
  value,
  className,
  small = false,
}: {
  label: string;
  value?: string;
  className?: string;
  small?: boolean;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs uppercase opacity-70">{label}</Label>
      <p
        className={cn(
          "rounded border bg-muted/50 p-2 font-mono break-all",
          small ? "text-xs" : "text-sm",
        )}
      >
        {value || "Not set"}
      </p>
    </div>
  );
}

function OperationSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase">
        {title}
      </h3>
      <div className="flex flex-wrap gap-3">{children}</div>
    </div>
  );
}

function SettingSwitch({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <Label className="cursor-pointer" htmlFor={id}>
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function DashboardInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ExpandableJsonTextarea({
  label,
  value,
  expanded,
  onExpandedChange,
  onChange,
}: {
  label: string;
  value: string;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onExpandedChange(!expanded)}
        >
          {expanded ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
          {expanded ? "Minimize" : "Expand"}
        </Button>
      </div>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "font-mono text-xs transition-all duration-200",
          expanded ? "min-h-[1200px]" : "min-h-[200px]",
        )}
      />
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not set" : format(date, "PPP p");
}

function formatDateTimeInput(value: string | number | undefined) {
  if (!value) return "";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd'T'HH:mm");
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
