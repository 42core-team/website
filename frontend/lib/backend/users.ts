import type { AxiosInstance } from "axios";
import type { UserSearchResult } from "./types/user";
import { requestData } from "./http/errors";

export function createUsersApi(http: AxiosInstance) {
  return {
    searchUsers(query: string) {
      return requestData(
        http.get<UserSearchResult[]>(`user/search?q=${encodeURIComponent(query)}`),
      );
    },
  };
}
