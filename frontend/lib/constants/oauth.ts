/**
 * OAuth and social platform constants
 */

export const OAUTH_PROVIDERS = {
  FORTY_TWO: "42",
  GITHUB: "github",
  DISCORD: "discord",
  TWITTER: "twitter",
  LINKEDIN: "linkedin",
} as const;

export const OAUTH_URLS = {
  FORTY_TWO_AUTHORIZE: "https://api.intra.42.fr/oauth/authorize",
  FORTY_TWO_TOKEN: "https://api.intra.42.fr/oauth/token",
  FORTY_TWO_PROFILE: "https://api.intra.42.fr/v2/me",
} as const;

export const OAUTH_CONFIG = {
  STATE_LENGTH: 10,
  LOADING_DELAY: 100, // ms delay to show loading state before redirect
  SESSION_STORAGE_KEYS: {
    OAUTH_STATE: "oauth_state",
    PROCESSED_CODE: "processed_oauth_code",
  },
} as const;

export type OAuthProvider
  = (typeof OAUTH_PROVIDERS)[keyof typeof OAUTH_PROVIDERS];
