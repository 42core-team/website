import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getAllQueueMatches } from '@/app/actions/tournament'
import { MatchState } from '@/app/actions/tournament-model'
import MatchesList from '@/components/MatchesList'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const MATCHES_PER_PAGE = 20
const RUNNING_MATCHES_REFETCH_INTERVAL_MS = 5000

interface QueueMatchesManagementProps {
  eventId: string
}

export function QueueMatchesManagement({
  eventId,
}: QueueMatchesManagementProps) {
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const search = useDebouncedValue(searchInput.trim(), 300)

  const queueMatchesQuery = useQuery({
    queryKey: ['event', eventId, 'queue-matches', 'admin', page, search],
    queryFn: () => getAllQueueMatches(eventId, page, MATCHES_PER_PAGE, search),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.matches.some(
        (match) => match.state !== MatchState.FINISHED,
      )
        ? RUNNING_MATCHES_REFETCH_INTERVAL_MS
        : false,
  })

  const total = queueMatchesQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / MATCHES_PER_PAGE))
  const isPlaceholderData = queueMatchesQuery.isPlaceholderData

  useEffect(() => {
    if (!isPlaceholderData) {
      setPage((currentPage) => Math.min(currentPage, totalPages))
    }
  }, [isPlaceholderData, totalPages])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Queue Matches</CardTitle>
        <CardDescription>
          {queueMatchesQuery.data
            ? `${total} ${total === 1 ? 'queue match' : 'queue matches'} ${search ? 'found' : 'in this event'}.`
            : 'All match making matches of this event.'}
        </CardDescription>
        <div className="relative mt-2">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value)
              setPage(1)
            }}
            placeholder="Search by team name..."
            className="pl-9"
            aria-label="Search queue matches by team name"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {queueMatchesQuery.isPending ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : queueMatchesQuery.isError ? (
          <p className="py-8 text-center text-destructive">
            Failed to load queue matches.
          </p>
        ) : (
          <>
            <MatchesList
              eventId={eventId}
              matches={queueMatchesQuery.data.matches}
              isInsideCard
              emptyMessage={
                search ? 'No matches found' : 'No queue matches yet'
              }
            />
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((currentPage) => currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((currentPage) => currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
