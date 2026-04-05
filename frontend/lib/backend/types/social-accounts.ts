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
