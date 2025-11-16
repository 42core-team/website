import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { Label } from "../ui/label";

interface TeamCreationSectionProps {
  newTeamName: string;
  setNewTeamName: (name: string) => void;
  handleCreateTeam: () => Promise<void>;
  isLoading: boolean;
  errorMessage?: string | null;
  validationError?: string | null;
}

export function TeamCreationSection({
  newTeamName,
  setNewTeamName,
  handleCreateTeam,
  // isLoading,
  errorMessage,
  validationError,
}: TeamCreationSectionProps) {
  return (
    <Card className=" p-5 rounded-lg border border-default-200">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Create Your Team</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 items-end">
          <div className="grid w-full max-w-sm items-center gap-3">
            <Label htmlFor="team-name">Team Name:</Label>
            <Input
              id="team-name"
              placeholder="Enter team name"
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              className="flex-1"
            />
          </div>
          <Button
            onClick={handleCreateTeam}
            // TODO: isLoading={isLoading}
            disabled={!newTeamName || !!validationError}
          >
            Create Team
          </Button>
        </div>
        {validationError && (
          <div className="text-destructive text-sm mt-1">{validationError}</div>
        )}
        {errorMessage && (
          <div className="text-destructive text-sm mt-1">{errorMessage}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default TeamCreationSection;
