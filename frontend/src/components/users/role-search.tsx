import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

export function RoleSearch<T extends { id: string }>({
  label,
  placeholder,
  search,
  renderResult,
  onSelect,
  minLength = 0,
  hideLabel = false,
  autoFocus = false,
}: {
  label: string
  placeholder: string
  search: (query: string) => Promise<T[]>
  renderResult: (item: T) => React.ReactNode
  onSelect: (item: T) => void
  minLength?: number
  hideLabel?: boolean
  autoFocus?: boolean
}) {
  const id = useId()
  const [input, setInput] = useState('')
  const term = input.trim()
  const query = useDebouncedValue(term)
  const results = useQuery({
    queryKey: ['role-search', label, query],
    queryFn: () => search(query),
    enabled: query.length >= minLength && term === query,
  })

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </Label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={id}
          type="search"
          value={input}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="pl-8"
          onChange={(event) => setInput(event.target.value)}
        />
      </div>
      {term.length >= minLength &&
        (term !== query || results.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Searching…
          </p>
        ) : results.isError ? (
          <p role="alert">
            Search failed.{' '}
            <Button
              type="button"
              variant="link"
              onClick={() => void results.refetch()}
            >
              Retry
            </Button>
          </p>
        ) : results.data.length ? (
          <ul
            aria-label={`${label} results`}
            className="max-h-56 overflow-auto rounded-md border bg-background p-1"
          >
            {results.data.map((item) => (
              <li key={item.id}>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start py-2 font-normal"
                  onClick={() => onSelect(item)}
                >
                  {renderResult(item)}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No matches found.</p>
        ))}
    </div>
  )
}
