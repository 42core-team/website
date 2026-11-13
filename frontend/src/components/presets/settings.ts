import { z } from 'zod'
import { githubConfigSchema } from '@/lib/github-validation'
import { getEventNameError } from '@/lib/event-validation'
import type { EventCreateParams } from '@/app/actions/event'
import type {
  EventSettings,
  PresetSettings,
  ResolvedPreset,
  Schedule,
  StarterTemplate,
} from '@/app/actions/presets'

export const nameSchema = z.string().superRefine((value, ctx) => {
  const message = getEventNameError(value.trim())
  if (message) ctx.addIssue({ code: 'custom', message })
})
const url = z.union([z.literal(''), z.url()]).optional()
export const settingsShape = {
  description: z.string().optional(),
  location: z.string().optional(),
  minTeamSize: z.number().min(1).max(10),
  maxTeamSize: z.number().min(1).max(10),
  gameServerDockerImage: z.string().min(1),
  myCoreBotDockerImage: z.string().min(1),
  visualizerDockerImage: z.string().min(1),
  monorepoUrl: githubConfigSchema('monorepoUrl'),
  monorepoVersion: githubConfigSchema('monorepoVersion'),
  basePath: githubConfigSchema('basePath'),
  gameConfig: z.string().min(1),
  serverConfig: z.string().min(1),
  introEnabled: z.boolean().optional(),
  introLeadMinutes: z.number().int().min(0).optional(),
  streamUrl: url,
  showtimeStreamUrl: url,
}
export const eventSettingsSchema = z
  .object({
    ...settingsShape,
    startDate: z.number(),
    submissionDeadline: z.number().optional(),
    scheduledEndDate: z.number().optional(),
    endDate: z.number().optional(),
  })
  .refine((v) => v.maxTeamSize >= v.minTeamSize, {
    message: 'Max team size must be at least the min team size',
    path: ['maxTeamSize'],
  })
  .refine(
    (v) =>
      v.submissionDeadline === undefined || v.submissionDeadline > v.startDate,
    {
      message: 'Submission deadline must be after play starts',
      path: ['submissionDeadline'],
    },
  )
export const scheduleSchema = z.object({
  startOffsetDays: z.number().int().min(0).max(365),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  submissionDeadlineAfterHours: z.number().min(0).optional(),
  scheduledEndAfterHours: z.number().min(0).optional(),
  endAfterHours: z.number().min(0).optional(),
})
export const presetSettingsSchema = z
  .object({ ...settingsShape, schedule: scheduleSchema })
  .refine((v) => v.maxTeamSize >= v.minTeamSize, {
    message: 'Max team size must be at least the min team size',
    path: ['maxTeamSize'],
  })
export const templatesSchema = z.array(
  z.object({
    name: z.string().min(1),
    basePath: githubConfigSchema('basePath'),
    myCoreBotDockerImage: z.string().min(1),
  }),
)
export const defaultSettings: PresetSettings = {
  description: '',
  location: '',
  minTeamSize: 1,
  maxTeamSize: 4,
  gameServerDockerImage: 'ghcr.io/42core-team/server:dev',
  myCoreBotDockerImage: 'ghcr.io/42core-team/my-core-bot:dev',
  visualizerDockerImage: 'ghcr.io/42core-team/visualizer:dev',
  monorepoUrl: 'https://github.com/42core-team/monorepo',
  monorepoVersion: 'dev',
  basePath: 'bots/c/bot',
  gameConfig: '{}',
  serverConfig: '{}',
  introEnabled: false,
  introLeadMinutes: 15,
  streamUrl: '',
  showtimeStreamUrl: '',
  schedule: {
    startOffsetDays: 1,
    startTime: '10:00',
    submissionDeadlineAfterHours: 1,
    scheduledEndAfterHours: 2,
  },
}
export function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
export interface CreateValues {
  settings: EventSettings
  starterTemplates: StarterTemplate[]
  githubInstallationId: string | null
}
export function resolvedValues(preset: ResolvedPreset): CreateValues {
  return {
    settings: preset.values,
    starterTemplates: preset.starterTemplates,
    githubInstallationId: preset.githubInstallation?.id ?? null,
  }
}
export function changedValues(current: CreateValues, baseline: CreateValues) {
  return (
    !same(current.settings, baseline.settings) ||
    !same(current.starterTemplates, baseline.starterTemplates) ||
    current.githubInstallationId !== baseline.githubInstallationId
  )
}
export function createPayload(
  name: string,
  preset: ResolvedPreset,
  current: CreateValues,
): EventCreateParams {
  const baseline = resolvedValues(preset)
  const overrides = Object.fromEntries(
    Object.entries(current.settings).filter(
      ([key, value]) =>
        !same(value, baseline.settings[key as keyof EventSettings]),
    ),
  )
  return {
    name: name.trim(),
    presetId: preset.presetId,
    ...overrides,
    ...(!same(current.starterTemplates, baseline.starterTemplates)
      ? { starterTemplates: current.starterTemplates }
      : {}),
    ...(current.githubInstallationId !== baseline.githubInstallationId
      ? { githubInstallationId: current.githubInstallationId }
      : {}),
  }
}
/** Preview only: creation uses the server's authoritative Europe/Berlin resolution. */
export function schedulePreview(schedule: Schedule, now = new Date()): Date {
  const parts = (date: Date) =>
    Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(date)
        .map((p) => [p.type, p.value]),
    )
  const today = parts(now)
  const [hour, minute] = schedule.startTime.split(':').map(Number)
  const target = Date.UTC(
    Number(today.year),
    Number(today.month) - 1,
    Number(today.day) + schedule.startOffsetDays,
    hour,
    minute,
  )
  const candidates = [1, 2].map((offset) => target - offset * 3600000)
  const wallTime = (epoch: number) => {
    const p = parts(new Date(epoch))
    return Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
    )
  }
  return new Date(
    candidates.filter((c) => wallTime(c) === target).sort((a, b) => a - b)[0] ??
      candidates[0],
  )
}
