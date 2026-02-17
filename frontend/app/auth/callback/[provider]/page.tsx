import { Suspense } from "react";
import { OAuthCallbackHandler } from "./callbackHandler";

interface OAuthCallbackProps {
  params: Promise<{
    provider: string;
  }>;
}

/**
 * Provider-specific OAuth callback handler
 * URL format: /auth/callback/[provider]?code=...&state=...
 *
 * This route handles the complete OAuth flow:
 * 1. Validates the provider
 * 2. Exchanges the authorization code for tokens
 * 3. Links the account to the user's profile
 * 4. Redirects to profile with success/error status
 */
export default async function OAuthCallback({ params }: OAuthCallbackProps) {
  const { provider } = await params;

  return (
    <Suspense
      fallback={(
        <div className="flex min-h-lvh items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
            <p className="text-muted-frontend mt-4">Loading OAuth handler...</p>
          </div>
        </div>
      )}
    >
      <OAuthCallbackHandler provider={provider} />
    </Suspense>
  );
}
