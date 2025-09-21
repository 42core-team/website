import { Button } from "@heroui/react";
import { Input } from "@heroui/input";

interface TeamCreationSectionProps {
  newTeamName: string;
  setNewTeamName: (name: string) => void;
  handleCreateTeam: () => Promise<void>;
  isLoading: boolean;
  errorMessage?: string | null;
  validationError?: string | null;
}

export const TeamCreationSection = ({
  newTeamName,
  setNewTeamName,
  handleCreateTeam,
  isLoading,
  errorMessage,
  validationError,
}: TeamCreationSectionProps) => (
  <div className="bg-default-50 p-5 rounded-lg border border-default-200">
    <h2 className="text-xl font-semibold mb-4">Create Your Team</h2>
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <Input
          label="Team Name"
          placeholder="Enter team name"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          className="flex-1"
        />
        <Button
          color="primary"
          onPress={handleCreateTeam}
          isLoading={isLoading}
          isDisabled={!newTeamName || !!validationError}
        >
          Create Team
        </Button>
      </div>
      {validationError && (
        <div className="text-danger text-sm mt-1">{validationError}</div>
      )}
      {errorMessage && (
        <div className="text-danger text-sm mt-1">{errorMessage}</div>
      )}
    </div>
  </div>
);

export default TeamCreationSection;
