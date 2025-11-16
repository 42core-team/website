"use client";

import type {
  Event,
} from "@/app/actions/event";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { isActionError } from "@/app/actions/errors";
import {
  getEventById,
  getParticipantsCountForEvent,
  getTeamsCountForEvent,
  isEventAdmin,
  setEventTeamsLockDate,
} from "@/app/actions/event";

import { EventState } from "@/app/actions/event-model";
import { lockEvent } from "@/app/actions/team";
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

interface DashboardPageProps {
  eventId: string;
}

export function DashboardPage({ eventId }: DashboardPageProps) {
  const session = useSession();

  const [event, setEvent] = useState<Event | null>(null);
  const [teamsCount, setTeamsCount] = useState<number>(0);
  const [participantsCount, setParticipantsCount] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [lockingTeamsLoading, setLockingTeamsLoading]
    = useState<boolean>(false);
  const [startingGroupPhase, setStartingGroupPhase] = useState<boolean>(false);
  const [startingTournament, setStartingTournament] = useState<boolean>(false);
  const [teamAutoLockTime, setTeamAutoLockTime] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const eventData = await getEventById(eventId);
        const teams = await getTeamsCountForEvent(eventId);
        const participants = await getParticipantsCountForEvent(eventId);
        const adminCheck = await isEventAdmin(eventId);

        if (isActionError(adminCheck) || isActionError(eventData)) {
          setIsAdmin(false);
          return;
        }

        setEvent(eventData);
        setTeamsCount(teams);
        setParticipantsCount(participants);
        if (eventData?.repoLockDate) {
          setTeamAutoLockTime(
            new Date(eventData.repoLockDate).toISOString().slice(0, 16),
          );
        }
        setIsAdmin(true);
        setLoading(false);
      }
      catch (error) {
        console.error("Error loading dashboard data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, session.status]);

  if (loading || !event) {
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
              <CardDescription>Key live metrics for this event.</CardDescription>
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
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-medium mb-2">Event State</h3>
                  <p className="text-2xl font-bold">{event.state.toLowerCase()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Docker Configuration</CardTitle>
              <CardDescription>Images & repository info configured for this event.</CardDescription>
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
                    <h3 className="text-sm font-medium mb-2">Monorepo Version</h3>
                    <p className="font-mono break-all">
                      {event.monorepoVersion}
                    </p>
                  </div>
                </div>
              )}

              {event.gameServerDockerImage && (
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-medium mb-2">Game Server Docker Image</h3>
                  <p className="font-mono break-all">
                    {event.gameServerDockerImage}
                  </p>
                </div>
              )}

              {event.myCoreBotDockerImage && (
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-medium mb-2">My Core Bot Docker Image</h3>
                  <p className="font-mono break-all">
                    {event.myCoreBotDockerImage}
                  </p>
                </div>
              )}

              {event.visualizerDockerImage && (
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-medium mb-2">Visualizer Docker Image</h3>
                  <p className="font-mono break-all">
                    {event.visualizerDockerImage}
                  </p>
                </div>
              )}

              {!event.monorepoUrl
                && !event.gameServerDockerImage
                && !event.myCoreBotDockerImage && (
                <p className="text-muted-foreground italic">
                  No Docker configuration set for this event.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Admin Actions</CardTitle>
              <CardDescription>Operational controls for advancing the event.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={event.lockedAt != null || lockingTeamsLoading}
                  onClick={() => {
                    setLockingTeamsLoading(true);
                    lockEvent(eventId)
                      .then(() => {
                        console.warn("locked team repositories");
                      })
                      .catch(() => {
                        console.error("error occurred");
                      })
                      .finally(() => {
                        setLockingTeamsLoading(false);
                      });
                  }}
                  variant="secondary"
                >
                  Lock Team Repositories
                </Button>

                <Button
                  disabled={
                    event.state !== EventState.SWISS_ROUND || startingGroupPhase
                  }
                  onClick={() => {
                    setStartingGroupPhase(true);
                    startSwissMatches(eventId)
                      .then(() => {
                        alert("started group phase");
                      })
                      .catch(() => {
                        alert("error occurred");
                        setStartingGroupPhase(false);
                      })
                      .finally(() => {});
                  }}
                  variant="secondary"
                >
                  Start Group Phase
                </Button>

                <Button
                  disabled={
                    event.state !== EventState.ELIMINATION_ROUND
                    || startingTournament
                  }
                  onClick={() => {
                    setStartingTournament(true);
                    startTournamentMatches(eventId)
                      .then(() => {
                        alert("started tournament phase");
                      })
                      .catch(() => {
                        alert("error occurred");
                        setStartingTournament(false);
                      })
                      .finally(() => {});
                  }}
                  variant="secondary"
                >
                  Start Tournament Phase
                </Button>
              </div>

              <h3 className="mt-4 text-sm font-medium">Team auto lock</h3>

              <div className="mt-2 flex gap-3">
                <Input
                  type="datetime-local"
                  value={teamAutoLockTime}
                  onChange={e => setTeamAutoLockTime(e.target.value)}
                  className="max-w-[300px]"
                  placeholder="lock repo"
                />

                <Button
                  onClick={() =>
                    setEventTeamsLockDate(
                      eventId,
                      new Date(teamAutoLockTime).getTime(),
                    ).then(() => {
                      alert("set team auto lock date");
                    })}
                >
                  Save
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEventTeamsLockDate(eventId, null).then(() => {
                      alert("reset team auto lock date");
                      setTeamAutoLockTime("");
                    });
                  }}
                >
                  Reset
                </Button>
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
