"use server";

import type { ServerActionResponse } from "@/app/actions/errors";
import type { UserSearchResult as BackendUserSearchResult } from "@/lib/backend/types/user";
import { toActionError } from "@/lib/backend/http/errors";
import { serverUsersApi } from "@/lib/backend/server";

export type UserSearchResult = BackendUserSearchResult;

export async function searchUsers(
  query: string,
): Promise<ServerActionResponse<UserSearchResult[]>> {
  try {
    return await serverUsersApi.searchUsers(query);
  }
  catch (error) {
    return toActionError(error);
  }
}
