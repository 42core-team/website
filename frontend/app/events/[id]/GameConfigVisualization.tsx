"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  Title,
  Tooltip,
} from "chart.js";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { Bar, Radar } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
);

interface UnitConfig {
  name: string;
  cost: number;
  hp: number;
  baseActionCooldown: number;
  maxActionCooldown: number;
  balancePerCooldownStep: number;
  damageCore: number;
  damageUnit: number;
  damageDeposit: number;
  damageWall: number;
  damageBomb: number;
  buildType: string;
}

interface GameConfig {
  gridSize: number;
  idleIncome: number;
  idleIncomeTimeOut: number;
  depositHp: number;
  depositIncome: number;
  gemPileIncome: number;
  coreHp: number;
  coreSpawnCooldown: number;
  initialBalance: number;
  wallHp: number;
  wallBuildCost: number;
  bombHp: number;
  bombCountdown: number;
  bombThrowCost: number;
  bombReach: number;
  bombDamageCore: number;
  bombDamageUnit: number;
  bombDamageDeposit: number;
  units: UnitConfig[];
  corePositions: { x: number; y: number }[];
}

const CHART_COLORS = [
  { bg: "rgba(59, 130, 246, 0.5)", border: "rgb(59, 130, 246)" }, // Blue
  { bg: "rgba(239, 68, 68, 0.5)", border: "rgb(239, 68, 68)" }, // Red
  { bg: "rgba(34, 197, 94, 0.5)", border: "rgb(34, 197, 94)" }, // Green
  { bg: "rgba(245, 158, 11, 0.5)", border: "rgb(245, 158, 11)" }, // Amber
  { bg: "rgba(168, 85, 247, 0.5)", border: "rgb(168, 85, 247)" }, // Purple
  { bg: "rgba(236, 72, 153, 0.5)", border: "rgb(236, 72, 153)" }, // Pink
  { bg: "rgba(6, 182, 212, 0.5)", border: "rgb(6, 182, 212)" }, // Cyan
];

