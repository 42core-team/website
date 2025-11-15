"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { OAUTH_PROVIDERS, OAUTH_CONFIG } from "@/lib/constants/oauth";
import { useEffect, useRef, useState } from "react";

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
    if (!session?.user?.id) return;

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
          code: code,
          state: state,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to link ${provider} account`);
      }

      // Success! Redirect to profile with success message
      router.push(`/profile?success=linked-${provider}`);
    } catch (err: any) {
      console.error(`Error linking ${provider} account:`, err);
      setError(err.message || `Failed to link ${provider} account`);

      // Clean up session storage and processing ref on error
      sessionStorage.removeItem(
        OAUTH_CONFIG.SESSION_STORAGE_KEYS.PROCESSED_CODE,
      );
      processingRef.current = null;
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    // Wait for session to load
    if (status === "loading") return;

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
      } else {
        setError("Invalid OAuth state. Please try again.");
        processingRef.current = null;
      }
    } else if (!code && !state) {
      // No OAuth parameters, redirect to profile
      router.push("/profile");
    }
  }, [session?.user?.id, searchParams, router, provider, status]);

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-lvh">
        <div className="max-w-md mx-auto text-center">
          <div className="p-6 bg-danger-50 border border-danger-200 rounded-lg dark:bg-danger-100/10">
            <div className="flex items-start gap-3">
              <span className="text-danger text-2xl shrink-0">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-medium text-danger mb-2">
                  OAuth Error
                </p>
                <p className="text-sm text-danger-600 mb-4 wrap-break-word">
                  {error}
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => router.push("/profile")}
                    className="px-4 py-2 bg-danger-100 text-danger-700 rounded-md hover:bg-danger-200 transition-colors"
                  >
                    Go to Profile
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-danger-600 text-white rounded-md hover:bg-danger-700 transition-colors"
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
    <div className="flex justify-center items-center min-h-lvh">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-lg text-default-600">
          {isProcessing
            ? `Linking ${provider} account...`
            : `Processing ${provider} OAuth callback...`}
        </p>
        <p className="mt-2 text-sm text-default-500">
          Please wait while we complete the authentication process.
        </p>
      </div>
    </div>
  );
}
