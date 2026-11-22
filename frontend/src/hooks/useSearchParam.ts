import { useLocation, useNavigate } from '@tanstack/react-router'

/**
 * A search param of the current URL, so Back, Forward and shared links keep
 * it. Setting it keeps the other params, e.g. the dashboard's tab, even when
 * several are set at once.
 */
export function useSearchParam(name: string, { push = false } = {}) {
  const navigate = useNavigate()
  // Read from the location, like useHistoryIndex, so both change together.
  const value: unknown = useLocation({
    select: (location) => (location.search as Record<string, unknown>)[name],
  })

  function setValue(next: string | null) {
    void navigate({
      to: '.',
      search: (current: Record<string, unknown>) => ({
        ...current,
        [name]: next ?? undefined,
      }),
      replace: !push,
      resetScroll: false,
    })
  }

  // The router parses values that look like JSON, e.g. `?q=1` gives a number.
  return [value == null ? null : String(value), setValue] as const
}

/**
 * Changes on each push, Back and Forward, but not on a replace, so a draft
 * kept beside a search param can tell history navigation from its own writes.
 */
export function useHistoryIndex() {
  return useLocation({ select: (location) => location.state.__TSR_index })
}
