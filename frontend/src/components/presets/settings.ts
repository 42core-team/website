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
// Optional fields can come back as null from the resolved preset.
const url = z.union([z.literal(''), z.url()]).nullish()
export const settingsShape = {
  description: z.string().nullish(),
  location: z.string().nullish(),
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
  introEnabled: z.boolean().nullish(),
  introLeadMinutes: z.number().int().min(0).nullish(),
  streamUrl: url,
  showtimeStreamUrl: url,
}
export const eventSettingsSchema = z
  .object({
    ...settingsShape,
    startDate: z.number(),
    submissionDeadline: z.number().nullish(),
    scheduledEndDate: z.number().nullish(),
    endDate: z.number().nullish(),
  })
  .refine((v) => v.maxTeamSize >= v.minTeamSize, {
    message: 'Max team size must be at least the min team size',
    path: ['maxTeamSize'],
  })
  .refine(
    (v) => v.submissionDeadline == null || v.submissionDeadline > v.startDate,
    {
      message: 'Submission deadline must be after play starts',
      path: ['submissionDeadline'],
    },
  )
// The API caps each offset at a leap year of hours.
const afterHours = z
  .number()
  .min(0)
  .max(366 * 24)
  .optional()
/** Enough of a schedule to preview its start. */
export const scheduleStartSchema = z.object({
  startOffsetDays: z.number().int().min(0).max(365),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
})
export const scheduleSchema = scheduleStartSchema
  .extend({
    submissionDeadlineAfterHours: afterHours,
    scheduledEndAfterHours: afterHours,
    endAfterHours: afterHours,
  })
  // A missing deadline falls back to the end, then to one hour, as in the API.
  .refine((v) => (v.submissionDeadlineAfterHours ?? v.endAfterHours ?? 1) > 0, {
    message: 'The submission deadline must be after the start',
    path: ['submissionDeadlineAfterHours'],
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
const FOLLOWING_DATES = [
  'submissionDeadline',
  'scheduledEndDate',
  'endDate',
] as const
/**
 * The preset's values with its later dates moved as far as `startDate`
 * moved from the preset's start, as the API moves dates a request omits.
 */
export function followStart(
  baseline: EventSettings,
  startDate: number,
): EventSettings {
  const delta = startDate - baseline.startDate
  if (!Number.isFinite(delta) || delta === 0) return baseline
  const moved = { ...baseline }
  for (const key of FOLLOWING_DATES) {
    const date = baseline[key]
    if (date != null) moved[key] = date + delta
  }
  return moved
}
/** Applies a settings edit; dates that still follow the start move with it. */
export function moveWithStart(
  previous: EventSettings,
  next: EventSettings,
  baseline: EventSettings,
): EventSettings {
  if (same(previous.startDate, next.startDate)) return next
  const before = followStart(baseline, previous.startDate)
  const after = followStart(baseline, next.startDate)
  const moved = { ...next }
  for (const key of FOLLOWING_DATES)
    if (same(next[key], before[key])) moved[key] = after[key]
  return moved
}
export function createPayload(
  name: string,
  preset: ResolvedPreset,
  current: CreateValues,
): EventCreateParams {
  const baseline = resolvedValues(preset)
  // Dates that only followed a moved start are left to the API to move.
  const settings = followStart(baseline.settings, current.settings.startDate)
  const overrides = Object.fromEntries(
    Object.entries(current.settings).filter(
      ([key, value]) => !same(value, settings[key as keyof EventSettings]),
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
