"use server";

import type {
  LinkSocialAccountData as BackendLinkSocialAccountData,
  SocialAccount as BackendSocialAccount,
} from "@/lib/backend/types/social-accounts";
import { serverSocialAccountsApi } from "@/lib/backend/server";

export interface LinkSocialAccountData extends BackendLinkSocialAccountData {}
export interface SocialAccount extends BackendSocialAccount {}

export async function unlinkSocialAccount(platform: string): Promise<void> {
  await serverSocialAccountsApi.unlinkSocialAccount(platform);
}

export async function getSocialAccounts(): Promise<SocialAccount[]> {
  return await serverSocialAccountsApi.getSocialAccounts();
}

export async function getSocialAccountByPlatform(
  platform: string,
): Promise<SocialAccount | null> {
  return await serverSocialAccountsApi.getSocialAccountByPlatform(platform);
}

export async function getFortyTwoAuthUrl(): Promise<string> {
  return await serverSocialAccountsApi.getFortyTwoAuthUrl();
}
