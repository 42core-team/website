import type { AxiosInstance } from "axios";
import type {
  LinkSocialAccountData,
  SocialAccount,
} from "./types/social-accounts";
import { normalizeBackendError, requestData } from "./http/errors";

export function createSocialAccountsApi(http: AxiosInstance) {
  return {
    async unlinkSocialAccount(platform: string) {
      await requestData(http.delete(`/social-accounts/${platform}`));
    },
    getSocialAccounts() {
      return requestData(http.get<SocialAccount[]>("/social-accounts"));
    },
    async getSocialAccountByPlatform(platform: string) {
      try {
        return await requestData(
          http.get<SocialAccount>(`/social-accounts/${platform}`),
        );
      }
      catch (error) {
        const backendError = normalizeBackendError(error);
        if (backendError.status === 404) {
          return null;
        }

        throw backendError;
      }
    },
    getFortyTwoAuthUrl() {
      return requestData(http.get<string>("/auth/42/getUrl"));
    },
    linkSocialAccount(data: LinkSocialAccountData) {
      return requestData(http.post<SocialAccount>("/social-accounts/link", data));
    },
  };
}
