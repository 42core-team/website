import type {
  ChartData,
  ChartDataset,
  ChartOptions,
  TooltipItem,
} from 'chart.js'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { useEffect, useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import type { MatchTimeBucket, MatchTimeInterval } from '@/app/actions/stats'
import { MatchPhase } from '@/app/actions/tournament-model'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const PHASE_DETAILS: Record<
  MatchPhase,
  { label: string; background: string; border: string }
> = {
  [MatchPhase.QUEUE]: {
    label: 'Match making',
    background: 'rgba(37, 99, 235, 0.78)',
    border: 'rgb(37, 99, 235)',
  },
  [MatchPhase.SWISS]: {
    label: 'Group phase',
    background: 'rgba(5, 150, 105, 0.78)',
    border: 'rgb(5, 150, 105)',
  },
  [MatchPhase.ELIMINATION]: {
    label: 'Tournament',
    background: 'rgba(124, 58, 237, 0.78)',
    border: 'rgb(124, 58, 237)',
  },
  [MatchPhase.GAMBLING]: {
    label: 'Gambling',
    background: 'rgba(217, 119, 6, 0.78)',
    border: 'rgb(217, 119, 6)',
  },
}

interface ChartTheme {
  foreground: string
  mutedForeground: string
  border: string
}

function getChartTheme(): ChartTheme {
  if (typeof document === 'undefined') {
    return {
      foreground: '#18181b',
      mutedForeground: '#71717a',
      border: 'rgba(113, 113, 122, 0.2)',
    }
  }

  const styles = window.getComputedStyle(document.documentElement)
  return {
    foreground: styles.getPropertyValue('--foreground').trim(),
    mutedForeground: styles.getPropertyValue('--muted-foreground').trim(),
    border: styles.getPropertyValue('--border').trim(),
  }
}

function useChartTheme() {
  const [theme, setTheme] = useState<ChartTheme>(getChartTheme)

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(getChartTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  return theme
}

function getLabelFormatter(interval: MatchTimeInterval) {
  if (interval === 'day') {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: interval === 'minute' ? '2-digit' : undefined,
  })
}

export function MatchesChart({
  data,
  interval,
  selectedPhases,
}: {
  data: MatchTimeBucket[]
  interval: MatchTimeInterval
  selectedPhases: MatchPhase[]
}) {
  const theme = useChartTheme()
  const buckets = useMemo(
    () =>
      Array.from(new Set(data.map((item) => item.bucket))).sort(
        (left, right) => new Date(left).getTime() - new Date(right).getTime(),
      ),
    [data],
  )
  const formatter = useMemo(() => getLabelFormatter(interval), [interval])

  const chartData = useMemo<ChartData<'bar'>>(() => {
    const counts = new Map(
      data.map((item) => [`${item.bucket}:${item.phase}`, item.count]),
    )
    const datasets: ChartDataset<'bar', number[]>[] = selectedPhases.map(
      (phase) => ({
        label: PHASE_DETAILS[phase].label,
        data: buckets.map((bucket) => counts.get(`${bucket}:${phase}`) ?? 0),
        backgroundColor: PHASE_DETAILS[phase].background,
        borderColor: PHASE_DETAILS[phase].border,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
        maxBarThickness: 36,
      }),
    )

    return {
      labels: buckets.map((bucket) => formatter.format(new Date(bucket))),
      datasets,
    }
  }, [buckets, data, formatter, selectedPhases])

  const options = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: selectedPhases.length > 1,
          position: 'bottom',
          labels: {
            color: theme.foreground,
            boxWidth: 12,
            boxHeight: 12,
            padding: 20,
            useBorderRadius: true,
            borderRadius: 3,
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: (items: TooltipItem<'bar'>[]) => {
              const bucket = buckets[items[0]?.dataIndex ?? 0]
              return bucket ? new Date(bucket).toLocaleString() : ''
            },
            label: (context: TooltipItem<'bar'>) => {
              const count = context.parsed.y ?? 0
              return ` ${context.dataset.label}: ${count.toLocaleString()}`
            },
            footer: (items: TooltipItem<'bar'>[]) => {
              if (items.length < 2) return ''
              const total = items.reduce(
                (sum, item) => sum + (item.parsed.y ?? 0),
                0,
              )
              return `Total: ${total.toLocaleString()}`
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          border: { color: theme.border },
          grid: { display: false },
          ticks: {
            color: theme.mutedForeground,
            autoSkip: true,
            maxRotation: 0,
            maxTicksLimit: 12,
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          border: { display: false },
          grid: { color: theme.border },
          ticks: {
            color: theme.mutedForeground,
            precision: 0,
          },
        },
      },
    }),
    [buckets, selectedPhases.length, theme],
  )

  return (
    <div className="h-80 w-full md:h-96">
      <Bar data={chartData} options={options} />
    </div>
  )
}
