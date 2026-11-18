import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
}: {
  label: string
  placeholder: string
  search: (query: string) => Promise<T[]>
  renderResult: (item: T) => React.ReactNode
  onSelect: (item: T) => void
  minLength?: number
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
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={input}
        placeholder={placeholder}
        onChange={(event) => setInput(event.target.value)}
      />
      {term.length >= minLength &&
        (term !== query || results.isPending ? (
          <p role="status">Searching…</p>
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
            className="max-h-44 overflow-auto rounded-md border p-1"
          >
            {results.data.map((item) => (
              <li key={item.id}>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-start"
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
