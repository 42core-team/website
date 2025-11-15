"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Textarea, Card, Tooltip, Form, DateInput } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import { createEvent } from "@/app/actions/event";
import { isActionError } from "@/app/actions/errors";

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
      } catch (jsonError) {
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
      } catch (jsonError) {
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
      } catch (jsonError) {
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

function combineImageAndTag(
  image: string | undefined,
  tag: string | undefined,
): string | undefined {
  if (!image?.trim() || !tag?.trim()) {
    return image || undefined;
  }
  return `${image.trim()}:${tag.trim()}`;
}

export default function CreateEventForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [githubOrg, setGithubOrg] = useState("");
  const [githubOrgSecret, setGithubOrgSecret] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [minTeamSize, setMinTeamSize] = useState(1);
  const [maxTeamSize, setMaxTeamSize] = useState(4);
  const [monorepoVersion, setMonorepoVersion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monorepoUrl, setMonorepoUrl] = useState(
    "https://github.com/42core-team/monorepo",
  );
  const [gameServerDockerImage, setGameServerDockerImage] = useState(
    "ghcr.io/42core-team/server",
  );
  const [myCoreBotDockerImage, setMyCoreBotDockerImage] = useState(
    "ghcr.io/42core-team/my-core-bot",
  );
  const [visualizerDockerImage, setVisualizerDockerImage] = useState(
    "ghcr.io/42core-team/visualizer",
  );
  const [gameServerImageTag, setGameServerImageTag] = useState("");
  const [myCoreBotImageTag, setMyCoreBotImageTag] = useState("");
  const [visualizerImageTag, setVisualizerImageTag] = useState("");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [tagFetchError, setTagFetchError] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);

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

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const monorepoUrlString = monorepoUrl.trim();
    const monorepoVersionString = monorepoVersion.trim();
    const gameServerDockerImageString = combineImageAndTag(
      gameServerDockerImage,
      gameServerImageTag,
    );
    const myCoreBotDockerImageString = combineImageAndTag(
      myCoreBotDockerImage,
      myCoreBotImageTag,
    );
    const visualizerDockerImageString = combineImageAndTag(
      visualizerDockerImage,
      visualizerImageTag,
    );

    if (!startDate) return setError("Start Date is required");
    if (!endDate) return setError("End Date is required");
    if (!monorepoUrlString) return setError("Monorepo URL is required");
    if (!monorepoVersionString) return setError("Monorepo Version is required");
    if (!gameServerDockerImageString)
      return setError("Game Server image is required");
    if (!myCoreBotDockerImageString)
      return setError("My Core Bot image is required");
    if (!visualizerDockerImageString)
      return setError("Visualizer image is required");

    const validationError = await validateGithubToken(
      githubOrg,
      githubOrgSecret,
    );
    if (validationError) {
      setError(validationError);
      setIsLoading(false);
      return;
    }

    const result = await createEvent({
      name: name.trim(),
      description: description.trim(),
      githubOrg,
      githubOrgSecret,
      location: location.trim(),
      startDate: startDate.getTime(),
      endDate: endDate.getTime(),
      minTeamSize,
      maxTeamSize,
      monorepoUrl: monorepoUrlString,
      monorepoVersion: monorepoVersionString,
      gameServerDockerImage: gameServerDockerImageString,
      myCoreBotDockerImage: myCoreBotDockerImageString,
      visualizerDockerImage: visualizerDockerImageString,
      isPrivate: isPrivate,
    });

    if (isActionError(result)) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    router.push(`/events/${result.id}`);
  };

  return (
    <Form
      className="w-full justify-center items-center space-y-4"
      onSubmit={onSubmit}
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
            <Input
              isRequired
              label="Event Name"
              labelPlacement="outside"
              placeholder="Enter event name"
              value={name}
              onValueChange={(v) => setName(v)}
            />

            <Textarea
              label="Description"
              labelPlacement="outside"
              placeholder="Enter event description"
              minRows={3}
              value={description}
              onValueChange={(v) => setDescription(v)}
            />

            <Input
              label="Location"
              labelPlacement="outside"
              placeholder="Enter event location"
              value={location}
              onValueChange={(v) => setLocation(v)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DateInput
                isRequired
                granularity="minute"
                label="Start Date"
                labelPlacement="outside"
                hourCycle={24}
                onChange={(date) =>
                  setStartDate(date ? new Date(date.toString()) : undefined)
                }
              />
              <DateInput
                isRequired
                granularity="minute"
                label="End Date"
                labelPlacement="outside"
                hourCycle={24}
                onChange={(date) =>
                  setEndDate(date ? new Date(date.toString()) : undefined)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Private event</p>
                <p className="text-xs text-muted-foreground">
                  Private events are hidden from the All Events tab.
                </p>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate}>
                {isPrivate ? "Private" : "Public"}
              </Switch>
            </div>
          </div>
        </Card>

        <Card className="w-full p-6 flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Team Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <Input
              isRequired
              type="number"
              min={1}
              max={10}
              label="Min Team Size"
              labelPlacement="outside"
              className="w-full"
              value={minTeamSize.toString()}
              onValueChange={(v) => setMinTeamSize(parseInt(v || "1", 10))}
            />
            <Input
              isRequired
              type="number"
              min={minTeamSize}
              max={10}
              label="Max Team Size"
              labelPlacement="outside"
              className="w-full"
              value={maxTeamSize.toString()}
              onValueChange={(v) => setMaxTeamSize(parseInt(v || "1", 10))}
            />
          </div>
        </Card>

        <Card className="w-full p-6">
          <h2 className="text-xl font-semibold mb-4">GitHub Integration</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                isRequired
                label="Organization Name"
                labelPlacement="outside"
                placeholder="e.g. 42-core-repos"
                value={githubOrg}
                onValueChange={(v) => setGithubOrg(v.trim())}
              />
              <Input
                isRequired
                type="password"
                label={
                  <div className="flex items-center gap-1">
                    <span>GitHub Organization Secret</span>
                    <Tooltip
                      content={
                        <div className="text-xs text-muted-foreground p-2 max-w-xs">
                          The token needs the following permissions:
                          <ul className="list-disc list-inside ml-4">
                            <li>
                              <b>Administration:</b> Repository creation,
                              deletion, settings, teams, and collaborators.
                            </li>
                            <li>
                              <b>Contents:</b> Repository contents, commits,
                              branches, downloads, releases, and merges.
                            </li>
                          </ul>
                        </div>
                      }
                    >
                      <span className="cursor-pointer text-default-400 hover:text-default-600">
                        &#9432;
                      </span>
                    </Tooltip>
                  </div>
                }
                labelPlacement="outside"
                placeholder="github_pat_*"
                value={githubOrgSecret}
                onValueChange={(v) => setGithubOrgSecret(v.trim())}
              />
            </div>
          </div>
        </Card>

        <Card className="w-full p-6">
          <h2 className="text-xl font-semibold mb-4">Version Configuration</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <Input
                label="Monorepo URL"
                labelPlacement="outside"
                placeholder="https://github.com/42core-team/monorepo"
                value={monorepoUrl}
                onValueChange={(v) => setMonorepoUrl(v.trim())}
                description="GitHub repository URL to fetch available tags"
                className="md:col-span-2"
              />
              <Input
                label="Monorepo Version"
                labelPlacement="outside"
                placeholder="e.g., dev, v0.0.0.1, not v0.0.0"
                value={monorepoVersion}
                onValueChange={setMonorepoVersion}
                list="repo-tags"
              />
            </div>

            {tagFetchError && (
              <div className="text-sm text-danger">{tagFetchError}</div>
            )}
            {isLoadingTags && (
              <div className="text-xs text-muted-foreground">Loading tags…</div>
            )}
          </div>

          <h3 className="text-lg font-semibold my-4">
            Docker Images Configuration
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Game Server image + tag */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <Input
                  label="Game Server Image"
                  labelPlacement="outside"
                  placeholder="e.g., ghcr.io/42core-team/server"
                  value={gameServerDockerImage}
                  onValueChange={(v) => setGameServerDockerImage(v.trim())}
                  className="md:col-span-2"
                />
                <Input
                  label="Tag"
                  labelPlacement="outside"
                  placeholder="e.g., dev, v0.0.0, v0.0.0.1"
                  value={gameServerImageTag}
                  onValueChange={setGameServerImageTag}
                  list="repo-tags"
                />
              </div>

              {/* My Core Bot image + tag */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <Input
                  label="My Core Bot Image"
                  labelPlacement="outside"
                  placeholder="e.g., ghcr.io/42core-team/my-core-bot"
                  value={myCoreBotDockerImage}
                  onValueChange={(v) => setMyCoreBotDockerImage(v.trim())}
                  className="md:col-span-2"
                />
                <Input
                  label="Tag"
                  labelPlacement="outside"
                  placeholder="e.g., dev, v0.0.0, v0.0.0.1"
                  value={myCoreBotImageTag}
                  onValueChange={setMyCoreBotImageTag}
                  list="repo-tags"
                />
              </div>

              {/* Visualizer image + tag */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <Input
                  label="Visualizer Image"
                  labelPlacement="outside"
                  placeholder="e.g., ghcr.io/42core-team/visualizer"
                  value={visualizerDockerImage}
                  onValueChange={(v) => setVisualizerDockerImage(v.trim())}
                  className="md:col-span-2"
                />
                <Input
                  label="Tag"
                  labelPlacement="outside"
                  placeholder="e.g., dev, v0.0.0, v0.0.0.1"
                  value={visualizerImageTag}
                  onValueChange={setVisualizerImageTag}
                  list="repo-tags"
                />
              </div>
            </div>

            {/* Datalist provides dropdown suggestions while still allowing free text */}
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
          <Button
            type="submit"
            color="primary"
            //TODO:  isLoading={isLoading}
          >
            Create Event
          </Button>
        </div>
      </div>
    </Form>
  );
}
