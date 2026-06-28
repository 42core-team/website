"use client";

import type { ChartData, ChartDataset, ChartOptions, ScriptableContext } from "chart.js";
import type { QueueMatchesTimeBucket } from "@/app/actions/stats";
import {
  BarElement,
  CategoryScale,

  Chart as ChartJS,

  Legend,
  LinearScale,

  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function QueueMatchesChart({
  data,
  title = "Queue Matches Played",
}: {
  data: QueueMatchesTimeBucket[];
  title?: string;
}) {
  // Format labels more compactly: e.g., 09/07/25, 14:30
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const labels = data.map(d => formatter.format(new Date(d.bucket)));
  const counts = data.map(d => d.count);

  // Create a vertical gradient fill; fall back to a flat color before chart area is ready
  const gradientBackground = (
    ctx: ScriptableContext<"bar">,
  ): string | CanvasGradient => {
    const { chart } = ctx;
    const { ctx: canvasCtx, chartArea } = chart || ({} as any);
    if (!chartArea) {
      return "rgba(59, 130, 246, 0.6)"; // fallback before layout
    }
    const gradient = canvasCtx.createLinearGradient(
      0,
      chartArea.top,
      0,
      chartArea.bottom,
    );
    gradient.addColorStop(0, "rgba(59, 130, 246, 0.9)"); // blue-500/90
    gradient.addColorStop(1, "rgba(147, 51, 234, 0.6)"); // purple-600/60
    return gradient;
  };

  const dataset: ChartDataset<"bar"> = {
    label: "Matches",
    data: counts,
    backgroundColor: gradientBackground,
    borderColor: "rgba(59, 130, 246, 0.9)",
    borderWidth: 0,
    borderRadius: 6,
    borderSkipped: "top",
    categoryPercentage: 1,
    barPercentage: 1,
    clip: 0,
    maxBarThickness: 30,
    minBarLength: 2,
    hoverBackgroundColor: "rgba(59, 130, 246, 1)",
  };

  const chartData: ChartData<"bar"> = {
    labels,
    datasets: [dataset],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 8, right: 0, left: 0, bottom: 0 },
    },
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: title,
        color: "#111827",
        font: { size: 16, weight: 600 },
        padding: { bottom: 10 },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: "rgba(17, 24, 39, 0.9)",
        titleColor: "#fff",
        bodyColor: "#e5e7eb",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          title: (items) => {
            const i = items?.[0];
            if (!i)
              return "";
            const idx = (i as any).dataIndex ?? 0;
            const raw = data[idx]?.bucket;
            return raw
              ? new Date(raw).toLocaleString()
              : (i as any).label || "";
          },
          label: (context) => {
            const v = (context as any).parsed?.y ?? (context as any).raw;
            const n = typeof v === "number" ? v : Number(v);
            const unit = n === 1 ? "match" : "matches";
            return `${n.toLocaleString()} ${unit}`;
          },
        },
      },
    },
    animations: {
      y: { from: 0, duration: 800, easing: "easeOutQuart" },
      x: { duration: 600, easing: "easeOutQuad" },
    },
    scales: {
      x: {
        // add edge padding so first/last bars don't cut off
        offset: true,
        border: { display: true, color: "rgba(107, 114, 128, 0.3)" },
        grid: {
          display: true,
          color: "rgba(107, 114, 128, 0.15)",
        },
        ticks: {
          maxRotation: 45,
          minRotation: 0,
          color: "#6b7280",
          autoSkip: true,
          maxTicksLimit: 12,
        },
      },
      y: {
        beginAtZero: true,
        border: { display: true, color: "rgba(107, 114, 128, 0.3)" },
        grid: {
          color: "rgba(107, 114, 128, 0.15)",
        },
        ticks: {
          precision: 0 as number | undefined,
          color: "#6b7280",
          callback: (value) => {
            const n = typeof value === "number" ? value : Number(value);
            return Number.isFinite(n) ? n.toLocaleString() : (value as any);
          },
        },
      },
    },
  };

  return (
    <div className="h-72 w-full">
      <Bar data={chartData} options={options} />
    </div>
  );
}
