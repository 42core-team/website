import { usePathname, useRouter, useSearchParams } from '@/lib/router-hooks'

/**
 * Whether the admin reveal panel is open. It lives in the URL so the panel is
 * still open when coming back from a match page.
 */
export function useRevealModeParam() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isRevealModeOpen = searchParams.get('revealMode') === 'true'

  const setRevealModeOpen = (open: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (open) {
      params.set('revealMode', 'true')
    } else {
      params.delete('revealMode')
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  return { isRevealModeOpen, setRevealModeOpen }
}
