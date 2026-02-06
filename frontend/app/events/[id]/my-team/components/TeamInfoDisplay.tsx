"use client";
import type {Team, TeamMember} from "@/app/actions/team";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {usePlausible} from "next-plausible";
import {useParams} from "next/navigation";
import {useState} from "react";
import axiosInstance from "@/app/actions/axios";
import {isActionError} from "@/app/actions/errors";
import {leaveTeam, hasEventStarted} from "@/app/actions/team";
import {getEventGithubOrg} from "@/app/actions/event";
import {TeamInfoSection} from "@/components/team";
import {getMatchesForTeam} from "@/app/actions/tournament";
import TeamMatchHistory from "@/app/events/[id]/teams/[teamId]/TeamMatchHistory";

interface TeamInfoDisplayProps {
    team: Team;
    teamMembers: TeamMember[];
}

export default function TeamInfoDisplay({
                                            team: initialTeam,
                                            teamMembers: initialTeamMembers,
                                        }: TeamInfoDisplayProps) {
    const plausible = usePlausible();
    const queryClient = useQueryClient();

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const eventId = useParams().id as string;

    const {data: githubOrg} = useQuery({
        queryKey: ["event", eventId, "github-org"],
        queryFn: async () => {
            const resp = await getEventGithubOrg(eventId);
            if (isActionError(resp)) {
                return null;
            }
            return resp;
        },
    });

    const {data: matches} = useQuery({
        queryKey: ["event", eventId, "matches"],
        queryFn: async () => {
            const resp = await getMatchesForTeam(initialTeam.id);
            if (isActionError(resp)) {
                return null;
            }
            return resp;
        },
    });

    const {data: team} = useQuery<Team | null>({
        refetchInterval: 3000,
        queryKey: ["event", eventId, "my-team"],
        queryFn: async () => {
            const response = await axiosInstance.get<Team | null>(
                `/team/event/${eventId}/my`,
            );
            return response.data;
        },
        initialData: initialTeam,
    });

    const {data: eventStarted = true} = useQuery({
        queryKey: ["team", team?.id, "event-started"],
        queryFn: () => hasEventStarted(team!.id),
        enabled: !!team?.id,
    });

    const isRepoPending = !eventStarted || !githubOrg;

    const {data: teamMembers = []} = useQuery<TeamMember[]>({
        queryKey: ["team", team?.id, "members"],
        queryFn: async () => {
            const response = await axiosInstance.get<TeamMember[]>(
                `/team/${team?.id}/members`,
            );
            return response.data;
        },
        enabled: Boolean(team?.id),
        initialData: initialTeamMembers,
    });

    const leaveTeamMutation = useMutation({
        mutationFn: async () => {
            const result = await leaveTeam(eventId);
            if (isActionError(result)) {
                throw new Error(result.error);
            }
        },
        onMutate: () => {
            plausible("leave_team");
            setErrorMessage(null);
        },
        onError: (error: Error) => {
            setErrorMessage(error.message);
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: ["event", eventId, "my-team"],
                }),
                queryClient.invalidateQueries({
                    queryKey: ["team", team?.id, "members"],
                }),
            ]);
        },
    });

    async function handleLeaveTeam(): Promise<boolean> {
        try {
            await leaveTeamMutation.mutateAsync();
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: ["event", eventId, "my-team"],
                }),
                queryClient.invalidateQueries({
                    queryKey: ["team", team?.id, "members"],
                }),
                queryClient.invalidateQueries({
                    queryKey: ["event", eventId, "pending-invites"],
                }),
            ]);
            return true;
        } catch {
            return false;
        }
    }

    if (!team) {
        return null;
    }

    return (
        <>
            {errorMessage && (
                <div className="bg-danger-50 border border-danger-200 text-destructive-800 px-4 py-3 rounded mb-4">
                    {errorMessage}
                </div>
            )}
            <div className="py-3 space-y-4">
                <TeamInfoSection
                    myTeam={team}
                    onLeaveTeam={handleLeaveTeam}
                    isLeaving={leaveTeamMutation.isPending}
                    teamMembers={teamMembers}
                    isRepoPending={isRepoPending}
                    githubOrg={githubOrg ?? ""}
                />

                <TeamMatchHistory eventId={eventId} matches={matches || []}/>
            </div>
        </>
    );
}
