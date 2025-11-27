"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { isActionError } from "@/app/actions/errors";
import { createEvent } from "@/app/actions/event";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  description: z.string().optional(),
  githubOrg: z.string().min(1, "GitHub organization is required"),
  githubOrgSecret: z.string().min(1, "GitHub organization secret is required"),
  location: z.string().optional(),
  startDate: z.date({ message: "Start date is required" }),
  endDate: z.date({ message: "End date is required" }),
  minTeamSize: z.number().min(1).max(10),
  maxTeamSize: z.number().min(1).max(10),
  monorepoUrl: z.string().min(1, "Monorepo URL is required"),
  monorepoVersion: z.string().min(1, "Monorepo version is required"),
  gameServerDockerImage: z.string().min(1, "Game server image is required"),
  myCoreBotDockerImage: z.string().min(1, "My Core Bot image is required"),
  visualizerDockerImage: z.string().min(1, "Visualizer image is required"),
  gameServerImageTag: z.string().optional(),
  myCoreBotImageTag: z.string().optional(),
  visualizerImageTag: z.string().optional(),
  isPrivate: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

async function validateGithubToken(
  orgName: string,
  token: string,
): Promise<string | null> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
  };

  try {
    // 1. Check if the token is valid and has access to the organization
    const orgResponse = await fetch(`https://api.github.com/orgs/${orgName}`, {
      headers,
    });
    if (!orgResponse.ok) {
      let errorMessage = `Failed to access GitHub organization: ${orgResponse.statusText}`;
      try {
        const errorBody = await orgResponse.json();
        if (errorBody && errorBody.message) {
          errorMessage = `GitHub API Error: ${errorBody.message}`;
        }
      } catch {
        // Ignore JSON parsing errors, use default message
      }
      if (orgResponse.status === 404) {
        return `Organization '${orgName}' not found or token has no access. ${errorMessage}`;
      }
      return errorMessage;
    }

    // 2. Check for repository creation permissions (by trying to list repos)
    const reposResponse = await fetch(
      `https://api.github.com/orgs/${orgName}/repos?type=all`,
      { headers },
    );
    if (!reposResponse.ok) {
      let errorMessage = `Token lacks permission to list repositories in '${orgName}'. Required: 'repo' scope.`;
      try {
        const errorBody = await reposResponse.json();
        if (errorBody && errorBody.message) {
          errorMessage = `GitHub API Error: ${errorBody.message}`;
        }
      } catch {
        // Ignore JSON parsing errors
      }
      return errorMessage;
    }

    // 3. Check for invitation permissions (by trying to list members)
    const membersResponse = await fetch(
      `https://api.github.com/orgs/${orgName}/members`,
      { headers },
    );
    if (!membersResponse.ok) {
      let errorMessage = `Token lacks permission to list members in '${orgName}'. Required: 'admin:org' or 'read:org' scope.`;
      try {
        const errorBody = await membersResponse.json();
        if (errorBody && errorBody.message) {
          errorMessage = `GitHub API Error: ${errorBody.message}`;
        }
      } catch {
        // Ignore JSON parsing errors
      }
      return errorMessage;
    }

    // 4. Content read and write scope is generally covered by repo creation/admin permissions.
    //    Directly checking 'contents' scope is not straightforward via REST API without trying to modify content.
    //    Assuming if repo creation is possible, content read/write is implicitly handled for new repos.

    return null; // Token is valid and has required permissions
  } catch (error) {
    console.error("GitHub token validation error:", error);
    return "An unexpected error occurred during GitHub token validation.";
  }
}

