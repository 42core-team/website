import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Input } from "@heroui/input";
import {
  UserSearchResult,
  searchUsersForInvite,
  sendTeamInvite,
} from "@/app/actions/team";
import { usePlausible } from "next-plausible";

interface TeamInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  eventId: string;
}

export const TeamInviteModal = ({
  isOpen,
  onClose,
  eventId,
}: TeamInviteModalProps) => {
  const plausible = usePlausible();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isInviting, setIsInviting] = useState<Record<string, boolean>>({});

  // Handle search input change
  const handleSearchChange = async (value: string) => {
    setSearchQuery(value);

    if (value.length >= 2) {
      setIsSearching(true);
      try {
        const results = await searchUsersForInvite(eventId, value);
        setSearchResults(results);
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  // Send invite to a user
  const handleInviteUser = async (userId: string) => {
    plausible("invite_team_member");
    setIsInviting((prev) => ({ ...prev, [userId]: true }));
    try {
      await sendTeamInvite(eventId, userId);

      setSearchResults((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, isInvited: true } : user,
        ),
      );
    } catch (error: any) {
      // You can customize this error message as needed
      alert(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to send invite.",
      );
    } finally {
      setIsInviting((prev) => ({ ...prev, [userId]: false }));
    }
  };

  // Invite first non-invited search result on Enter
  const handleEnterToInvite = () => {
    if (isSearching || searchResults.length === 0) return;
    const firstAvailable = searchResults.find((u) => !u.isInvited);
    if (!firstAvailable) return;
    if (isInviting[firstAvailable.id]) return;
    void handleInviteUser(firstAvailable.id);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Invite Team Members
          </DialogTitle>
        </DialogHeader>
        <DialogContent>
          <Input
            label="Search Users"
            placeholder="Search by username or name"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="mb-4"
            autoFocus={true}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleEnterToInvite();
              }
            }}
          />
          <div className="max-h-[300px] overflow-y-auto">
            {isSearching ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
              </div>
            ) : searchQuery.length < 2 ? (
              <p className="text-default-500 text-center py-2">
                Type at least 2 characters to search
              </p>
            ) : searchResults.length === 0 ? (
              <p className="text-default-500 text-center py-2">
                No users found
              </p>
            ) : (
              searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex justify-between items-center p-2 border-b border-default-200 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={user.profilePicture}
                        alt={user.name || "User"}
                      />
                      <AvatarFallback>
                        {(user.name || "User").substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-default-500 text-sm">
                        {user.username}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={user.isInvited}
                    // TODO: isLoading={isInviting[user.id]}
                    onClick={() => handleInviteUser(user.id)}
                  >
                    {user.isInvited ? "Invited" : "Invite"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="destructive" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TeamInviteModal;
