import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { ArrowLeft, CalendarIcon } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import * as z from 'zod'
import type { EventCreateParams } from '@/app/actions/event'
import { canUserCreateEvent, createEvent } from '@/app/actions/event'
import Link from '@/components/app-link'
import {
  Button,
  Calendar,
  Card,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  Switch,
  Textarea,
} from '@/components/ui/themed'
import { useSession } from '@/lib/auth'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/events/create')({
  component: CreateEventRoute,
})

const formSchema = z
  .object({
    name: z.string().min(1, 'Event name is required'),
    description: z.string().optional(),
    githubOrg: z.string().min(1, 'GitHub organization is required'),
    githubOrgSecret: z
      .string()
      .min(1, 'GitHub organization secret is required'),
    location: z.string().optional(),
    startDate: z.date({ message: 'Start date is required' }),
    endDate: z.date({ message: 'End date is required' }),
    minTeamSize: z.number().min(1).max(10),
    maxTeamSize: z.number().min(1).max(10),
    monorepoUrl: z.string().min(1, 'Monorepo URL is required'),
    monorepoVersion: z.string().min(1, 'Monorepo version is required'),
    gameServerDockerImage: z.string().min(1, 'Game server image is required'),
    myCoreBotDockerImage: z.string().min(1, 'My Core Bot image is required'),
    visualizerDockerImage: z.string().min(1, 'Visualizer image is required'),
    gameServerImageTag: z.string().optional(),
    myCoreBotImageTag: z.string().optional(),
    visualizerImageTag: z.string().optional(),
    basePath: z.string().min(1, 'Base path is required'),
    gameConfig: z.string().min(1, 'Game config is required'),
    serverConfig: z.string().min(1, 'Server config is required'),
    isPrivate: z.boolean(),
  })
  .refine((value) => value.maxTeamSize >= value.minTeamSize, {
    message: 'Max team size must be at least the min team size',
    path: ['maxTeamSize'],
  })

type FormValues = z.infer<typeof formSchema>

const defaultValues: FormValues = {
  name: '',
  description: '',
  githubOrg: '',
  githubOrgSecret: '',
  location: '',
  startDate: new Date(),
  endDate: new Date(),
  minTeamSize: 1,
  maxTeamSize: 4,
  monorepoUrl: 'https://github.com/42core-team/monorepo',
  monorepoVersion: '',
  gameServerDockerImage: 'ghcr.io/42core-team/server',
  myCoreBotDockerImage: 'ghcr.io/42core-team/my-core-bot',
  visualizerDockerImage: 'ghcr.io/42core-team/visualizer',
  gameServerImageTag: '',
  myCoreBotImageTag: '',
  visualizerImageTag: '',
  basePath: 'bots/softcore',
  gameConfig: '',
  serverConfig: '',
  isPrivate: false,
}

function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
  try {
    const parsedUrl = new URL(url.trim())
    if (parsedUrl.hostname !== 'github.com') return null
    const parts = parsedUrl.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') }
  } catch {
    return null
  }
}

async function validateGithubToken(
  orgName: string,
  token: string,
): Promise<string | null> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  }

  try {
    const orgResponse = await fetch(`https://api.github.com/orgs/${orgName}`, {
      headers,
    })

    if (!orgResponse.ok) {
      const errorMessage = await getGitHubErrorMessage(
        orgResponse,
        `Failed to access GitHub organization: ${orgResponse.statusText}`,
      )
      if (orgResponse.status === 404) {
        return `Organization '${orgName}' not found or token has no access. ${errorMessage}`
      }
      return errorMessage
    }

    const reposResponse = await fetch(
      `https://api.github.com/orgs/${orgName}/repos?type=all`,
      { headers },
    )
    if (!reposResponse.ok) {
      return getGitHubErrorMessage(
        reposResponse,
        `Token lacks permission to list repositories in '${orgName}'. Required: 'repo' scope.`,
      )
    }

    const membersResponse = await fetch(
      `https://api.github.com/orgs/${orgName}/members`,
      { headers },
    )
    if (!membersResponse.ok) {
      return getGitHubErrorMessage(
        membersResponse,
        `Token lacks permission to list members in '${orgName}'. Required: 'admin:org' or 'read:org' scope.`,
      )
    }

    return null
  } catch {
    return 'An unexpected error occurred during GitHub token validation.'
  }
}

