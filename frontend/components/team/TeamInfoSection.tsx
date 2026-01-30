import type { Team, TeamMember } from "@/app/actions/team";

import { DialogTrigger } from "@radix-ui/react-dialog";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { isActionError } from "@/app/actions/errors";

import { getEventById } from "@/app/actions/event";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import TeamInviteModal from "./TeamInviteModal";

interface TeamInfoSectionProps {
  myTeam: Team;
  onLeaveTeam: () => Promise<boolean>;
  isLeaving: boolean;
  teamMembers: TeamMember[];
  isRepoPending?: boolean;
}

export function TeamInfoSection({
  myTeam,
  onLeaveTeam,
  isLeaving,
  teamMembers,
}: Readonly<TeamInfoSectionProps>) {
  const eventId = useParams().id as string;
  const [isOpen, setIsOpen] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [githubOrg, setGithubOrg] = useState<string | null>(null);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);

  useEffect(() => {
    const loadGithubOrg = async () => {
      const event = await getEventById(eventId);
      if (isActionError(event))
        return;

      setGithubOrg(event.githubOrg);
    };
    loadGithubOrg();
  }, [eventId]);

  const getRepoUrl = () => {
    return `https://github.com/${githubOrg}/${myTeam.repo}`;
  };

  const handleConfirmLeave = async () => {
    setLeaveError(null);
    const success = await onLeaveTeam();
    if (!success) {
      setLeaveError(
        "Failed to leave team. Try refreshing the page or trying again later.",
      );
      return;
    }

    setIsLeaveDialogOpen(false);
  };

  return (
    <Card className="rounded-lg border">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">
          Team:
          {" "}
          {myTeam.name}
        </CardTitle>
        {myTeam.locked && <Badge variant="destructive">Locked</Badge>}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Repository</p>
            <div className="font-medium">
              {myTeam.repo
                ? (
                    <a
                      href={getRepoUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {myTeam.repo}
                    </a>
                  )
                : (
                    <Skeleton className="m-2 h-5 w-75 rounded-md" />
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
        <div className="rounded-lg border p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Team Members</h3>
            {!myTeam.locked && (
              <Button size="sm" onClick={() => setIsOpen(true)}>
                <Plus className="size-4" />
                Invite Others
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-3">
            {teamMembers.length > 0
              ? (
                  teamMembers.map(member => (
                    <Link
                      key={member.id}
                      href={`https://github.com/${member.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="no-icon group w-full max-w-32 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      aria-label={`Open ${member.username}'s GitHub profile`}
                    >
                      <div className="bg-content1/50 ring-default-200 flex flex-col items-center rounded-xl p-4 shadow-sm ring-1 transition hover:shadow-md hover:ring-primary/60">
                        <Avatar
                          className={cn(
                            "mb-2",
                            member.isEventAdmin
                              ? "outline-orange-500 outline-2"
                              : "",
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
                        <span className="external-link w-full truncate text-center text-sm font-medium group-hover:text-primary">
                          {member.username}
                        </span>
                      </div>
                    </Link>
                  ))
                )
              : (
                  <p className="col-span-full text-center text-muted-foreground">
                    No team members found
                  </p>
                )}
          </div>
        </div>

        {/* Team Management Compartment */}
        <div>
          {leaveError && (
            <div className="bg-danger-50 text-destructive-700 border-danger-200 mb-4 rounded-md border px-4 py-3">
              {leaveError}
            </div>
          )}
          <div className="flex items-center justify-end">
            {!myTeam.locked && (
              <Dialog
                open={isLeaveDialogOpen}
                onOpenChange={setIsLeaveDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="destructive">Leave Team</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">
                      Leave Team
                    </DialogTitle>
                  </DialogHeader>
                  <DialogDescription>
                    <p>
                      Are you sure you want to leave this team? This action
                      cannot be undone.
                    </p>
                    {teamMembers.length === 1 && (
                      <p className="text-destructive-500 mt-2">
                        Warning: You are the last member of this team. Leaving
                        will delete the team.
                      </p>
                    )}
                  </DialogDescription>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button className="mr-2">Cancel</Button>
                    </DialogClose>
                    <Button
                      type="submit"
                      variant="destructive"
                      onClick={handleConfirmLeave}
                      disabled={isLeaving}
                    >
                      {isLeaving ? <Spinner /> : "Leave Team"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
      </CardContent>
    </Card>
  );
}

export default TeamInfoSection;
