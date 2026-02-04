import type {
  UserSearchResult,
} from "@/app/actions/team";

import { usePlausible } from "next-plausible";
import { useEffect, useState } from "react";
import {
  searchUsersForInvite,
} from "@/app/actions/team";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import axiosInstance from "@/app/actions/axios";
import {toast} from "sonner";

interface TeamInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  eventId: string;
}

export function TeamInviteModal({
  isOpen,
  onClose,
  eventId,
}: TeamInviteModalProps) {
  const plausible = usePlausible();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isInviting, setIsInviting] = useState<Record<string, boolean>>({});

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setIsSearching(true);
      searchUsersForInvite(eventId, debouncedQuery)
        .then(results => setSearchResults(results))
        .catch(error => console.error("Error searching users:", error))
        .finally(() => setIsSearching(false));
    }
    else {
      setSearchResults([]);
    }
  }, [debouncedQuery, eventId]);

  // Send invite to a user
  const handleInviteUser = async (userId: string) => {
    plausible("invite_team_member");
    setIsInviting(prev => ({ ...prev, [userId]: true }));
    try {
      await axiosInstance.post(`team/event/${eventId}/sendInvite`, {
        userToInviteId: userId,
      });

      setSearchResults(prev =>
        prev.map(user =>
          user.id === userId ? { ...user, isInvited: true } : user,
        ),
      );
    }
    catch (error: any) {
      toast.error(
        error?.response?.data?.message
        || error?.message
        || "Failed to send invite.",
      );
    }
    finally {
      setIsInviting(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Invite first non-invited search result on Enter
  const handleEnterToInvite = () => {
    if (isSearching || searchResults.length === 0)
      return;
    const firstAvailable = searchResults.find(u => !u.isInvited);
    if (!firstAvailable)
      return;
    if (isInviting[firstAvailable.id])
      return;
    void handleInviteUser(firstAvailable.id);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open)
          onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Invite Team Members
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid w-full max-w-sm items-center gap-3">
            <Label htmlFor="search">Search Users</Label>
            <Input
              id="search"
              placeholder="Search by username or name"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="mb-4"
              autoFocus={true}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleEnterToInvite();
                }
              }}
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {isSearching
              ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
                </div>
              )
              : searchQuery.length < 2
                ? (
                  <p className="text-muted-foreground text-center py-2">
                    Type at least 2 characters to search
                  </p>
                )
                : searchResults.length === 0
                  ? (
                    <p className="text-muted-foreground text-center py-2">
                      No users found
                    </p>
                  )
                  : (
                    searchResults.map(user => (
                      <div
                        key={user.id}
                        className="flex justify-between items-center p-2 border-b last:border-0"
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
                            <p className="text-muted-foreground text-sm">
                              {user.username}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          disabled={user.isInvited}
                          isLoading={isInviting[user.id]}
                          onClick={() => handleInviteUser(user.id)}
                        >
                          {user.isInvited ? "Invited" : "Invite"}
                        </Button>
                      </div>
                    ))
                  )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TeamInviteModal;