async function getGitHubErrorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string }
    if (body.message) return `GitHub API Error: ${body.message}`
  } catch {
    return fallback
  }
  return fallback
}

function combineImageAndTag(image: string, tag: string | undefined) {
  if (!image.trim() || !tag?.trim()) return image.trim()
  return `${image.trim()}:${tag.trim()}`
}

function getErrorMessage(error: unknown, fallback = 'Failed to create event.') {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function formatFieldErrors(errors: unknown[]) {
  return errors
    .map((error) =>
      typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : String(error),
    )
    .join(', ')
}

function CreateEventRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: session, status } = useSession()
  const [error, setError] = useState<string | null>(null)

  const canCreateQuery = useQuery({
    queryKey: ['events', 'can-create'],
    queryFn: canUserCreateEvent,
    enabled: Boolean(session?.user.id),
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      void navigate({ to: '/events', replace: true })
    }
    if (status === 'authenticated' && canCreateQuery.data === false) {
      void navigate({ to: '/events', replace: true })
    }
  }, [canCreateQuery.data, navigate, status])

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const gameServerDockerImage = combineImageAndTag(
        values.gameServerDockerImage,
        values.gameServerImageTag,
      )
      const myCoreBotDockerImage = combineImageAndTag(
        values.myCoreBotDockerImage,
        values.myCoreBotImageTag,
      )
      const visualizerDockerImage = combineImageAndTag(
        values.visualizerDockerImage,
        values.visualizerImageTag,
      )

      if (!gameServerDockerImage)
        throw new Error('Game Server image is required')
      if (!myCoreBotDockerImage)
        throw new Error('My Core Bot image is required')
      if (!visualizerDockerImage)
        throw new Error('Visualizer image is required')

      const validationError = await validateGithubToken(
        values.githubOrg,
        values.githubOrgSecret,
      )
      if (validationError) throw new Error(validationError)

      const payload: EventCreateParams = {
        name: values.name.trim(),
        description: values.description?.trim() || '',
        githubOrg: values.githubOrg,
        githubOrgSecret: values.githubOrgSecret,
        location: values.location?.trim() || '',
        startDate: values.startDate.getTime(),
        endDate: values.endDate.getTime(),
        minTeamSize: values.minTeamSize,
        maxTeamSize: values.maxTeamSize,
        monorepoUrl: values.monorepoUrl.trim(),
        monorepoVersion: values.monorepoVersion.trim(),
        gameServerDockerImage,
        myCoreBotDockerImage,
        visualizerDockerImage,
        basePath: values.basePath.trim(),
        gameConfig: values.gameConfig,
        serverConfig: values.serverConfig,
        isPrivate: values.isPrivate,
      }

      return createEvent(payload)
    },
    onSuccess: async (event) => {
      toast.success('Event created.')
      await queryClient.invalidateQueries({ queryKey: ['events'] })
      await navigate({ to: '/events/$id', params: { id: event.id } })
    },
    onError: (mutationError) => {
      setError(getErrorMessage(mutationError))
    },
  })

  const form = useForm({
    defaultValues,
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      setError(null)
      await createMutation.mutateAsync(value)
    },
  })

  const formValues = useStore(form.store, (state) => state.values)
  const parsedRepo = useMemo(
    () => parseGitHubRepo(formValues.monorepoUrl),
    [formValues.monorepoUrl],
  )

  const {
    data: availableTags = [],
    isLoading: isLoadingTags,
    error: tagFetchError,
  } = useQuery({
    queryKey: ['github', 'tags', parsedRepo?.owner, parsedRepo?.repo],
    queryFn: async () => {
      if (!parsedRepo) return []
      const response = await fetch(
        `https://api.github.com/repos/${parsedRepo.owner}/${parsedRepo.repo}/tags?per_page=100`,
        { headers: { Accept: 'application/vnd.github+json' } },
      )
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string
        }
        throw new Error(
          body.message || `Failed to fetch tags (${response.status})`,
        )
      }
      const data = (await response.json()) as Array<{ name: string }>
      return Array.from(new Set(data.map((tag) => tag.name)))
    },
    enabled: Boolean(parsedRepo),
  })

  const { isLoading: isFetchingConfig } = useQuery({
    queryKey: [
      'github',
      'config',
      parsedRepo?.owner,
      parsedRepo?.repo,
      formValues.monorepoVersion,
      formValues.basePath,
    ],
    queryFn: async () => {
      if (!parsedRepo || !formValues.monorepoVersion || !formValues.basePath) {
        return null
      }

      const [gameResponse, serverResponse] = await Promise.all([
        fetch(
          `https://raw.githubusercontent.com/${parsedRepo.owner}/${parsedRepo.repo}/${formValues.monorepoVersion}/${formValues.basePath}/configs/game.config.json`,
        ),
        fetch(
          `https://raw.githubusercontent.com/${parsedRepo.owner}/${parsedRepo.repo}/${formValues.monorepoVersion}/${formValues.basePath}/configs/server.config.json`,
        ),
      ])

      if (gameResponse.ok) {
        form.setFieldValue('gameConfig', await gameResponse.text())
      }
      if (serverResponse.ok) {
        form.setFieldValue('serverConfig', await serverResponse.text())
      }

      return true
    },
    enabled:
      Boolean(parsedRepo) &&
      Boolean(formValues.monorepoVersion) &&
      Boolean(formValues.basePath),
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.stopPropagation()
    void form.handleSubmit()
  }

  function ImageFields({
    imageLabel,
    imageName,
    imagePlaceholder,
    tagName,
  }: {
    imageLabel: string
    imageName: ImageFieldName
    imagePlaceholder: string
    tagName: ImageTagName
  }) {
    return (
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
        <form.Field
          name={imageName}
          children={(field) => (
            <TextField
              className="md:col-span-2"
              errors={field.state.meta.errors}
              label={imageLabel}
            >
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder={imagePlaceholder}
              />
            </TextField>
          )}
        />
        <form.Field
          name={tagName}
          children={(field) => (
            <TextField errors={field.state.meta.errors} label="Tag">
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="e.g., dev, v0.0.0"
                list="repo-tags"
              />
            </TextField>
          )}
        />
      </div>
    )
  }

  if (
    status === 'loading' ||
    (session?.user.id && canCreateQuery.isPending) ||
    status === 'unauthenticated' ||
    canCreateQuery.data === false
  ) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </main>
    )
  }

  return (
    <main className="container mx-auto min-h-lvh max-w-3xl py-3">
      <div className="mb-8 flex flex-col items-center justify-center gap-4 py-8 md:py-6">
        <h1 className="text-4xl font-bold">Create New Event</h1>
        <Button asChild variant="outline">
          <Link href="/events">
            <ArrowLeft />
            Events
          </Link>
        </Button>
      </div>

      <form
        onSubmit={submit}
        className="w-full items-center justify-center space-y-4"
      >
        {error && (
          <div className="mb-6 rounded-md bg-red-100 p-3 text-red-800">
            {error}
          </div>
        )}

        <div className="mx-auto mb-16 flex w-full max-w-4xl flex-col gap-8 px-4 md:px-6">
          <Card className="flex w-full flex-col gap-4 p-6">
            <h2 className="mb-4 text-xl font-semibold">Event Details</h2>
            <div className="flex flex-col gap-4">
              <form.Field
                name="name"
                children={(field) => (
                  <TextField
                    errors={field.state.meta.errors}
                    label="Event Name *"
                  >
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="Enter event name"
                    />
                  </TextField>
                )}
              />

              <form.Field
                name="description"
                children={(field) => (
                  <TextField
                    errors={field.state.meta.errors}
                    label="Description"
                  >
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="Enter event description"
                      className="min-h-24"
                    />
                  </TextField>
                )}
              />

              <form.Field
                name="location"
                children={(field) => (
                  <TextField errors={field.state.meta.errors} label="Location">
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="Enter event location"
                    />
                  </TextField>
                )}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form.Field
                  name="startDate"
                  children={(field) => (
                    <DateTimeField
                      errors={field.state.meta.errors}
                      label="Start Date *"
                      value={field.state.value}
                      onChange={field.handleChange}
                    />
                  )}
                />

                <form.Field
                  name="endDate"
                  children={(field) => (
                    <DateTimeField
                      errors={field.state.meta.errors}
                      label="End Date *"
                      value={field.state.value}
                      onChange={field.handleChange}
                    />
                  )}
                />
              </div>

              <form.Field
                name="isPrivate"
                children={(field) => (
                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Private event</Label>
                      <p className="text-sm text-muted-foreground">
                        Private events are hidden from the All Events tab.
                      </p>
                    </div>
                    <Switch
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                    />
                  </div>
                )}
              />
            </div>
          </Card>

          <Card className="flex w-full flex-col gap-4 p-6">
            <h2 className="text-xl font-semibold">Team Settings</h2>
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
              <form.Field
                name="minTeamSize"
                children={(field) => (
                  <TextField
                    errors={field.state.meta.errors}
                    label="Min Team Size *"
                  >
                    <Input
                      id={field.name}
                      name={field.name}
                      type="number"
                      min={1}
                      max={10}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(Number.parseInt(event.target.value))
                      }
                    />
                  </TextField>
                )}
              />

              <form.Field
                name="maxTeamSize"
                children={(field) => (
                  <TextField
                    errors={field.state.meta.errors}
                    label="Max Team Size *"
                  >
                    <Input
                      id={field.name}
                      name={field.name}
                      type="number"
                      min={formValues.minTeamSize}
                      max={10}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(Number.parseInt(event.target.value))
                      }
                    />
                  </TextField>
                )}
              />
            </div>
          </Card>

          <Card className="w-full p-6">
            <h2 className="mb-4 text-xl font-semibold">GitHub Integration</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <form.Field
                name="githubOrg"
                children={(field) => (
                  <TextField
                    errors={field.state.meta.errors}
                    label="Organization Name *"
                  >
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="e.g. 42-core-repos"
                    />
                  </TextField>
                )}
              />

              <form.Field
                name="githubOrgSecret"
                children={(field) => (
                  <TextField
                    description="Required permissions: Administration and Contents"
                    errors={field.state.meta.errors}
                    label="GitHub Organization Secret *"
                  >
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="github_pat_*"
                      title="The token needs Administration and Contents permissions."
                    />
                  </TextField>
                )}
              />
            </div>
          </Card>

          <Card className="w-full p-6">
            <h2 className="mb-4 text-xl font-semibold">
              Version Configuration
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
                <form.Field
                  name="monorepoUrl"
                  children={(field) => (
                    <TextField
                      className="md:col-span-2"
                      description="GitHub repository URL to fetch available tags"
                      errors={field.state.meta.errors}
                      label="Monorepo URL *"
                    >
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="https://github.com/42core-team/monorepo"
                      />
                    </TextField>
                  )}
                />

                <form.Field
                  name="monorepoVersion"
                  children={(field) => (
                    <TextField
                      errors={field.state.meta.errors}
                      label="Monorepo Version *"
                    >
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="e.g., dev, v0.0.0.1"
                        list="repo-tags"
                      />
                    </TextField>
                  )}
                />
              </div>

              <form.Field
                name="basePath"
                children={(field) => (
                  <TextField
                    description="Path in the monorepo where the game logic is located (e.g., bots/softcore)"
                    errors={field.state.meta.errors}
                    label="Base Path *"
                  >
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="bots/softcore"
                    />
                  </TextField>
                )}
              />

              <form.Field
                name="gameConfig"
                children={(field) => (
                  <TextField
                    description="Configuration for the game server. Will be auto-filled if found in the monorepo."
                    errors={field.state.meta.errors}
                    label="Game Configuration (JSON) *"
                  >
                    <ConfigTextarea
                      isFetchingConfig={isFetchingConfig}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={field.handleChange}
                      placeholder='{ "rounds": 100, ... }'
                    />
                  </TextField>
                )}
              />

              <form.Field
                name="serverConfig"
                children={(field) => (
                  <TextField
                    description="ServerConfig. Will be auto-filled if found in the monorepo."
                    errors={field.state.meta.errors}
                    label="Server Configuration (JSON) *"
                  >
                    <ConfigTextarea
                      isFetchingConfig={isFetchingConfig}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={field.handleChange}
                      placeholder={`{
  "replayFolderPaths": [
    "/workspace/replays",
    "/workspaces/monorepo",
    "/workspaces/monorepo/visualizer/public/replays",
    "./replays"
  ],
  "timeoutTicks": 30000,
  ...`}
                    />
                  </TextField>
                )}
              />

              {tagFetchError && (
                <div className="text-sm text-red-600">
                  {getErrorMessage(tagFetchError, 'Failed to fetch tags.')}
                </div>
              )}
              {isLoadingTags && (
                <div className="text-xs text-muted-foreground">
                  Loading tags...
                </div>
              )}
            </div>

            <h3 className="my-4 text-lg font-semibold">
              Docker Images Configuration
            </h3>
            <div className="space-y-4">
              <ImageFields
                imageName="gameServerDockerImage"
                tagName="gameServerImageTag"
                imageLabel="Game Server Image *"
                imagePlaceholder="e.g., ghcr.io/42core-team/server"
              />
              <ImageFields
                imageName="myCoreBotDockerImage"
                tagName="myCoreBotImageTag"
                imageLabel="My Core Bot Image *"
                imagePlaceholder="e.g., ghcr.io/42core-team/my-core-bot"
              />
              <ImageFields
                imageName="visualizerDockerImage"
                tagName="visualizerImageTag"
                imageLabel="Visualizer Image *"
                imagePlaceholder="e.g., ghcr.io/42core-team/visualizer"
              />

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
              onClick={() => void navigate({ to: '/events' })}
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={
                    !canSubmit || isSubmitting || createMutation.isPending
                  }
                >
                  {createMutation.isPending || isSubmitting
                    ? 'Creating...'
                    : 'Create Event'}
                </Button>
              )}
            />
          </div>
        </div>
      </form>
    </main>
  )
}

