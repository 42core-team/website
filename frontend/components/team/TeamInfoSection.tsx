import { useParams } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus } from "lucide-react";

import { Team, TeamMember } from "@/app/actions/team";
import TeamInviteModal from "./TeamInviteModal";
import { useEffect, useState } from "react";
import { getEventById } from "@/app/actions/event";
import { isActionError } from "@/app/actions/errors";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface TeamInfoSectionProps {
  myTeam: Team;
  onLeaveTeam: () => Promise<boolean>;
  isLeaving: boolean;
  teamMembers: TeamMember[];
  isRepoPending?: boolean;
}

export const TeamInfoSection = ({
  myTeam,
  onLeaveTeam,
  isLeaving,
  teamMembers,
  isRepoPending = false,
}: TeamInfoSectionProps) => {
  const eventId = useParams().id as string;
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [githubOrg, setGithubOrg] = useState<string | null>(null);

  useEffect(() => {
    const loadGithubOrg = async () => {
      const event = await getEventById(eventId);
      if (isActionError(event)) return;

      setGithubOrg(event.githubOrg);
    };
    loadGithubOrg();
  }, [eventId]);

  const getRepoUrl = () => {
    return `https://github.com/${githubOrg}/${myTeam.repo}`;
  };

  const handleConfirmLeave = async () => {
    setLeaveError(null);
    setIsConfirmOpen(false);
    const success = await onLeaveTeam();
    if (!success) {
      setLeaveError(
        "Failed to leave team. Try refreshing the page or trying again later."
      );
    }
  };

  return (
    <div className="bg-default-50 p-6 rounded-lg border border-default-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Team: {myTeam.name}</h2>
        {myTeam.locked && <Badge variant="destructive">Locked</Badge>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Repository</p>
          <div className="font-medium">
            {myTeam.repo ? (
              <a
                href={getRepoUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {myTeam.repo}
              </a>
            ) : isRepoPending ? (
              <Skeleton className="h-5 w-75 rounded-md m-2" />
            ) : (
              "Not yet configured"
            )}
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Created</p>
          <p className="font-medium">
            {new Date(myTeam.createdAt || "").toLocaleDateString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Queue score</p>
          <p className="font-medium">{myTeam.queueScore}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Updated</p>
          <p className="font-medium">
            {new Date(myTeam.updatedAt || "").toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Team Members Section */}
      <div className="mt-6 mb-6 p-4 bg-default-100 rounded-lg">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Team Members</h3>
          {!myTeam.locked && (
            <Button size="sm" onClick={() => setIsOpen(true)}>
              <Plus className="size-4" />
              Invite Others
            </Button>
          )}
        </div>
        <div className="flex gap-3 items-start flex-wrap">
          {teamMembers.length > 0 ? (
            teamMembers.map((member) => (
              <Link
                key={member.id}
                href={`https://github.com/${member.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-full max-w-32 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-xl"
                aria-label={`Open ${member.username}'s GitHub profile`}
              >
                <div className="flex flex-col items-center rounded-xl bg-content1/50 p-4 ring-1 ring-default-200 shadow-sm transition hover:shadow-md hover:ring-primary/60">
                  <Avatar
                    className={cn(
                      "mb-2",
                      member.isEventAdmin ? "outline-orange-500 outline-2" : ""
                    )}
                  >
                    <AvatarImage
                      src={member.profilePicture}
                      alt={member.name}
                    />
                    <AvatarFallback>
                      {member.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-center truncate w-full group-hover:text-primary">
                    {member.username}
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-muted-foreground col-span-full text-center">
              No team members found
            </p>
          )}
        </div>
      </div>

      {/* Team Management Compartment */}
      <div>
        {leaveError && (
          <div className="mb-4 px-4 py-3 rounded-md bg-danger-50 text-danger-700 border border-danger-200">
            {leaveError}
          </div>
        )}
        <div className="flex justify-end items-center">
          {!myTeam.locked && (
            <Button
              variant="destructive"
              onClick={() => setIsConfirmOpen(true)}
            >
              Leave Team
            </Button>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      <TeamInviteModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        teamId={myTeam.id}
        eventId={eventId}
      />

      {/* Leave Team Confirmation Modal */}
      <Dialog
        open={isConfirmOpen}
        onOpenChange={(open) => {
          if (!open) setIsConfirmOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Leave Team
            </DialogTitle>
          </DialogHeader>
          <DialogContent>
            <p>
              Are you sure you want to leave this team? This action cannot be
              undone.
            </p>
            {teamMembers.length === 1 && (
              <p className="mt-2 text-danger-500">
                Warning: You are the last member of this team. Leaving will
                delete the team.
              </p>
            )}
          </DialogContent>
          <DialogFooter>
            <Button onClick={() => setIsConfirmOpen(false)} className="mr-2">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmLeave}
              // TODO: isLoading={isLeaving}
            >
              Leave Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamInfoSection;
