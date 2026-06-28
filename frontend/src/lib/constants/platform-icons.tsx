import Image from "@/components/app-image";
import { OAUTH_PROVIDERS } from "./oauth";

/**
 * Platform icon configurations for social accounts
 */
export const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  [OAUTH_PROVIDERS.GITHUB]: "🐙",
  [OAUTH_PROVIDERS.FORTY_TWO]: (
    <Image
      src="/42-logo.svg"
      alt="42 School"
      width={24}
      height={24}
      className="h-6 w-6 invert dark:invert-0"
    />
  ),
  [OAUTH_PROVIDERS.DISCORD]: "💬",
  [OAUTH_PROVIDERS.TWITTER]: "🐦",
  [OAUTH_PROVIDERS.LINKEDIN]: "💼",
};

export const PLATFORM_NAMES: Record<string, string> = {
  [OAUTH_PROVIDERS.FORTY_TWO]: "42 School",
  [OAUTH_PROVIDERS.GITHUB]: "GitHub",
  [OAUTH_PROVIDERS.DISCORD]: "Discord",
  [OAUTH_PROVIDERS.TWITTER]: "Twitter",
  [OAUTH_PROVIDERS.LINKEDIN]: "LinkedIn",
};

export function getPlatformIcon(platform: string): React.ReactNode {
  return PLATFORM_ICONS[platform] || "🔗";
}

export function getPlatformName(platform: string): string {
  return PLATFORM_NAMES[platform] || platform;
}
