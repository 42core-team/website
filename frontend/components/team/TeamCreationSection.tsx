import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
    <Card className="rounded-lg border">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Create Your Team</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-row gap-2">
          <Input
            id="team-name"
            placeholder="Enter team name"
            value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)}
          />
          <Button
            onClick={handleCreateTeam}
            // TODO: isLoading={isLoading}
            disabled={!newTeamName || !!validationError}
          >
            Create Team
          </Button>
        </div>
        <div className="mt-2">
          {validationError && (
            <div className="text-destructive text-sm">{validationError}</div>
          )}
          {errorMessage && (
            <div className="text-destructive text-sm">{errorMessage}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default TeamCreationSection;
