import { useEffect, useRef } from 'react'
import { useRouter } from '@/lib/router-hooks'

const POST_OAUTH_REDIRECT_KEY = 'post_oauth_redirect'

function getStoredRedirectPath(): string | null {
  const storedValue = window.sessionStorage.getItem(POST_OAUTH_REDIRECT_KEY)
  if (!storedValue) return null

  if (!storedValue.startsWith('/') || storedValue.startsWith('//')) {
    return null
  }

  return storedValue
}

export function PostOAuthRedirect() {
  const router = useRouter()
  const hasRestoredRef = useRef(false)

  useEffect(() => {
    if (hasRestoredRef.current) return
    hasRestoredRef.current = true

    const redirectPath = getStoredRedirectPath()
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`

    window.sessionStorage.removeItem(POST_OAUTH_REDIRECT_KEY)

    if (!redirectPath || redirectPath === currentPath) {
      return
    }

    router.replace(redirectPath)
  }, [router])

  return null
}