function DateTimeField({
  errors,
  label,
  onChange,
  value,
}: {
  errors: unknown[]
  label: string
  onChange: (value: Date) => void
  value: Date
}) {
  return (
    <TextField errors={errors} label={label}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full pl-3 text-left font-normal"
          >
            {format(value, 'PPP p')}
            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              if (!date) return
              const nextDate = new Date(date)
              nextDate.setHours(value.getHours(), value.getMinutes())
              onChange(nextDate)
            }}
            disabled={(date) =>
              date < new Date(new Date().setHours(0, 0, 0, 0))
            }
            autoFocus
          />
          <div className="border-t p-3">
            <Input
              type="time"
              value={format(value, 'HH:mm')}
              onChange={(event) => {
                const [hours, minutes] = event.target.value.split(':')
                const nextDate = new Date(value)
                nextDate.setHours(Number(hours), Number(minutes))
                onChange(nextDate)
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </TextField>
  )
}

function ConfigTextarea({
  isFetchingConfig,
  name,
  onBlur,
  onChange,
  placeholder,
  value,
}: {
  isFetchingConfig: boolean
  name: string
  onBlur: () => void
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <div className="relative">
      <Textarea
        id={name}
        name={name}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-50 font-mono text-sm"
      />
      {isFetchingConfig && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <span className="text-xs font-medium">
            Fetching default configs...
          </span>
        </div>
      )}
    </div>
  )
}

type ImageFieldName =
  'gameServerDockerImage' | 'myCoreBotDockerImage' | 'visualizerDockerImage'
type ImageTagName =
  'gameServerImageTag' | 'myCoreBotImageTag' | 'visualizerImageTag'

function TextField({
  children,
  className,
  description,
  errors,
  label,
}: {
  children: ReactNode
  className?: string
  description?: string
  errors: unknown[]
  label: string
}) {
  const hasErrors = errors.length > 0

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      {children}
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {hasErrors && (
        <p className="text-sm font-medium text-destructive">
          {formatFieldErrors(errors)}
        </p>
      )}
    </div>
  )
}
