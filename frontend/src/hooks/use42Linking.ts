import { useSearchParams } from '@/lib/router-hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getFortyTwoAuthUrl } from '@/app/actions/social-accounts'
import { OAUTH_CONFIG } from '@/lib/constants/oauth'

const LINKING_RETURN_KEY = 'fortytwo_linking_return'

/**
 * Whether this page load is the return from linking a 42 account: the API
 * redirects back with `?error=` on failure and without a marker on success,
 * so the start of the flow leaves one in session storage. Clears it.
 */
export function takeFortyTwoLinkingReturn(search: string): boolean {
  let started = false
  try {
    started = window.sessionStorage.getItem(LINKING_RETURN_KEY) !== null
    window.sessionStorage.removeItem(LINKING_RETURN_KEY)
  } catch {
    // Storage can be unavailable; the query still tells errors apart.
  }
  const params = new URLSearchParams(search)
  return started || params.has('error') || params.has('success')
}

/**
 * Simplified hook for handling 42 School OAuth integration
 *
 * Note: OAuth callback handling is now done in /auth/callback/[provider]
 * This hook only handles initiating the OAuth flow and showing success/error states
 */
interface Use42LinkingReturn {
  /** True when initiating OAuth flow (shows loading spinner) */
  isInitiating: boolean
  /** Current success/error message from URL params */
  message: { type: 'success' | 'error'; text: string } | null
  /** Initiates the 42 OAuth authorization flow */
  initiate42OAuth: () => void
  /** Clears the current message */
  clearMessage: () => void
}

function normalizeErrorMessage(error: string): string {
  try {
    const decodedError = decodeURIComponent(error)
    if (decodedError === 'invalid-provider') {
      return 'Invalid OAuth provider'
    }

    return decodedError.includes('-')
      ? decodedError.replace(/-/g, ' ')
      : decodedError
  } catch {
    return error === 'invalid-provider'
      ? 'Invalid OAuth provider'
      : error.replace(/-/g, ' ')
  }
}

export function use42Linking(onSuccess?: () => void): Use42LinkingReturn {
  const searchParams = useSearchParams()
  const [isInitiating, setIsInitiating] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const processedRef = useRef<string | null>(null)

  const clearMessage = useCallback(() => {
    setMessage(null)
    processedRef.current = null
    // Clean up URL parameters
    const url = new URL(window.location.href)
    url.searchParams.delete('success')
    url.searchParams.delete('error')
    window.history.replaceState({}, '', url.toString())
  }, [])

  const initiate42OAuth = useCallback(() => {
    setMessage(null)
    setIsInitiating(true)
    processedRef.current = null

    // Small delay to show the loading state before redirect
    setTimeout(async () => {
      try {
        // Ask backend for the 42 auth URL (which includes the encrypted user id in state)
        const authUrl = await getFortyTwoAuthUrl()

        if (!authUrl) {
          throw new Error('No auth URL returned from backend')
        }

        try {
          window.sessionStorage.setItem(LINKING_RETURN_KEY, '1')
        } catch {
          // Without storage a successful link returns to the profile.
        }
        window.location.href = authUrl
      } catch (err: any) {
        console.error('Failed to initiate 42 OAuth via backend:', err)
        setMessage({
          type: 'error',
          text:
            err?.message ||
            'Failed to start 42 authentication. Please try again later.',
        })
        setIsInitiating(false)
      }
    }, OAUTH_CONFIG.LOADING_DELAY)
  }, [])

  // The linking result is shown here, so a later /profile visit must not
  // take the marker for a return from 42.
  useEffect(() => {
    try {
      window.sessionStorage.removeItem(LINKING_RETURN_KEY)
    } catch {
      // Nothing to clear without storage.
    }
  }, [])

  // Handle success/error messages from URL parameters
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const currentParam = success || error

    // Only process if we have a parameter and haven't processed it yet
    if (currentParam && processedRef.current !== currentParam) {
      processedRef.current = currentParam

      if (success) {
        // For success, just call onSuccess callback but don't show message
        onSuccess?.()
        // Clean up URL parameters immediately for success
        const url = new URL(window.location.href)
        url.searchParams.delete('success')
        window.history.replaceState({}, '', url.toString())
      } else if (error) {
        // Only show messages for errors
        setMessage({ type: 'error', text: normalizeErrorMessage(error) })
      }

      // Clear the initiating state
      setIsInitiating(false)
    }
  }, [searchParams, onSuccess])

  return {
    isInitiating,
    message,
    initiate42OAuth,
    clearMessage,
  }
}
