import { useQuery } from '@tanstack/react-query'
import { endOfDay, format, startOfDay, subDays, subMonths } from 'date-fns'
import {
  AlertCircle,
  CalendarIcon,
  Check,
  ChevronDown,
  RotateCw,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import type { MatchTimeInterval } from '@/app/actions/stats'
import { getMatchesTimeSeries } from '@/app/actions/stats'
import { MatchPhase } from '@/app/actions/tournament-model'
import { MatchesChart } from '@/components/dashboard/matches-chart'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const MATCH_TYPES = [
  { phase: MatchPhase.QUEUE, label: 'Match making' },
  { phase: MatchPhase.SWISS, label: 'Group phase' },
  { phase: MatchPhase.ELIMINATION, label: 'Tournament' },
  { phase: MatchPhase.GAMBLING, label: 'Gambling' },
] as const

const ALL_PHASES = MATCH_TYPES.map(({ phase }) => phase)

const RANGE_PRESETS = [
  { label: 'Last 7 days', getFrom: () => subDays(new Date(), 6) },
  { label: 'Last 30 days', getFrom: () => subDays(new Date(), 29) },
  { label: 'Last 3 months', getFrom: () => subMonths(new Date(), 3) },
] as const

function getRangeLabel(range: DateRange) {
  if (!range.from) return 'Select a date range'
  if (!range.to) return format(range.from, 'MMM d, yyyy')
  return `${format(range.from, 'MMM d, yyyy')} – ${format(
    range.to,
    'MMM d, yyyy',
  )}`
}

export function MatchesAnalytics({ eventId }: { eventId: string }) {
  const [selectedPhases, setSelectedPhases] = useState<MatchPhase[]>(ALL_PHASES)
  const [interval, setInterval] = useState<MatchTimeInterval>('day')
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    from: subDays(new Date(), 29),
    to: new Date(),
  }))

  const startISO = dateRange.from
    ? startOfDay(dateRange.from).toISOString()
    : ''
  const endISO = dateRange.to ? endOfDay(dateRange.to).toISOString() : ''
  const sortedPhases = useMemo(
    () => [...selectedPhases].sort(),
    [selectedPhases],
  )

  const matchesQuery = useQuery({
    queryKey: [
      'event',
      eventId,
      'match-timeseries',
      { phases: sortedPhases, interval, startISO, endISO },
    ],
    queryFn: () =>
      getMatchesTimeSeries(eventId, sortedPhases, interval, startISO, endISO),
    enabled:
      sortedPhases.length > 0 &&
      Boolean(dateRange.from) &&
      Boolean(dateRange.to),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  })

  const totalMatches =
    matchesQuery.data?.reduce((sum, bucket) => sum + bucket.count, 0) ?? 0
  const matchTypeLabel =
    selectedPhases.length === ALL_PHASES.length
      ? 'All match types'
      : selectedPhases.length === 1
        ? MATCH_TYPES.find(({ phase }) => phase === selectedPhases[0])?.label
        : `${selectedPhases.length} match types`

  const togglePhase = (phase: MatchPhase, checked: boolean) => {
    setSelectedPhases((current) =>
      checked
        ? Array.from(new Set([...current, phase]))
        : current.filter((item) => item !== phase),
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Match activity</CardTitle>
          <CardDescription>
            Compare completed matches by type over a selected period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Match types</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {matchTypeLabel || 'Select match types'}
                    </span>
                    <ChevronDown className="size-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Display match types</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {MATCH_TYPES.map(({ phase, label }) => (
                    <DropdownMenuCheckboxItem
                      key={phase}
                      checked={selectedPhases.includes(phase)}
                      onCheckedChange={(checked) =>
                        togglePhase(phase, checked === true)
                      }
                      onSelect={(event) => event.preventDefault()}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <div className="flex gap-2 p-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedPhases(ALL_PHASES)}
                    >
                      <Check className="size-4" />
                      Select all
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setSelectedPhases([])}
                    >
                      Clear
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-2">
              <Label>Date range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dateRange.from && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="size-4" />
                    <span className="truncate">{getRangeLabel(dateRange)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <div className="flex flex-wrap gap-2 border-b p-3">
                    {RANGE_PRESETS.map((preset) => (
                      <Button
                        key={preset.label}
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDateRange({
                            from: preset.getFrom(),
                            to: new Date(),
                          })
                        }
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) =>
                      setDateRange(range ?? { from: undefined })
                    }
                    numberOfMonths={2}
                    disabled={{ after: new Date() }}
                    defaultMonth={dateRange.from}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="match-time-interval">Group by</Label>
              <Select
                value={interval}
                onValueChange={(value: MatchTimeInterval) => setInterval(value)}
              >
                <SelectTrigger id="match-time-interval" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minute">Minute</SelectItem>
                  <SelectItem value="hour">Hour</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-y py-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Matches in selected period
              </p>
              <p className="text-3xl font-semibold tabular-nums">
                {matchesQuery.isPending ? '—' : totalMatches.toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedPhases.map((phase) => (
                <Badge key={phase} variant="secondary">
                  {
                    MATCH_TYPES.find((matchType) => matchType.phase === phase)
                      ?.label
                  }
                </Badge>
              ))}
              {matchesQuery.isFetching && !matchesQuery.isPending && (
                <Badge variant="outline">
                  <RotateCw className="size-3 animate-spin" />
                  Updating
                </Badge>
              )}
            </div>
          </div>

          {selectedPhases.length === 0 ? (
            <div className="flex h-80 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
              Select at least one match type to display the chart.
            </div>
          ) : matchesQuery.isPending ? (
            <Skeleton className="h-80 w-full md:h-96" />
          ) : matchesQuery.isError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Could not load match activity</AlertTitle>
              <AlertDescription>
                Try changing the time range or refreshing the page.
              </AlertDescription>
            </Alert>
          ) : matchesQuery.data.length === 0 ? (
            <div className="flex h-80 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
              No completed matches were found for these filters.
            </div>
          ) : (
            <MatchesChart
              data={matchesQuery.data}
              interval={interval}
              selectedPhases={selectedPhases}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
