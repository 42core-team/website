"use server";

import axiosInstance from "./axios";

export interface SocialAccount {
  id: string;
  platform: string;
  username: string;
  platformUserId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LinkSocialAccountData {
  platform: string;
  username: string;
  platformUserId: string;
}

export async function unlinkSocialAccount(platform: string): Promise<void> {
  try {
    await axiosInstance.delete(`/social-accounts/${platform}`);
  }
  catch (error: any) {
    console.error("Error unlinking social account:", error);
    throw new Error(
      error.response?.data?.message || "Failed to unlink social account",
    );
  }
}

export async function getSocialAccounts(): Promise<SocialAccount[]> {
  try {
    const response = await axiosInstance.get("/social-accounts");
    return response.data;
  }
  catch (error: any) {
    console.error("Error fetching social accounts:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch social accounts",
    );
  }
}

export async function getSocialAccountByPlatform(
  platform: string,
): Promise<SocialAccount | null> {
  try {
    const response = await axiosInstance.get(`/social-accounts/${platform}`);
    return response.data;
  }
  catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    console.error("Error fetching social account:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch social account",
    );
  }
}
