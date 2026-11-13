import { isAxiosError } from 'axios'
import axiosInstance from '@/app/actions/axios'

export interface EventSettings {
  description?: string
  location?: string
  startDate: number
  submissionDeadline?: number
  scheduledEndDate?: number
  endDate?: number
  minTeamSize: number
  maxTeamSize: number
  gameServerDockerImage: string
  myCoreBotDockerImage: string
  visualizerDockerImage: string
  monorepoUrl: string
  monorepoVersion: string
  basePath: string
  gameConfig: string
  serverConfig: string
  introEnabled?: boolean
  introLeadMinutes?: number
  streamUrl?: string
  showtimeStreamUrl?: string
}
export interface Schedule {
  startOffsetDays: number
  startTime: string
  submissionDeadlineAfterHours?: number
  scheduledEndAfterHours?: number
  endAfterHours?: number
}
export type PresetSettings = Omit<
  EventSettings,
  'startDate' | 'submissionDeadline' | 'scheduledEndDate' | 'endDate'
> & { schedule: Schedule }
export interface StarterTemplate {
  name: string
  basePath: string
  myCoreBotDockerImage: string
}
export interface InstallationRef {
  id: string
  accountLogin: string
}
export interface PresetSummary {
  id: string
  name: string
  description: string | null
  isDefault: boolean
  version: number
  updatedAt: string
}
export interface AdminPresetSummary extends PresetSummary {
  archivedAt: string | null
  updatedBy: { id: string; username: string } | null
  eventCount: number
}
export interface PresetDetail extends PresetSummary {
  archivedAt: string | null
  settings: PresetSettings
  starterTemplates: StarterTemplate[]
  githubInstallation: InstallationRef | null
  createdAt: string
}
export interface ResolvedPreset {
  presetId: string
  presetVersion: number
  values: EventSettings
  starterTemplates: StarterTemplate[]
  githubInstallation: InstallationRef | null
}
export interface PresetInput {
  name: string
  description?: string | null
  isDefault?: boolean
  settings: PresetSettings
  starterTemplates?: StarterTemplate[]
  githubInstallationId?: string | null
}
/** id is the installation entity UUID; installationId in older event routes is GitHub's numeric ID. */
export interface AdminInstallation extends InstallationRef {
  accountType: string
  sharedAt: string | null
  sharedBy: { id: string; username: string } | null
  eventCount: number
}
export interface CreateInstallation extends InstallationRef {
  accountType: string
  shared: boolean
}
const presetPath = (id: string) =>
  `/admin/event-presets/${encodeURIComponent(id)}`
export async function getPresets() {
  return (await axiosInstance.get<PresetSummary[]>('/event-presets')).data
}
export async function resolvePreset(id: string) {
  return (
    await axiosInstance.get<ResolvedPreset>(
      `/event-presets/${encodeURIComponent(id)}/resolved`,
    )
  ).data
}
export async function getAdminPresets(includeArchived = false) {
  return (
    await axiosInstance.get<AdminPresetSummary[]>('/admin/event-presets', {
      params: { includeArchived },
    })
  ).data
}
export async function getAdminPreset(id: string) {
  return (await axiosInstance.get<PresetDetail>(presetPath(id))).data
}
export async function createPreset(input: PresetInput) {
  return (await axiosInstance.post<PresetDetail>('/admin/event-presets', input))
    .data
}
export async function updatePreset(
  id: string,
  input: PresetInput & { version: number },
) {
  return (await axiosInstance.put<PresetDetail>(presetPath(id), input)).data
}
export async function setDefaultPreset(id: string) {
  return (await axiosInstance.post<PresetDetail>(`${presetPath(id)}/default`))
    .data
}
export async function duplicatePreset(id: string) {
  return (await axiosInstance.post<PresetDetail>(`${presetPath(id)}/duplicate`))
    .data
}
export async function archivePreset(id: string) {
  return (await axiosInstance.post<PresetDetail>(`${presetPath(id)}/archive`))
    .data
}
export async function unarchivePreset(id: string) {
  return (await axiosInstance.post<PresetDetail>(`${presetPath(id)}/unarchive`))
    .data
}
export async function getAdminInstallations() {
  return (
    await axiosInstance.get<AdminInstallation[]>('/admin/github-installations')
  ).data
}
export async function shareInstallation(id: string) {
  return (
    await axiosInstance.post<AdminInstallation>(
      `/admin/github-installations/${encodeURIComponent(id)}/share`,
    )
  ).data
}
export async function unshareInstallation(id: string) {
  await axiosInstance.delete(
    `/admin/github-installations/${encodeURIComponent(id)}/share`,
  )
}
// The existing event-scoped listing cannot be used before an event exists.
export async function getCreateInstallations() {
  return (
    await axiosInstance.get<CreateInstallation[]>('/github/installations')
  ).data
}
export function presetError(error: unknown) {
  if (isAxiosError(error)) {
    const message: unknown = error.response?.data?.message
    if (typeof message === 'string') return message
    if (Array.isArray(message)) return message.join(', ')
  }
  return 'Request failed. Please try again.'
}
export function isVersionConflict(error: unknown) {
  return (
    isAxiosError(error) &&
    error.response?.status === 409 &&
    presetError(error) === 'Preset was changed by someone else'
  )
}
