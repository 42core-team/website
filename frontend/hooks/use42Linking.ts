import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { OAUTH_CONFIG, OAUTH_PROVIDERS } from "@/lib/constants/oauth";
import { getFortyTwoAuthUrl } from "@/app/actions/social-accounts";

/**
 * Simplified hook for handling 42 School OAuth integration
 *
 * Note: OAuth callback handling is now done in /auth/callback/[provider]
 * This hook only handles initiating the OAuth flow and showing success/error states
 */
interface Use42LinkingReturn {
  /** True when initiating OAuth flow (shows loading spinner) */
  isInitiating: boolean;
  /** Current success/error message from URL params */
  message: { type: "success" | "error"; text: string } | null;
  /** Initiates the 42 OAuth authorization flow */
  initiate42OAuth: () => void;
  /** Clears the current message */
  clearMessage: () => void;
}

export function use42Linking(onSuccess?: () => void): Use42LinkingReturn {
  const searchParams = useSearchParams();
  const [isInitiating, setIsInitiating] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const processedRef = useRef<string | null>(null);

  const clearMessage = useCallback(() => {
    setMessage(null);
    processedRef.current = null;
    // Clean up URL parameters
    const url = new URL(window.location.href);
    url.searchParams.delete("success");
    url.searchParams.delete("error");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const initiate42OAuth = useCallback(() => {
    setMessage(null);
    setIsInitiating(true);
    processedRef.current = null;

    // Small delay to show the loading state before redirect
    setTimeout(async () => {
      try {
        // Ask backend for the 42 auth URL (which includes the encrypted user id in state)
        const authUrl = await getFortyTwoAuthUrl();

        if (!authUrl) {
          throw new Error("No auth URL returned from backend");
        }

        window.location.href = authUrl;
      } catch (err: any) {
        console.error("Failed to initiate 42 OAuth via backend:", err);
        setMessage({
          type: "error",
          text:
            err?.message ||
            "Failed to start 42 authentication. Please try again later.",
        });
        setIsInitiating(false);
      }
    }, OAUTH_CONFIG.LOADING_DELAY);
  }, []);

  // Handle success/error messages from URL parameters
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const currentParam = success || error;

    // Only process if we have a parameter and haven't processed it yet
    if (currentParam && processedRef.current !== currentParam) {
      processedRef.current = currentParam;

      if (success) {
        // For success, just call onSuccess callback but don't show message
        onSuccess?.();
        // Clean up URL parameters immediately for success
        const url = new URL(window.location.href);
        url.searchParams.delete("success");
        window.history.replaceState({}, "", url.toString());
      } else if (error) {
        // Only show messages for errors
        if (error === "invalid-provider") {
          setMessage({ type: "error", text: "Invalid OAuth provider" });
        } else {
          setMessage({ type: "error", text: error.replace(/-/g, " ") });
        }
      }

      // Clear the initiating state
      setIsInitiating(false);
    }
  }, [searchParams, onSuccess]);

  return {
    isInitiating,
    message,
    initiate42OAuth,
    clearMessage,
  };
}
