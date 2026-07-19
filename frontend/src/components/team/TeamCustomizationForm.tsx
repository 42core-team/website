import type { Team, TeamAssetType } from '@/app/actions/team'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImageIcon, Music, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import axios from 'axios'
import { updateTeamCustomization, uploadTeamAsset } from '@/app/actions/team'
import { myTeamQueryKey } from '@/app/events/my-team-queries'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface TeamCustomizationFormProps {
  eventId: string
  team: Team
}

export default function TeamCustomizationForm({
  eventId,
  team,
}: Readonly<TeamCustomizationFormProps>) {
  const queryClient = useQueryClient()
  const [description, setDescription] = useState(team.description)

  useEffect(() => {
    setDescription(team.description)
  }, [team.description])

  const invalidateTeamQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: myTeamQueryKey(eventId) }),
      queryClient.invalidateQueries({ queryKey: ['team', team.id] }),
      queryClient.invalidateQueries({
        queryKey: ['event', eventId, 'teams'],
      }),
    ])
  }

  const descriptionMutation = useMutation({
    mutationFn: () => updateTeamCustomization(eventId, description),
    onSuccess: async () => {
      toast.success('Team description updated.')
      await invalidateTeamQueries()
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })

  const assetMutation = useMutation({
    mutationFn: ({
      assetType,
      file,
    }: {
      assetType: TeamAssetType
      file: File
    }) => uploadTeamAsset(eventId, assetType, file),
    onSuccess: async (_, variables) => {
      toast.success(`${getAssetLabel(variables.assetType)} updated.`)
      await invalidateTeamQueries()
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })

  const uploadAsset = async (assetType: TeamAssetType, file: File) => {
    await assetMutation.mutateAsync({ assetType, file })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Profile</CardTitle>
        <CardDescription>
          Customize how your team appears to other participants.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-2">
          <Label htmlFor="team-description">Description</Label>
          <Textarea
            id="team-description"
            maxLength={1000}
            rows={5}
            placeholder="Tell everyone what makes your team special..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">
              {description.length} / 1000
            </span>
            <Button
              disabled={
                description === team.description ||
                descriptionMutation.isPending
              }
              onClick={() => descriptionMutation.mutate()}
            >
              Save Description
            </Button>
          </div>
        </div>

        <div className="grid gap-6 border-t pt-6 lg:grid-cols-2">
          <AssetUploadField
            assetType="profile-image"
            accept="image/jpeg,image/png,image/webp"
            currentUrl={team.profileImageUrl}
            description="JPEG, PNG, or WebP. Maximum 2 MB."
            isUploading={assetMutation.isPending}
            label="Profile Image"
            onUpload={uploadAsset}
          />
          <AssetUploadField
            assetType="banner-image"
            accept="image/jpeg,image/png,image/webp"
            currentUrl={team.bannerImageUrl}
            description="JPEG, PNG, or WebP. Maximum 5 MB."
            isUploading={assetMutation.isPending}
            label="Banner Image"
            onUpload={uploadAsset}
          />
          <AssetUploadField
            assetType="winning-sound"
            accept="audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/webm"
            className="lg:col-span-2"
            currentUrl={team.winningSoundUrl}
            description="MP3, WAV, Ogg, or WebM. Maximum 10 MB."
            isUploading={assetMutation.isPending}
            label="Winning Sound"
            onUpload={uploadAsset}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function AssetUploadField({
  assetType,
  label,
  description,
  accept,
  currentUrl,
  className,
  isUploading,
  onUpload,
}: {
  assetType: TeamAssetType
  label: string
  description: string
  accept: string
  currentUrl: string | null
  className?: string
  isUploading: boolean
  onUpload: (assetType: TeamAssetType, file: File) => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)

  const handleUpload = async () => {
    if (!file) return
    await onUpload(assetType, file)
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className={className}>
      <div className="space-y-4 rounded-lg border p-4">
        <div>
          <Label htmlFor={`team-${assetType}`}>{label}</Label>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>

        <AssetPreview assetType={assetType} label={label} url={currentUrl} />

        <Input
          ref={inputRef}
          id={`team-${assetType}`}
          type="file"
          accept={accept}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!file || isUploading}
          onClick={handleUpload}
        >
          <Upload />
          {isUploading ? 'Uploading...' : `Upload ${label}`}
        </Button>
      </div>
    </div>
  )
}

function AssetPreview({
  assetType,
  url,
  label,
}: {
  assetType: TeamAssetType
  url: string | null
  label: string
}) {
  if (!url) {
    return (
      <div className="flex min-h-24 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {assetType === 'winning-sound' ? <Music /> : <ImageIcon />}
        <span className="ml-2 text-sm">No {label.toLowerCase()} uploaded</span>
      </div>
    )
  }

  if (assetType === 'winning-sound') {
    return <audio className="w-full" controls preload="none" src={url} />
  }

  return (
    <img
      className={
        assetType === 'profile-image'
          ? 'size-28 rounded-full border object-cover'
          : 'h-36 w-full rounded-md border object-cover'
      }
      src={url}
      alt={`Current ${label.toLowerCase()}`}
    />
  )
}

function getAssetLabel(assetType: TeamAssetType) {
  switch (assetType) {
    case 'profile-image':
      return 'Profile image'
    case 'banner-image':
      return 'Banner image'
    case 'winning-sound':
      return 'Winning sound'
  }
}

function getErrorMessage(error: Error) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return (
      error.response?.data.message ||
      error.message ||
      'Failed to update the team profile.'
    )
  }
  return error.message || 'Failed to update the team profile.'
}
