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
        <div className="flex justify-center items-center min-h-lvh">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-frontend">Loading OAuth handler...</p>
          </div>
        </div>
      )}
    >
      <OAuthCallbackHandler provider={provider} />
    </Suspense>
  );
}
