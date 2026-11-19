'use client'

import type { ChartData, ChartDataset, ChartOptions } from 'chart.js'
import type { QueueMatchesTimeBucket } from '@/app/actions/stats'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { useChartTheme } from '@/hooks/use-chart-theme'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

export default function QueueMatchesChart({
  data,
  title = 'Match Making Matches Played',
}: {
  data: QueueMatchesTimeBucket[]
  title?: string
}) {
  const theme = useChartTheme()
  // Format labels more compactly: e.g., 09/07/25, 14:30
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const labels = data.map((d) => formatter.format(new Date(d.bucket)))
  const counts = data.map((d) => d.count)

  const dataset: ChartDataset<'bar'> = {
    label: 'Matches',
    data: counts,
    backgroundColor: theme.series[0],
    borderColor: theme.series[0],
    borderWidth: 0,
    borderRadius: 6,
    borderSkipped: 'top',
    categoryPercentage: 1,
    barPercentage: 1,
    clip: 0,
    maxBarThickness: 30,
    minBarLength: 2,
    hoverBackgroundColor: theme.series[0],
  }

  const chartData: ChartData<'bar'> = {
    labels,
    datasets: [dataset],
  }

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 8, right: 0, left: 0, bottom: 0 },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: title,
        color: theme.foreground,
        font: { size: 16, weight: 600 },
        padding: { bottom: 10 },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        ...theme.tooltip,
        padding: 10,
        displayColors: false,
        callbacks: {
          title: (items) => {
            const i = items?.[0]
            if (!i) return ''
            const idx = (i as any).dataIndex ?? 0
            const raw = data[idx]?.bucket
            return raw ? new Date(raw).toLocaleString() : (i as any).label || ''
          },
          label: (context) => {
            const v = (context as any).parsed?.y ?? (context as any).raw
            const n = typeof v === 'number' ? v : Number(v)
            const unit = n === 1 ? 'match' : 'matches'
            return `${n.toLocaleString()} ${unit}`
          },
        },
      },
    },
    scales: {
      x: {
        // add edge padding so first/last bars don't cut off
        offset: true,
        border: { display: true, color: theme.border },
        grid: {
          display: true,
          color: theme.border,
        },
        ticks: {
          maxRotation: 45,
          minRotation: 0,
          color: theme.mutedForeground,
          autoSkip: true,
          maxTicksLimit: 12,
        },
      },
      y: {
        beginAtZero: true,
        border: { display: true, color: theme.border },
        grid: {
          color: theme.border,
        },
        ticks: {
          precision: 0 as number | undefined,
          color: theme.mutedForeground,
          callback: (value) => {
            const n = typeof value === 'number' ? value : Number(value)
            return Number.isFinite(n) ? n.toLocaleString() : (value as any)
          },
        },
      },
    },
  }

  return (
    <div className="h-72 w-full">
      <Bar aria-label={title} role="img" data={chartData} options={options} />
    </div>
  )
}
