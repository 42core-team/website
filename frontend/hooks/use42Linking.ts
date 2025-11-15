import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  OAUTH_CONFIG,
  OAUTH_PROVIDERS,
  OAUTH_URLS,
} from "@/lib/constants/oauth";

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
    // Clear any previous messages and show immediate loading feedback
    setMessage(null);
    setIsInitiating(true);
    processedRef.current = null;

    // Check if environment variable is available
    const clientId = process.env.NEXT_PUBLIC_FORTY_TWO_CLIENT_ID;
    if (!clientId) {
      console.error("NEXT_PUBLIC_FORTY_TWO_CLIENT_ID is not set");
      setMessage({
        type: "error",
        text: "OAuth configuration is missing. Please contact support.",
      });
      setIsInitiating(false);
      return;
    }

    // Small delay to show the loading state before redirect
    setTimeout(() => {
      // Generate a cryptographically secure random state string
      const array = new Uint8Array(OAUTH_CONFIG.STATE_LENGTH);
      window.crypto.getRandomValues(array);
      const state = Array.from(array, b =>
        b.toString(16).padStart(2, "0")).join("");
      const authUrl = new URL(OAUTH_URLS.FORTY_TWO_AUTHORIZE);

      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set(
        "redirect_uri",
        `${window.location.origin}/auth/callback/${OAUTH_PROVIDERS.FORTY_TWO}`,
      );
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "public");
      authUrl.searchParams.set("state", state);

      // Store state in sessionStorage for verification
      sessionStorage.setItem(
        OAUTH_CONFIG.SESSION_STORAGE_KEYS.OAUTH_STATE,
        state,
      );

      window.location.href = authUrl.toString();
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
      }
      else if (error) {
        // Only show messages for errors
        if (error === "invalid-provider") {
          setMessage({ type: "error", text: "Invalid OAuth provider" });
        }
        else {
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