export default function GameConfigVisualization({ gameConfigRaw }: { gameConfigRaw: string }) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const config = useMemo(() => {
    try {
      // Remove comments from JSON if any
      const cleanJson = gameConfigRaw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      return JSON.parse(cleanJson) as GameConfig;
    }
    catch (e) {
      console.error("Failed to parse game config for visualization", e);
      return null;
    }
  }, [gameConfigRaw]);

  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark");
  const gridColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
  const textColor = isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)";
  const tooltipBg = isDark ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.9)";
  const tooltipTextColor = isDark ? "#fff" : "#000";

  if (!config) {
    return <div className="text-sm text-muted-foreground">Unable to parse game configuration for visualization.</div>;
  }

  const unitNames = config.units.map(u => u.name);

  const costData = {
    labels: unitNames,
    datasets: [
      {
        label: "Cost",
        data: config.units.map(u => u.cost),
        backgroundColor: CHART_COLORS.map(c => c.bg),
        borderColor: CHART_COLORS.map(c => c.border),
        borderWidth: 1,
      },
    ],
  };

  const hpData = {
    labels: unitNames,
    datasets: [
      {
        label: "HP",
        data: config.units.map(u => u.hp),
        backgroundColor: CHART_COLORS.map(c => c.bg),
        borderColor: CHART_COLORS.map(c => c.border),
        borderWidth: 1,
      },
    ],
  };

  const cooldownData = {
    labels: unitNames,
    datasets: [
      {
        label: "Base Cooldown",
        data: config.units.map(u => u.baseActionCooldown),
        backgroundColor: CHART_COLORS.map(c => c.bg),
        borderColor: CHART_COLORS.map(c => c.border),
        borderWidth: 1,
      },
    ],
  };

  const dpsData = {
    labels: unitNames,
    datasets: [
      {
        label: "Unit DPS",
        data: config.units.map((u) => {
          const cooldown = Math.max(1, u.baseActionCooldown);
          return Number((u.damageUnit / cooldown).toFixed(2));
        }),
        backgroundColor: CHART_COLORS.map(c => c.bg),
        borderColor: CHART_COLORS.map(c => c.border),
        borderWidth: 1,
      },
    ],
  };

  const efficiencyData = {
    labels: unitNames,
    datasets: [
      {
        label: "Combat Efficiency (HP * Dmg / Cost)",
        data: config.units.map((u) => {
          const cooldown = Math.max(1, u.baseActionCooldown);
          const dps = u.damageUnit / cooldown;
          return Number(((u.hp * dps) / u.cost * 100).toFixed(2));
        }),
        backgroundColor: CHART_COLORS.map(c => c.bg),
        borderColor: CHART_COLORS.map(c => c.border),
        borderWidth: 1,
      },
    ],
  };

  const maxCooldownData = {
    labels: unitNames,
    datasets: [
      {
        label: "Max Cooldown",
        data: config.units.map(u => u.maxActionCooldown),
        backgroundColor: CHART_COLORS.map(c => c.bg),
        borderColor: CHART_COLORS.map(c => c.border),
        borderWidth: 1,
      },
    ],
  };

  const balanceData = {
    labels: unitNames,
    datasets: [
      {
        label: "Gems per cooldown increase",
        data: config.units.map(u => u.balancePerCooldownStep),
        backgroundColor: CHART_COLORS.map(c => c.bg),
        borderColor: CHART_COLORS.map(c => c.border),
        borderWidth: 1,
      },
    ],
  };

  const radarData = {
    labels: ["Core Dmg", "Unit Dmg", "Deposit Dmg", "Wall Dmg", "Bomb Dmg"],
    datasets: config.units.map((unit, i) => ({
      label: unit.name,
      data: [
        unit.damageCore,
        unit.damageUnit,
        unit.damageDeposit,
        unit.damageWall,
        unit.damageBomb,
      ],
      backgroundColor: CHART_COLORS[i % CHART_COLORS.length].bg.replace("0.5", "0.2"),
      borderColor: CHART_COLORS[i % CHART_COLORS.length].border,
      borderWidth: 2,
    })),
  };

  const commonBarOptions = {
    maintainAspectRatio: false,
    scales: {
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { size: 12 } },
      },
      x: {
        ticks: { color: textColor, font: { size: 12 } },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipTextColor,
        bodyColor: tooltipTextColor,
        titleFont: { size: 14 },
        bodyFont: { size: 13 },
        padding: 10,
        cornerRadius: 4,
      },
    },
  };

  return (
    <div className="mt-1 flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="border-border bg-background/50">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-semibold">
              Map Layout (
              {config.gridSize}
              x
              {config.gridSize}
              )
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-[400px] flex-col items-center justify-center gap-6 p-6">
            <div
              className="relative border border-border bg-muted/20"
              style={{
                width: "350px",
                height: "350px",
                display: "grid",
                gridTemplateColumns: `repeat(${config.gridSize}, 1fr)`,
                gridTemplateRows: `repeat(${config.gridSize}, 1fr)`,
              }}
            >
              {config.corePositions.map((pos, i) => (
                <div
                  key={i}
                  className="rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                  style={{
                    gridColumnStart: pos.x + 1,
                    gridRowStart: pos.y + 1,
                    width: "100%",
                    height: "100%",
                  }}
                  title={`Core ${i + 1}: (${pos.x}, ${pos.y})`}
                />
              ))}
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `linear-gradient(to right, ${isDark ? "white" : "black"} 1px, transparent 1px), linear-gradient(to bottom, ${isDark ? "white" : "black"} 1px, transparent 1px)`,
                  backgroundSize: `${350 / config.gridSize}px ${350 / config.gridSize}px`,
                }}
              />
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="size-4 rounded-full bg-primary" />
              <span>Core Positions</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-background/50">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-semibold">Unit Damage Comparison</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px] p-6">
            <Radar
              data={radarData}
              options={{
                maintainAspectRatio: false,
                scales: {
                  r: {
                    grid: { color: gridColor },
                    angleLines: { color: gridColor },
                    pointLabels: { color: textColor, font: { size: 12, weight: "bold" } },
                    ticks: { display: false },
                  },
                },
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: { color: textColor, boxWidth: 12, font: { size: 12 }, padding: 20 },
                  },
                  tooltip: {
                    backgroundColor: tooltipBg,
                    titleColor: tooltipTextColor,
                    bodyColor: tooltipTextColor,
                    padding: 10,
                  },
                },
              }}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        <Card className="border-white/10 bg-background/50">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-semibold">Unit Cost</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] p-6">
            <Bar data={costData} options={commonBarOptions} />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-background/50">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-semibold">Unit HP</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] p-6">
            <Bar data={hpData} options={commonBarOptions} />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-background/50">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-semibold">Base Cooldown</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] p-6">
            <Bar data={cooldownData} options={commonBarOptions} />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-background/50">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-semibold">Estimated DPS</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] p-6">
            <Bar data={dpsData} options={commonBarOptions} />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-background/50">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-semibold">Combat Efficiency</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] p-6">
            <Bar data={efficiencyData} options={commonBarOptions} />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-background/50">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-semibold">Max Cooldown</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] p-6">
            <Bar data={maxCooldownData} options={commonBarOptions} />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-background/50">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-semibold">Balance Per Step</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] p-6">
            <Bar data={balanceData} options={commonBarOptions} />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-background/50">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-semibold">Global Game Settings</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto p-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Core HP</span>
                <span className="font-mono text-white">{config.coreHp}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Wall HP</span>
                <span className="font-mono text-white">{config.wallHp}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Initial Balance</span>
                <span className="font-mono text-white">{config.initialBalance}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Spawn Cooldown</span>
                <span className="font-mono text-white">{config.coreSpawnCooldown}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Idle Income</span>
                <span className="font-mono text-white">
                  {config.idleIncome}
                  {" "}
                  (until
                  {" "}
                  {config.idleIncomeTimeOut}
                  )
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Wall Cost</span>
                <span className="font-mono text-white">{config.wallBuildCost}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-background/50">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-semibold">Bomb Settings</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto p-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Bomb HP</span>
                <span className="font-mono text-white">{config.bombHp}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Bomb Reach</span>
                <span className="font-mono text-white">{config.bombReach}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Throw Cost</span>
                <span className="font-mono text-white">{config.bombThrowCost}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Countdown</span>
                <span className="font-mono text-white">{config.bombCountdown}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-background/50">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-semibold">Unit Capabilities</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto p-6">
            <div className="flex flex-col gap-3">
              {config.units.map((u, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span style={{ color: CHART_COLORS[i % CHART_COLORS.length].border }} className="font-medium">{u.name}</span>
                  <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">
                    Build:
                    {" "}
                    <span className="text-white">{u.buildType}</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
