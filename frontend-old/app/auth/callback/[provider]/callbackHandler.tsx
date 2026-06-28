"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OAUTH_CONFIG, OAUTH_PROVIDERS } from "@/lib/constants/oauth";

/**
 * OAuth callback component that handles the complete OAuth flow
 */
export function OAuthCallbackHandler({ provider }: { provider: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef<string | null>(null);

  const handleOAuthCallback = async (code: string, state: string) => {
    if (!session?.user?.id)
      return;

    setIsProcessing(true);
    setError(null);

    try {
      // Use the generic OAuth API route
      const response = await fetch(`/api/auth/oauth-link/${provider}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          state,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to link ${provider} account`);
      }

      // Success! Redirect to profile with success message
      router.push(`/profile?success=linked-${provider}`);
    }
    catch (err: any) {
      console.error(`Error linking ${provider} account:`, err);
      setError(err.message || `Failed to link ${provider} account`);

      // Clean up session storage and processing ref on error
      sessionStorage.removeItem(
        OAUTH_CONFIG.SESSION_STORAGE_KEYS.PROCESSED_CODE,
      );
      processingRef.current = null;
    }
    finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    // Wait for session to load
    if (status === "loading")
      return;

    // If not authenticated, redirect to login
    if (!session?.user?.id) {
      router.push("/auth/signin");
      return;
    }

    // Validate provider
    const validProviders = Object.values(OAUTH_PROVIDERS);
    if (!validProviders.includes(provider as any)) {
      console.error(`Invalid OAuth provider: ${provider}`);
      router.push("/profile?error=invalid-provider");
      return;
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (code && state) {
      // Check if we're already processing this code
      if (processingRef.current === code) {
        return; // Already processing this code
      }

      // Also check sessionStorage as backup
      const processedCode = sessionStorage.getItem(
        OAUTH_CONFIG.SESSION_STORAGE_KEYS.PROCESSED_CODE,
      );
      if (processedCode === code) {
        return; // Already processed this code
      }

      const storedState = sessionStorage.getItem(
        OAUTH_CONFIG.SESSION_STORAGE_KEYS.OAUTH_STATE,
      );
      sessionStorage.removeItem(OAUTH_CONFIG.SESSION_STORAGE_KEYS.OAUTH_STATE);

      // Mark as processing immediately
      processingRef.current = code;

      // Verify state matches what we stored
      if (storedState === state) {
        // Mark this code as being processed in sessionStorage
        sessionStorage.setItem(
          OAUTH_CONFIG.SESSION_STORAGE_KEYS.PROCESSED_CODE,
          code,
        );
        handleOAuthCallback(code, state);
      }
      else {
        setError("Invalid OAuth state. Please try again.");
        processingRef.current = null;
      }
    }
    else if (!code && !state) {
      // No OAuth parameters, redirect to profile
      router.push("/profile");
    }
  }, [session?.user?.id, searchParams, router, provider, status]);

  if (error) {
    return (
      <div className="flex min-h-lvh items-center justify-center">
        <div className="mx-auto max-w-md text-center">
          <div className="bg-danger-50 border-danger-200 dark:bg-danger-100/10 rounded-lg border p-6">
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-2xl text-destructive">⚠️</span>
              <div className="min-w-0 flex-1">
                <p className="mb-2 text-lg font-medium text-destructive">
                  OAuth Error
                </p>
                <p className="text-destructive-600 mb-4 text-sm wrap-break-word">
                  {error}
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => router.push("/profile")}
                    className="bg-danger-100 text-destructive-700 hover:bg-danger-200 rounded-md px-4 py-2 transition-colors"
                  >
                    Go to Profile
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="bg-danger-600 hover:bg-danger-700 rounded-md px-4 py-2 text-white transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-lvh items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
        <p className="mt-4 text-lg ">
          {isProcessing
            ? `Linking ${provider} account...`
            : `Processing ${provider} OAuth callback...`}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Please wait while we complete the authentication process.
        </p>
      </div>
    </div>
  );
}
