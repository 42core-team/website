import { Team, TeamMember } from "@/app/actions/team";
import TeamCreationForm from "./components/TeamCreationForm";
import TeamInfoDisplay from "./components/TeamInfoDisplay";
import TeamInvitesDisplay from "./components/TeamInvitesDisplay";

interface TeamViewProps {
  initialTeam: Team | null;
  teamMembers: TeamMember[];
  pendingInvites: Team[];
}

export default function TeamView({
  initialTeam,
  teamMembers,
  pendingInvites,
}: TeamViewProps) {
  return (
    <div className="max-w-4xl mx-auto mb-8 mt-3">
      {!initialTeam ? (
        <>
          <TeamCreationForm />
          <div className="mb-5"></div>
          <TeamInvitesDisplay pendingInvites={pendingInvites} />
        </>
      ) : (
        <TeamInfoDisplay team={initialTeam} teamMembers={teamMembers} />
      )}
    </div>
  );
}