export default function CreateEventForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [tagFetchError, setTagFetchError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      githubOrg: "",
      githubOrgSecret: "",
      location: "",
      minTeamSize: 1,
      maxTeamSize: 4,
      monorepoUrl: "https://github.com/42core-team/monorepo",
      monorepoVersion: "",
      gameServerDockerImage: "ghcr.io/42core-team/server",
      myCoreBotDockerImage: "ghcr.io/42core-team/my-core-bot",
      visualizerDockerImage: "ghcr.io/42core-team/visualizer",
      gameServerImageTag: "",
      myCoreBotImageTag: "",
      visualizerImageTag: "",
      isPrivate: false,
    },
  });

  const monorepoUrl = form.watch("monorepoUrl");

  // Extract owner/repo from a GitHub URL like https://github.com/owner/repo
  const parseGitHubRepo = (
    url: string,
  ): { owner: string; repo: string } | null => {
    try {
      const u = new URL(url.trim());
      if (u.hostname !== "github.com") return null;
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length < 2) return null;
      return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
    } catch {
      return null;
    }
  };

  // Fetch tags when monorepo URL changes
  useEffect(() => {
    const parsed = parseGitHubRepo(monorepoUrl);
    if (!parsed) {
      setAvailableTags([]);
      setTagFetchError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const fetchTags = async () => {
      setIsLoadingTags(true);
      setTagFetchError(null);
      try {
        const headers: Record<string, string> = {
          Accept: "application/vnd.github+json",
        };
        const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/tags?per_page=100`;
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body?.message || `Failed to fetch tags (${res.status})`,
          );
        }
        const data: Array<{ name: string }> = await res.json();
        if (!cancelled) {
          setAvailableTags(
            Array.from(new Set((data || []).map((t) => t.name))),
          );
        }
      } catch (e: any) {
        if (!cancelled && e?.name !== "AbortError") {
          setAvailableTags([]);
          setTagFetchError(e?.message || "Failed to fetch tags");
        }
      } finally {
        if (!cancelled) setIsLoadingTags(false);
      }
    };

    fetchTags();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [monorepoUrl]);

  function combineImageAndTag(
    image: string | undefined,
    tag: string | undefined,
  ): string | undefined {
    if (!image?.trim() || !tag?.trim()) {
      return image || undefined;
    }
    return `${image.trim()}:${tag.trim()}`;
  }

  const onSubmit = async (values: FormValues) => {
    setError(null);

    const gameServerDockerImageString = combineImageAndTag(
      values.gameServerDockerImage,
      values.gameServerImageTag,
    );
    const myCoreBotDockerImageString = combineImageAndTag(
      values.myCoreBotDockerImage,
      values.myCoreBotImageTag,
    );
    const visualizerDockerImageString = combineImageAndTag(
      values.visualizerDockerImage,
      values.visualizerImageTag,
    );

    if (!gameServerDockerImageString) {
      setError("Game Server image is required");
      return;
    }
    if (!myCoreBotDockerImageString) {
      setError("My Core Bot image is required");
      return;
    }
    if (!visualizerDockerImageString) {
      setError("Visualizer image is required");
      return;
    }

    const validationError = await validateGithubToken(
      values.githubOrg,
      values.githubOrgSecret,
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    const result = await createEvent({
      name: values.name.trim(),
      description: values.description?.trim() || "",
      githubOrg: values.githubOrg,
      githubOrgSecret: values.githubOrgSecret,
      location: values.location?.trim() || "",
      startDate: values.startDate.getTime(),
      endDate: values.endDate.getTime(),
      minTeamSize: values.minTeamSize,
      maxTeamSize: values.maxTeamSize,
      monorepoUrl: values.monorepoUrl.trim(),
      monorepoVersion: values.monorepoVersion.trim(),
      gameServerDockerImage: gameServerDockerImageString,
      myCoreBotDockerImage: myCoreBotDockerImageString,
      visualizerDockerImage: visualizerDockerImageString,
      isPrivate: values.isPrivate,
    });

    if (isActionError(result)) {
      setError(result.error);
      return;
    }

    router.push(`/events/${result.id}`);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full justify-center items-center space-y-4"
      >
        {error && (
          <div className="p-3 bg-red-100 text-red-800 rounded-md mb-6">
            {error}
          </div>
        )}

        <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 px-4 md:px-6 mb-16">
          <Card className="w-full p-6 flex flex-col gap-4">
            <h2 className="text-xl font-semibold mb-4">Event Details</h2>
            <div className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter event name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter event description"
                        className="min-h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter event location" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP p")
                              ) : (
                                <span>Pick a date and time</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                            }
                            initialFocus
                          />
                          <div className="p-3 border-t">
                            <Input
                              type="time"
                              value={
                                field.value ? format(field.value, "HH:mm") : ""
                              }
                              onChange={(e) => {
                                const [hours, minutes] =
                                  e.target.value.split(":");
                                const newDate = field.value
                                  ? new Date(field.value)
                                  : new Date();
                                newDate.setHours(
                                  Number.parseInt(hours),
                                  Number.parseInt(minutes),
                                );
                                field.onChange(newDate);
                              }}
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>End Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP p")
                              ) : (
                                <span>Pick a date and time</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                            }
                            initialFocus
                          />
                          <div className="p-3 border-t">
                            <Input
                              type="time"
                              value={
                                field.value ? format(field.value, "HH:mm") : ""
                              }
                              onChange={(e) => {
                                const [hours, minutes] =
                                  e.target.value.split(":");
                                const newDate = field.value
                                  ? new Date(field.value)
                                  : new Date();
                                newDate.setHours(
                                  Number.parseInt(hours),
                                  Number.parseInt(minutes),
                                );
                                field.onChange(newDate);
                              }}
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isPrivate"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Private event</FormLabel>
                      <FormDescription>
                        Private events are hidden from the All Events tab.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </Card>

          <Card className="w-full p-6 flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Team Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <FormField
                control={form.control}
                name="minTeamSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Team Size *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number.parseInt(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxTeamSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Team Size *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={form.watch("minTeamSize")}
                        max={10}
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number.parseInt(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          <Card className="w-full p-6">
            <h2 className="text-xl font-semibold mb-4">GitHub Integration</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="githubOrg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 42-core-repos" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="githubOrgSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <div className="flex items-center gap-1">
                          <span>GitHub Organization Secret *</span>
                          <span
                            className="cursor-pointer hover:text-muted-foreground text-xs"
                            title="The token needs the following permissions: Administration (Repository creation, deletion, settings, teams, and collaborators) and Contents (Repository contents, commits, branches, downloads, releases, and merges)."
                          >
                            &#9432;
                          </span>
                        </div>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="github_pat_*"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Required permissions: Administration and Contents
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </Card>

          <Card className="w-full p-6">
            <h2 className="text-xl font-semibold mb-4">
              Version Configuration
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="monorepoUrl"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Monorepo URL *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://github.com/42core-team/monorepo"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        GitHub repository URL to fetch available tags
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="monorepoVersion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monorepo Version *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., dev, v0.0.0.1"
                          list="repo-tags"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {tagFetchError && (
                <div className="text-sm text-red-600">{tagFetchError}</div>
              )}
              {isLoadingTags && (
                <div className="text-xs text-muted-foreground">
                  Loading tags…
                </div>
              )}
            </div>

            <h3 className="text-lg font-semibold my-4">
              Docker Images Configuration
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <FormField
                    control={form.control}
                    name="gameServerDockerImage"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Game Server Image *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., ghcr.io/42core-team/server"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gameServerImageTag"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tag</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., dev, v0.0.0"
                            list="repo-tags"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <FormField
                    control={form.control}
                    name="myCoreBotDockerImage"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>My Core Bot Image *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., ghcr.io/42core-team/my-core-bot"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="myCoreBotImageTag"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tag</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., dev, v0.0.0"
                            list="repo-tags"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <FormField
                    control={form.control}
                    name="visualizerDockerImage"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Visualizer Image *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., ghcr.io/42core-team/visualizer"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="visualizerImageTag"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tag</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., dev, v0.0.0"
                            list="repo-tags"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <datalist id="repo-tags">
                {availableTags.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
            </div>
          </Card>

          <div className="flex justify-end space-x-4">
            <Button
              variant="destructive"
              type="button"
              onClick={() => router.push("/events")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
