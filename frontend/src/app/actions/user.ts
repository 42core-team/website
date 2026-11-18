import type { TeamBackground, TeamImage } from '@/app/actions/team'
import axiosInstance from '@/app/actions/axios'
import { imageFormData } from '@/lib/image-form-data'

export interface UserSearchResult {
  id: string
  username: string
  name: string
  profilePicture: string
  picture?: TeamImage | null
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  return (
    await axiosInstance.get<UserSearchResult[]>(
      `user/search?q=${encodeURIComponent(query)}`,
    )
  ).data
}

export async function saveUserImage(
  kind: 'picture' | 'background',
  file: File,
  x: number,
  y: number,
  scale = 1,
) {
  const data = imageFormData(file, x, y, scale)
  return (
    await axiosInstance.put(`user/me/images/${kind}`, data, {
      headers: { 'Content-Type': undefined },
    })
  ).data as TeamImage | TeamBackground
}

export async function removeUserImage(kind: 'picture' | 'background') {
  await axiosInstance.delete(`user/me/images/${kind}`)
}
