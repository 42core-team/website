import type { MediaImage } from "../../media/media-artwork";

export interface UserInviteSearchResult {
  id: string;
  name: string;
  username: string;
  profilePicture: string;
  picture: MediaImage | null;
  isInvited: boolean;
}
