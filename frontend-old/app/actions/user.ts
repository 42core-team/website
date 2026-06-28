"use server";

import type { ServerActionResponse } from "@/app/actions/errors";
import axiosInstance, { handleError } from "@/app/actions/axios";

export interface UserSearchResult {
  id: string;
  username: string;
  name: string;
  profilePicture: string;
}

export async function searchUsers(
  query: string,
): Promise<ServerActionResponse<UserSearchResult[]>> {
  return await handleError(
    axiosInstance.get<UserSearchResult[]>(`user/search?q=${encodeURIComponent(query)}`),
  );
}
