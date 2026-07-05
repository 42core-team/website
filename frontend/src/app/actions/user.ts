import axiosInstance from '@/app/actions/axios'

export interface UserSearchResult {
  id: string
  username: string
  name: string
  profilePicture: string
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  return (
    await axiosInstance.get<UserSearchResult[]>(
      `user/search?q=${encodeURIComponent(query)}`,
    )
  ).data
}
