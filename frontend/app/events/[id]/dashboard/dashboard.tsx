"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@heroui/react";
import {
  Event,
  getEventById,
  getParticipantsCountForEvent,
  getTeamsCountForEvent,
  isEventAdmin,
  setEventTeamsLockDate,
} from "@/app/actions/event";

import { useSession } from "next-auth/react";
import { lockEvent } from "@/app/actions/team";
import { isActionError } from "@/app/actions/errors";
import { EventState } from "@/app/actions/event-model";
import {
  startSwissMatches,
  startTournamentMatches,
} from "@/app/actions/tournament";

type DashboardPageProps = {
  eventId: string;
};

export function DashboardPage({ eventId }: DashboardPageProps) {
  const session = useSession();

  const [event, setEvent] = useState<Event | null>(null);
  const [teamsCount, setTeamsCount] = useState<number>(0);
  const [participantsCount, setParticipantsCount] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [lockingTeamsLoading, setLockingTeamsLoading] =
    useState<boolean>(false);
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
            new Date(eventData.repoLockDate).toISOString().slice(0, 16)
          );
        }
        setIsAdmin(true);
        setLoading(false);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, session.status]);

  if (loading || !event) {
    return (
      <div className="flex justify-center items-center min-h-[50vh] text-white">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 bg-gray-900 min-h-lvh p-6">
      <h1 className="text-3xl font-bold text-white">Event Dashboard</h1>

      {/* Admin Actions */}
      {isAdmin && (
        <>
          <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-white">
              Event Overview
            </h2>
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Participants
                  </h3>
                  <p className="text-2xl font-bold text-white">
                    {participantsCount}
                  </p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Teams
                  </h3>
                  <p className="text-2xl font-bold text-white">{teamsCount}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Current Round
                  </h3>
                  <p className="text-2xl font-bold text-white">
                    {event.currentRound}
                  </p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Event State
                  </h3>
                  <p className="text-2xl font-bold text-white">
                    {event.state.toLowerCase()}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-white">
              Docker Configuration
            </h2>
            <div className="space-y-4">
              {event.monorepoUrl && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Monorepo URL
                    </h3>
                    <a
                      href={event.monorepoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 break-all"
                    >
                      {event.monorepoUrl}
                    </a>
                  </div>
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Monorepo Version
                    </h3>
                    <p className="text-white font-mono break-all">
                      {event.monorepoVersion}
                    </p>
                  </div>
                </div>
              )}

              {event.gameServerDockerImage && (
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Game Server Docker Image
                  </h3>
                  <p className="text-white font-mono break-all">
                    {event.gameServerDockerImage}
                  </p>
                </div>
              )}

              {event.myCoreBotDockerImage && (
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    My Core Bot Docker Image
                  </h3>
                  <p className="text-white font-mono break-all">
                    {event.myCoreBotDockerImage}
                  </p>
                </div>
              )}

              {event.visualizerDockerImage && (
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Visualizer Docker Image
                  </h3>
                  <p className="text-white font-mono break-all">
                    {event.visualizerDockerImage}
                  </p>
                </div>
              )}

              {!event.monorepoUrl &&
                !event.gameServerDockerImage &&
                !event.myCoreBotDockerImage && (
                  <p className="text-gray-400 italic">
                    No Docker configuration set for this event.
                  </p>
                )}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-white">
              Admin Actions
            </h2>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={event.lockedAt != null || lockingTeamsLoading}
                onClick={() => {
                  setLockingTeamsLoading(true);
                  lockEvent(eventId)
                    .then(() => {
                      alert("locked team repositories");
                    })
                    .catch(() => {
                      alert("error occurred");
                    })
                    .finally(() => {
                      setLockingTeamsLoading(false);
                    });
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white"
              >
                Lock Team Repositories
              </Button>

              <Button
                disabled={
                  event.state != EventState.SWISS_ROUND || startingGroupPhase
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
                className="bg-gray-700 hover:bg-gray-600 text-white"
              >
                Start Group Phase
              </Button>

              <Button
                disabled={
                  event.state != EventState.ELIMINATION_ROUND ||
                  startingTournament
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
                className="bg-gray-700 hover:bg-gray-600 text-white"
              >
                Start Tournament Phase
              </Button>
            </div>

            <h3 className="mt-4">Team auto lock</h3>

            <div className="mt-2 flex gap-3">
              <Input
                type="datetime-local"
                value={teamAutoLockTime}
                onValueChange={setTeamAutoLockTime}
                className="max-w-[300px]"
                placeholder="lock repo"
              />

              <Button
                onClick={() =>
                  setEventTeamsLockDate(
                    eventId,
                    new Date(teamAutoLockTime).getTime()
                  ).then(() => {
                    alert("set team auto lock date");
                  })
                }
              >
                save
              </Button>
              <Button
                onClick={() => {
                  setEventTeamsLockDate(eventId, null).then(() => {
                    alert("reset team auto lock date");
                    setTeamAutoLockTime("");
                  });
                }}
              >
                reset
              </Button>
            </div>

            <p className="text-sm text-gray-400 mt-4">
              Note: Advancing the tournament will move to the next round or
              phase depending on the current state.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
