"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { isActionError } from "@/app/actions/errors";
import {
  addToWhitelist,
  bulkRemoveFromWhitelist,
  getEventWhitelist,
  removeFromWhitelist,
} from "@/app/actions/event";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface WhitelistManagementProps {
  eventId: string;
}

export function WhitelistManagement({ eventId }: WhitelistManagementProps) {
  const queryClient = useQueryClient();
  const [usernames, setUsernames] = useState("");
  const [platform, setPlatform] = useState<"GITHUB" | "FORTYTWO">("GITHUB");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: whitelist = [], isLoading } = useQuery({
    queryKey: ["event", eventId, "whitelist"],
    queryFn: async () => {
      const result = await getEventWhitelist(eventId);
      if (isActionError(result))
        throw new Error(result.error);
      return result;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (entries: { username: string; platform: "GITHUB" | "FORTYTWO" }[]) => {
      const result = await addToWhitelist(eventId, entries);
      if (isActionError(result))
        throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success("Users added to whitelist");
      setUsernames("");
      queryClient.invalidateQueries({ queryKey: ["event", eventId, "whitelist"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (whitelistId: string) => {
      const result = await removeFromWhitelist(eventId, whitelistId);
      if (isActionError(result))
        throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success("User removed from whitelist");
      queryClient.invalidateQueries({ queryKey: ["event", eventId, "whitelist"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkRemoveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const result = await bulkRemoveFromWhitelist(eventId, ids);
      if (isActionError(result))
        throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success("Users removed from whitelist");
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["event", eventId, "whitelist"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAdd = () => {
    const lines = usernames
      .split("\n")
      .map(line => line.trim().toLowerCase())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      toast.error("Please enter at least one username");
      return;
    }

    const entries = lines.map(username => ({ username, platform }));
    addMutation.mutate(entries);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    }
    else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === whitelist.length) {
      setSelectedIds(new Set());
    }
    else {
      setSelectedIds(new Set(whitelist.map(w => w.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) {
      toast.error("Please select users to delete");
      return;
    }
    bulkRemoveMutation.mutate(Array.from(selectedIds));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Whitelist</CardTitle>
        <CardDescription>
          Manage which users can join this private event. If the whitelist is empty, anyone with the link can join.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading
          ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )
          : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12.5">
                          <Checkbox
                            checked={whitelist.length > 0 && selectedIds.size === whitelist.length}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead className="w-25 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {whitelist.length === 0
                        ? (
                            <TableRow>
                              <TableCell colSpan={4} className="p-8 text-center text-muted-foreground">
                                No users whitelisted. Anyone with the event link can join.
                              </TableCell>
                            </TableRow>
                          )
                        : (
                            whitelist.map(entry => (
                              <TableRow key={entry.id}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedIds.has(entry.id)}
                                    onCheckedChange={() => toggleSelect(entry.id)}
                                  />
                                </TableCell>
                                <TableCell className="font-mono">{entry.username}</TableCell>
                                <TableCell>
                                  <Badge variant={entry.platform === "GITHUB" ? "default" : "secondary"}>
                                    {entry.platform === "GITHUB" ? "GitHub" : "42"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => removeMutation.mutate(entry.id)}
                                    disabled={removeMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                    </TableBody>
                  </Table>
                </div>

                {whitelist.length > 0 && selectedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={bulkRemoveMutation.isPending}
                    >
                      {bulkRemoveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Delete Selected (
                      {selectedIds.size}
                      )
                    </Button>
                  </div>
                )}

                <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="font-medium">Add Users to Whitelist</h3>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="usernames">Usernames (one per line)</Label>
                      <Textarea
                        id="usernames"
                        placeholder={`username1
username2
username3`}
                        value={usernames}
                        onChange={e => setUsernames(e.target.value)}
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="platform">Platform</Label>
                      <Select value={platform} onValueChange={(v: "GITHUB" | "FORTYTWO") => setPlatform(v)}>
                        <SelectTrigger id="platform">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GITHUB">GitHub</SelectItem>
                          <SelectItem value="FORTYTWO">42 Intra</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleAdd}
                      disabled={addMutation.isPending || !usernames.trim()}
                    >
                      {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add to Whitelist
                    </Button>
                  </div>
                </div>
              </>
            )}
      </CardContent>
    </Card>
  );
}
