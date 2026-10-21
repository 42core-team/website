import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Code2,
  GitBranch,
  Terminal,
  Trophy,
  Users,
} from 'lucide-react'
import type { Event } from '@/app/actions/event'
import Image from '@/components/app-image'
import Link from '@/components/app-link'
import GlobalStats from '@/components/GlobalStats'
import { GithubIcon, WikiIcon } from '@/components/icons'
import { CoreLogoWhite } from '@/components/social'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getVisualizerUrl } from '@/lib/env'
import { eventState, lifecycleLabels } from '@/lib/event-lifecycle'
import WorldChampionshipBanner from '@/components/world-championship-banner'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const unitComponents = [
  {
    id: 'sword',
    label: 'Unit Attack',
    stat: '+damageUnit',
    src: '/images/game/units/sword/1.svg',
  },
  {
    id: 'axe',
    label: 'Core Attack',
    stat: '+damageCore',
    src: '/images/game/units/axe/1.svg',
  },
  {
    id: 'pickaxe',
    label: 'Mining',
    stat: '+damageObject',
    src: '/images/game/units/pickaxe/1.svg',
  },
  {
    id: 'shield',
    label: 'Armor',
    stat: '+damageReduction',
    src: '/images/game/units/shield/1.svg',
  },
  {
    id: 'heart',
    label: 'Health',
    stat: '+hp',
    src: '/images/game/units/heart/1.svg',
  },
  {
    id: 'lightning',
    label: 'Speed',
    stat: '-actionCooldown',
    src: '/images/game/units/lightning/1.svg',
  },
  {
    id: 'bag',
    label: 'Gem Capacity',
    stat: '+maxGems',
    src: '/images/game/units/bag/1.svg',
  },
  {
    id: 'feather',
    label: 'Carry Efficiency',
    stat: '+gemsPerStep',
    src: '/images/game/units/feather/1.svg',
  },
]

const howToPlaySteps = [
  {
    step: '01',
    title: 'Join an Event & Create a Team',
    description:
      'Sign in on the website, join an active event, and form a team. You automatically get your own pre-configured GitHub repository for your bot.',
    icon: Users,
    badge: 'Repository generated automatically',
  },
  {
    step: '02',
    title: 'Clone & Run Locally',
    description:
      'Clone your repo, run make devcontainer, and compile with make. A local game server and visualizer open at localhost:4000 so you can watch replays right away.',
    icon: Terminal,
    badge: 'Local server + visualizer',
  },
  {
    step: '03',
    title: 'Design Units & Write Your Code',
    description:
      'Assemble custom units in the event Unit Builder and program your bot in C or Go using the CORE client library to mine gems, pathfind, and attack.',
    icon: Code2,
    badge: 'C or Go supported',
  },
  {
    step: '04',
    title: 'Push to Main & Compete',
    description:
      'Push your code to the main branch to deploy it on the website. Jump into the matchmaking Queue to test against other bots before the Tournament begins.',
    icon: Trophy,
    badge: 'Queue & Tournament matches',
  },
]

type VisualizerBar = {
  key: 'hp' | 'gems' | 'cooldown'
  percentage: number
}

type VisualizerBoardObject = {
  x: number
  y: number
  type: 'core' | 'unit' | 'deposit' | 'wall' | 'gem'
  team?: 1 | 2 // 1 = top-left orange, 2 = bottom-right purple
  unitAsset?: 'sword' | 'axe' | 'pickaxe' | 'shield'
  bars: VisualizerBar[]
}

const arenaBoardObjects: VisualizerBoardObject[] = [
  // Team 1 Core at (0, 0) - top-left orange
  {
    x: 0,
    y: 0,
    type: 'core',
    team: 1,
    bars: [
      { key: 'gems', percentage: 65 },
      { key: 'cooldown', percentage: 35 },
    ],
  },
  // Team 1 Miner harvesting deposit near base
  {
    x: 1,
    y: 2,
    type: 'unit',
    team: 1,
    unitAsset: 'pickaxe',
    bars: [
      { key: 'gems', percentage: 70 },
      { key: 'cooldown', percentage: 50 },
    ],
  },
  // Damaged Deposit being mined at (1, 3)
  {
    x: 1,
    y: 3,
    type: 'deposit',
    bars: [{ key: 'hp', percentage: 45 }],
  },
  // Dropped Gem Pile at (2, 1)
  {
    x: 2,
    y: 1,
    type: 'gem',
    bars: [],
  },
  // Team 1 Shield defender at (2, 3)
  {
    x: 2,
    y: 3,
    type: 'unit',
    team: 1,
    unitAsset: 'shield',
    bars: [
      { key: 'hp', percentage: 80 },
      { key: 'cooldown', percentage: 25 },
    ],
  },
  // Team 1 Sword warrior clashing mid-board at (3, 4)
  {
    x: 3,
    y: 4,
    type: 'unit',
    team: 1,
    unitAsset: 'sword',
    bars: [
      { key: 'hp', percentage: 75 },
      { key: 'cooldown', percentage: 60 },
    ],
  },
  // Team 1 Axe Core-breaker advancing on enemy Core at (5, 6)
  {
    x: 5,
    y: 6,
    type: 'unit',
    team: 1,
    unitAsset: 'axe',
    bars: [{ key: 'cooldown', percentage: 40 }],
  },
  // Map Walls & Deposits
  { x: 3, y: 2, type: 'wall', bars: [] },
  { x: 4, y: 2, type: 'wall', bars: [{ key: 'hp', percentage: 60 }] },
  { x: 3, y: 5, type: 'wall', bars: [] },
  { x: 6, y: 3, type: 'deposit', bars: [] },
  { x: 5, y: 2, type: 'gem', bars: [] },
  // Team 2 Units defending bottom-right
  {
    x: 4,
    y: 4,
    type: 'unit',
    team: 2,
    unitAsset: 'sword',
    bars: [
      { key: 'hp', percentage: 40 },
      { key: 'cooldown', percentage: 80 },
    ],
  },
  {
    x: 6,
    y: 5,
    type: 'unit',
    team: 2,
    unitAsset: 'shield',
    bars: [
      { key: 'hp', percentage: 55 },
      { key: 'cooldown', percentage: 30 },
    ],
  },
  // Team 2 Core at (7, 7) - bottom-right purple, taking damage!
  {
    x: 7,
    y: 7,
    type: 'core',
    team: 2,
    bars: [
      { key: 'hp', percentage: 42 },
      { key: 'gems', percentage: 30 },
    ],
  },
]

function ArenaObjectiveVisual({ isLight }: { isLight: boolean }) {
  const GRID_SIZE = 8
  const barColors = {
    hp: isLight ? '#e55252' : '#b60000',
    gems: isLight ? '#49c485' : '#2a9a60',
    cooldown: isLight ? '#6cb3ff' : '#1560bc',
  }
  const team1Fill = isLight ? '#995708' : '#ebb26c'
  const team2Fill = isLight ? '#6f20a8' : '#c98bf2'
  const neutralFill = isLight ? 'hsl(220 20% 18%)' : 'hsl(220 15% 85%)'
  const gridBg = isLight ? '#f7f2fb' : '#130b1a'
  const tlStop = isLight ? '#f6dec5' : '#2b1a1c'
  const brStop = isLight ? '#e2ccf4' : '#251433'
  const outlineColor = isLight ? '#b47ede' : '#9c59d1'
  const gridLineColor = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.32)'

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-3xl border bg-muted/40 p-5 shadow-inner sm:p-7">
      <div className="mb-3 flex w-full max-w-md items-center justify-between font-mono text-xs font-bold">
        <span
          className="rounded-lg border px-2.5 py-1"
          style={{
            borderColor: outlineColor,
            backgroundColor: isLight ? '#f9f5fc' : '#261633',
          }}
        >
          🟠 Your Bot (1)
        </span>
        <span
          className="rounded-lg border px-2.5 py-1"
          style={{
            borderColor: outlineColor,
            backgroundColor: isLight ? '#f9f5fc' : '#261633',
          }}
        >
          🟣 Opponent (2)
        </span>
      </div>

      <div
        className="w-full max-w-md overflow-hidden rounded-[10px] shadow-lg"
        style={{
          outline: `2px solid ${outlineColor}`,
          backgroundImage: `linear-gradient(to bottom right, ${tlStop} 0%, ${gridBg} 50%, ${brStop} 100%)`,
        }}
      >
        <svg
          viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}
          className="aspect-square h-full w-full block"
          aria-label="CORE Game visualizer arena board"
        >
          <defs>
            <symbol id="viz-core-1" viewBox="0 0 512 512">
              <path d="M 136.0,16.0 C 123.0,16.0 112.0,27.0 112.0,40.0 L 112.0,208.0 L 64.0,208.0 L 64.0,168.0 C 64.0,155.0 53.0,144.0 40.0,144.0 L 24.0,144.0 C 11.0,144.0 0.0,155.0 0.0,168.0 L 0.0,248.0 C 0.0,249.0 0.0,250.0 0.0,251.0 C 0.0,253.0 0.0,254.0 0.0,256.0 L 0.0,432.0 C 0.0,467.0 29.0,496.0 64.0,496.0 L 448.0,496.0 C 483.0,496.0 512.0,467.0 512.0,432.0 L 512.0,256.0 C 512.0,254.0 512.0,253.0 512.0,251.0 C 512.0,250.0 512.0,249.0 512.0,248.0 L 512.0,168.0 C 512.0,155.0 501.0,144.0 488.0,144.0 L 472.0,144.0 C 459.0,144.0 448.0,155.0 448.0,168.0 L 448.0,208.0 L 400.0,208.0 L 400.0,40.0 C 400.0,27.0 389.0,16.0 376.0,16.0 L 360.0,16.0 C 347.0,16.0 336.0,27.0 336.0,40.0 L 336.0,80.0 L 288.0,80.0 L 288.0,40.0 C 288.0,27.0 277.0,16.0 264.0,16.0 L 248.0,16.0 C 235.0,16.0 224.0,27.0 224.0,40.0 L 224.0,80.0 L 176.0,80.0 L 176.0,40.0 C 176.0,27.0 165.0,16.0 152.0,16.0 L 136.0,16.0 M 192.0,368.0 C 192.0,333.0 221.0,304.0 256.0,304.0 C 291.0,304.0 320.0,333.0 320.0,368.0 L 320.0,448.0 L 192.0,448.0 L 192.0,368.0" />
            </symbol>
            <symbol id="viz-core-2" viewBox="0 0 512 512">
              <path d="M 160.0,40.0 C 160.0,27.0 149.0,16.0 136.0,16.0 C 123.0,16.0 112.0,27.0 112.0,40.0 L 112.0,192.0 L 48.0,192.0 L 48.0,168.0 C 48.0,155.0 37.0,144.0 24.0,144.0 C 11.0,144.0 0.0,155.0 0.0,168.0 L 0.0,432.0 C 0.0,467.0 29.0,496.0 64.0,496.0 L 448.0,496.0 C 483.0,496.0 512.0,467.0 512.0,432.0 L 512.0,168.0 C 512.0,155.0 501.0,144.0 488.0,144.0 C 475.0,144.0 464.0,155.0 464.0,168.0 L 464.0,192.0 L 400.0,192.0 L 400.0,40.0 C 400.0,27.0 389.0,16.0 376.0,16.0 C 363.0,16.0 352.0,27.0 352.0,40.0 L 352.0,80.0 L 280.0,80.0 L 280.0,40.0 C 280.0,27.0 269.0,16.0 256.0,16.0 C 243.0,16.0 232.0,27.0 232.0,40.0 L 232.0,80.0 L 160.0,80.0 L 160.0,40.0 M 160.0,128.0 L 352.0,128.0 L 352.0,216.0 C 352.0,229.0 363.0,240.0 376.0,240.0 L 464.0,240.0 L 464.0,432.0 C 464.0,441.0 457.0,448.0 448.0,448.0 L 320.0,448.0 L 320.0,368.0 C 320.0,333.0 291.0,304.0 256.0,304.0 C 221.0,304.0 192.0,333.0 192.0,368.0 L 192.0,448.0 L 64.0,448.0 C 55.0,448.0 48.0,441.0 48.0,432.0 L 48.0,240.0 L 136.0,240.0 C 149.0,240.0 160.0,229.0 160.0,216.0 L 160.0,128.0" />
            </symbol>
            <symbol id="viz-deposit" viewBox="0 0 512 512">
              <path d="m 168.15891,228.58035 -33.46107,-53.13608 11.81148,-112.128717 37.38264,74.765277 -15.73424,90.50073 z" />
              <path d="M 300.89062 2.0488281 L 208.4082 116.14648 L 181.84375 247.01367 L 228.08984 308.97656 L 252.6875 235.19336 L 259.04492 244.86914 L 263.02148 183.55273 L 217.91211 167.38281 L 263.25781 161.86719 L 269.81641 118.58789 L 280.94727 161.86719 L 308.97852 158.01758 L 284.24023 180.875 L 263.7832 252.07812 L 297.94141 304.06055 L 368.77734 231.27148 L 376.63867 104.35156 L 300.89062 2.0488281 z M 263.7832 252.07812 L 259.04492 244.86914 L 257.06055 275.47266 L 263.7832 252.07812 z " />
              <path d="m 334.657,361.13 27.27,-32.52 9.98,-40.923 -25.183,32.52 z" />
              <path d="m 356.01079,405.36376 -20.43004,-2.55315 -10.21262,-52.36426 -17.14106,-32.1383 110.18535,-110.18414 37.39104,11.79349 -15.74265,88.54295 -84.04882,96.90221 z" />
              <path d="m 181.16355,439.88115 -34.77427,-2.69119 -77.014736,-126.50536 -4.979071,-99.52138 94.183407,36.41874 61.33812,81.5833 -19.68342,75.56472 -75.74836,-99.68464 56.68074,134.83581 z" />
              <path d="M 292.49643,511.1294 266.92528,353.72692 251.18143,507.18863 198.05614,477.66831 256.90232,274.87202 306.2633,355.6919 329.86827,465.87483 292.49643,511.1282 Z" />
            </symbol>
            <symbol id="viz-wall" viewBox="0 0 448 448">
              <path d="M 30 0 L 30 75 L 224 75 L 224 0 L 30 0 z M 254 0 L 254 75 L 448 75 L 448 0 L 254 0 z M 0 105 L 0 225 L 150 225 L 150 105 L 0 105 z M 180 105 L 180 225 L 374 225 L 374 105 L 180 105 z M 404 105 L 404 225 L 448 225 L 448 105 L 404 105 z M 0 255 L 0 373 L 76 373 L 76 255 L 0 255 z M 106 255 L 106 373 L 300 373 L 300 255 L 106 255 z M 330 255 L 330 373 L 448 373 L 448 255 L 330 255 z M 30 403 L 30 448 L 224 448 L 224 403 L 30 403 z M 254 403 L 254 448 L 448 448 L 448 403 L 254 403 z " />
            </symbol>
            <symbol id="viz-gem" viewBox="0 0 640 640">
              <path d="M180.7 97.8C185.2 91.7 192.4 88 200 88L440 88C447.6 88 454.8 91.6 459.3 97.8L571.3 249.8C578.1 259 577.4 271.7 569.8 280.2L337.8 536.2C333.3 541.2 326.8 544.1 320 544.1C313.2 544.1 306.8 541.2 302.2 536.2L70.2 280.2C62.5 271.7 61.9 259 68.7 249.8L180.7 97.8zM219.2 137.6C215.9 140.1 215 144.6 217.1 148.1L274.5 243.8L127.3 256C123.2 256.3 120 259.8 120 264C120 268.2 123.2 271.6 127.3 272L319.3 288C319.7 288 320.2 288 320.6 288L512.6 272C516.7 271.7 519.9 268.2 519.9 264C519.9 259.8 516.7 256.4 512.6 256L365.4 243.7L422.8 148.1C424.9 144.6 424 140 420.7 137.6C417.4 135.2 412.8 135.6 410 138.6L320 236.2L229.9 138.6C227.1 135.6 222.5 135.2 219.2 137.6z" />
            </symbol>
            <symbol id="viz-unit-sword-1" viewBox="0 0 546.75 546.75">
              <path d="M 441.75,9.0 L 188.75,262.0 L 284.75,358.0 L 537.75,105.0 C 543.75,99.0 546.75,91.0 546.75,83.0 L 546.75,16.0 C 546.75,7.0 539.75,0.0 530.75,0.0 L 464.75,0.0 C 455.75,0.0 447.75,3.0 441.75,9.0 M 32.75,432.0 C 23.75,432.0 15.75,435.0 9.75,441.0 C -3.25,454.0 -3.25,474.0 9.75,487.0 L 60.75,537.0 C 72.75,550.0 92.75,550.0 105.75,537.0 C 111.75,531.0 114.75,523.0 114.75,515.0 L 114.75,480.0 L 162.75,432.0 L 258.75,473.0 C 268.75,477.0 279.75,475.0 287.75,467.0 C 298.75,457.0 298.75,440.0 287.75,429.0 L 117.75,259.0 C 107.75,249.0 90.75,249.0 79.75,259.0 C 71.75,267.0 69.75,279.0 73.75,289.0 L 114.75,384.0 L 66.75,432.0 L 32.75,432.0" />
            </symbol>
            <symbol id="viz-unit-sword-2" viewBox="0 0 546.75 546.75">
              <path d="M 258.75,400.0 L 287.75,429.0 C 298.75,439.0 298.75,457.0 287.75,467.0 C 279.75,475.0 268.75,477.0 257.75,473.0 L 162.75,432.0 L 114.75,480.0 L 114.75,515.0 C 114.75,523.0 111.75,531.0 105.75,537.0 C 92.75,550.0 72.75,550.0 60.75,537.0 L 9.75,487.0 C -3.25,474.0 -3.25,454.0 9.75,441.0 C 15.75,435.0 23.75,432.0 32.75,432.0 L 66.75,432.0 L 114.75,384.0 L 73.75,289.0 C 69.75,279.0 71.75,267.0 79.75,259.0 C 90.75,249.0 107.75,249.0 117.75,259.0 L 146.75,288.0 L 425.75,9.0 C 431.75,3.0 439.75,0.0 448.75,0.0 L 530.75,0.0 C 539.75,0.0 546.75,7.0 546.75,16.0 L 546.75,99.0 C 546.75,107.0 543.75,115.0 537.75,121.0 L 258.75,400.0 M 224.75,366.0 L 498.75,92.0 L 498.75,48.0 L 454.75,48.0 L 180.75,322.0 L 224.75,366.0" />
            </symbol>
            <symbol id="viz-unit-axe-2" viewBox="0 0 605.25 605.25">
              <path d="M 454.25,54.875 L 502.25,102.875 C 511.25,111.875 511.25,127.875 502.25,136.875 C 493.25,145.875 477.25,145.875 468.25,136.875 L 420.25,88.875 C 411.25,79.875 411.25,63.875 420.25,54.875 C 429.25,45.875 445.25,45.875 454.25,54.875 M 457.25,239.875 L 317.25,99.875 L 241.25,175.875 L 381.25,315.875 C 391.25,325.875 397.25,339.875 397.25,354.875 L 397.25,414.875 C 481.25,407.875 549.25,340.875 556.25,255.875 L 496.25,255.875 C 481.25,255.875 467.25,249.875 457.25,239.875 M 351.25,65.875 L 491.25,205.875 C 492.25,206.875 494.25,207.875 496.25,207.875 L 581.25,207.875 C 594.25,207.875 605.25,218.875 605.25,231.875 L 605.25,239.875 C 605.25,363.875 505.25,463.875 381.25,463.875 L 373.25,463.875 C 360.25,463.875 349.25,452.875 349.25,439.875 L 349.25,354.875 C 349.25,352.875 348.25,350.875 347.25,349.875 L 326.25,328.875 L 118.25,536.875 C 91.25,563.875 47.25,563.875 20.25,536.875 C -6.75,509.875 -6.75,465.875 20.25,438.875 L 228.25,230.875 L 207.25,209.875 C 188.25,190.875 188.25,160.875 207.25,141.875 L 283.25,65.875 C 302.25,46.875 332.25,46.875 351.25,65.875 M 262.25,264.875 L 54.25,472.875 C 46.25,480.875 46.25,494.875 54.25,502.875 C 62.25,510.875 76.25,510.875 84.25,502.875 L 292.25,294.875 L 262.25,264.875" />
            </symbol>
            <symbol id="viz-unit-pickaxe-2" viewBox="0 0 543.75 543.75">
              <path d="M 495.75,256.0 C 495.75,276.0 492.75,296.0 487.75,315.0 C 432.75,203.0 341.75,111.0 228.75,56.0 C 247.75,51.0 267.75,48.0 287.75,48.0 C 402.75,48.0 495.75,141.0 495.75,256.0 M 512.75,378.0 L 513.75,377.0 C 532.75,341.0 543.75,300.0 543.75,256.0 C 543.75,194.0 521.75,137.0 484.75,93.0 L 504.75,73.0 C 513.75,64.0 513.75,48.0 504.75,39.0 C 495.75,30.0 479.75,30.0 470.75,39.0 L 450.75,59.0 C 406.75,22.0 349.75,0.0 287.75,0.0 C 243.75,0.0 202.75,11.0 166.75,30.0 L 165.75,31.0 C 162.75,32.0 160.75,34.0 157.75,35.0 C 151.75,39.0 145.75,43.0 139.75,47.0 C 129.75,54.0 132.75,70.0 144.75,74.0 C 151.75,76.0 157.75,78.0 163.75,81.0 C 165.75,81.0 168.75,82.0 170.75,83.0 L 171.75,84.0 C 229.75,107.0 282.75,140.0 328.75,182.0 L 6.75,503.0 C -2.25,512.0 -2.25,528.0 6.75,537.0 C 15.75,546.0 31.75,546.0 40.75,537.0 L 362.75,215.0 C 403.75,261.0 437.75,314.0 460.75,372.0 L 460.75,373.0 C 461.75,375.0 462.75,378.0 463.75,380.0 C 465.75,386.0 467.75,393.0 469.75,399.0 C 473.75,411.0 489.75,414.0 496.75,404.0 C 500.75,398.0 504.75,392.0 508.75,386.0 C 509.75,383.0 511.75,381.0 512.75,378.0" />
            </symbol>
            <symbol id="viz-unit-shield-1" viewBox="0 0 509 509">
              <path d="M 254.5,0.0 C 259.5,0.0 263.5,1.0 267.5,3.0 L 456.5,83.0 C 478.5,92.0 494.5,114.0 494.5,140.0 C 494.5,239.0 453.5,421.0 281.5,503.0 C 264.5,511.0 244.5,511.0 228.5,503.0 C 55.5,421.0 15.5,239.0 14.5,140.0 C 14.5,114.0 30.5,92.0 52.5,83.0 L 241.5,3.0 C 245.5,1.0 249.5,0.0 254.5,0.0" />
            </symbol>
            <symbol id="viz-unit-shield-2" viewBox="0 0 509 509">
              <path d="M 254.5,49.0 L 71.5,127.0 C 65.5,130.0 62.5,135.0 62.5,140.0 C 63.5,231.0 101.5,389.0 249.5,460.0 C 252.5,462.0 256.5,462.0 260.5,460.0 C 408.5,389.0 446.5,231.0 446.5,140.0 C 446.5,135.0 443.5,130.0 437.5,127.0 L 254.5,49.0 M 267.5,3.0 L 456.5,83.0 C 478.5,92.0 494.5,114.0 494.5,140.0 C 494.5,239.0 453.5,421.0 281.5,503.0 C 264.5,511.0 244.5,511.0 228.5,503.0 C 55.5,421.0 15.5,239.0 14.5,140.0 C 14.5,114.0 30.5,92.0 52.5,83.0 L 241.5,3.0 C 245.5,1.0 249.5,0.0 254.5,0.0 C 259.5,0.0 263.5,1.0 267.5,3.0" />
            </symbol>
          </defs>

          {/* Gridlines matching visualizer */}
          {Array.from({ length: GRID_SIZE - 1 }, (_, i) => i + 1).map(
            (line) => (
              <g key={line}>
                <line
                  x1={line}
                  y1={0}
                  x2={line}
                  y2={GRID_SIZE}
                  stroke={gridLineColor}
                  strokeWidth={0.03}
                />
                <line
                  x1={0}
                  y1={line}
                  x2={GRID_SIZE}
                  y2={line}
                  stroke={gridLineColor}
                  strokeWidth={0.03}
                />
              </g>
            ),
          )}

          {/* Objects rendered using exact visualizer objectRenderer.ts rules */}
          {arenaBoardObjects.map((obj) => {
            const count = obj.bars.length
            const symbolId =
              obj.type === 'core'
                ? obj.team === 1
                  ? 'viz-core-2'
                  : 'viz-core-1'
                : obj.type === 'unit'
                  ? `viz-unit-${obj.unitAsset}-${obj.team === 1 ? '2' : '1'}`
                  : `viz-${obj.type}`

            const scale =
              obj.type === 'deposit'
                ? 0.95
                : obj.type === 'wall'
                  ? 1
                  : obj.type === 'gem'
                    ? 0.6
                    : 0.8
            const offset = (1 - scale) / 2
            const baseTransform = `translate(${obj.x + offset},${obj.y + offset}) scale(${scale})`
            const finalTransform =
              obj.type === 'unit' && obj.team === 1
                ? `${baseTransform} translate(1,0) scale(-1,1)`
                : baseTransform

            const fill =
              obj.team === 1
                ? team1Fill
                : obj.team === 2
                  ? team2Fill
                  : neutralFill

            return (
              <g key={`${obj.x}-${obj.y}`}>
                {obj.bars.map((bar, index) => {
                  const h = 1 / count
                  const top = obj.y + index * h
                  const width = bar.percentage / 100
                  const color = barColors[bar.key]
                  return (
                    <g key={bar.key}>
                      <rect
                        x={obj.x}
                        y={top}
                        width={1}
                        height={h}
                        fill={color}
                        fillOpacity={0.2}
                      />
                      <rect
                        x={obj.x}
                        y={top}
                        width={width}
                        height={h}
                        fill={color}
                        fillOpacity={1}
                      />
                    </g>
                  )
                })}
                <use
                  href={`#${symbolId}`}
                  width={1}
                  height={1}
                  fill={fill}
                  transform={finalTransform}
                />
              </g>
            )
          })}

          {/* Debug path overlay matching drawHoveredDebugPathOverlay in renderer.ts */}
          <polyline
            points="3.5,4.5 4.5,4.5 4.5,6.5 5.5,6.5 6.5,6.5 6.5,7.5 7.5,7.5"
            fill="none"
            stroke={team1Fill}
            strokeOpacity={0.9}
            strokeWidth={0.07}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-4 rounded-xs"
            style={{ backgroundColor: barColors.hp }}
          />
          HP
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-4 rounded-xs"
            style={{ backgroundColor: barColors.gems }}
          />
          Gems
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-4 rounded-xs"
            style={{ backgroundColor: barColors.cooldown }}
          />
          Cooldown
        </span>
      </div>
    </div>
  )
}

function EconomyAndUnitBuilderVisual() {
  return (
    <div className="flex w-full flex-col gap-4 rounded-3xl border bg-muted/40 p-5 shadow-inner sm:p-7">
      {/* Resource Loop */}
      <div className="rounded-2xl border bg-background/80 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Resource Economy
          </span>
          <Badge variant="outline" className="font-mono text-[11px]">
            💎 Gems fund every unit
          </Badge>
        </div>
        <div className="grid grid-cols-3 items-center gap-2 text-center sm:gap-3">
          <div className="flex flex-col items-center rounded-xl border bg-muted/35 p-3">
            <Image
              src="/images/game/deposit.svg"
              alt="Gem Deposit"
              width={48}
              height={48}
              className="size-9 object-contain sm:size-10 dark:invert"
            />
            <span className="mt-2 text-xs font-semibold">1. Mine Deposit</span>
            <span className="text-[11px] text-muted-foreground">
              Attack rock with Miner
            </span>
          </div>

          <div className="flex flex-col items-center rounded-xl border bg-muted/35 p-3">
            <Image
              src="/images/game/gem_pile.svg"
              alt="Gem Pile"
              width={48}
              height={48}
              className="size-9 object-contain sm:size-10 dark:invert"
            />
            <span className="mt-2 text-xs font-semibold">2. Collect Gems</span>
            <span className="text-[11px] text-muted-foreground">
              Pick up dropped pile
            </span>
          </div>

          <div className="flex flex-col items-center rounded-xl border bg-muted/35 p-3">
            <Image
              src="/images/game/cores/1.svg"
              alt="Core Base"
              width={48}
              height={48}
              className="size-9 object-contain sm:size-10 dark:invert"
            />
            <span className="mt-2 text-xs font-semibold">3. Transfer Home</span>
            <span className="text-[11px] text-muted-foreground">
              Deliver gems to Core
            </span>
          </div>
        </div>
      </div>

      {/* Unit Builder Components */}
      <div className="rounded-2xl border bg-background/80 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Modular Unit Components
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            3,000+ combinations
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {unitComponents.map((comp) => (
            <div
              key={comp.id}
              className="flex flex-col items-center rounded-xl border bg-card p-2.5 text-center shadow-2xs transition-transform hover:-translate-y-0.5"
            >
              <Image
                src={comp.src}
                alt={comp.label}
                width={36}
                height={36}
                className="size-7 object-contain sm:size-8 dark:invert"
              />
              <span className="mt-1.5 max-w-full truncate text-[11px] font-semibold">
                {comp.label}
              </span>
              <span className="max-w-full truncate font-mono text-[9px] text-emerald-600 dark:text-emerald-400">
                {comp.stat}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AutonomousCodeVisual() {
  const [lang, setLang] = useState<'c' | 'go'>('c')

  return (
    <div className="flex w-full flex-col gap-4 rounded-3xl border bg-muted/40 p-5 shadow-inner sm:p-7">
      <div className="overflow-hidden rounded-2xl border bg-zinc-950 text-zinc-100 shadow-sm">
        <div className="flex items-center justify-between border-b border-white/10 bg-zinc-900/90 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-red-500/80" />
            <span className="size-2.5 rounded-full bg-amber-500/80" />
            <span className="size-2.5 rounded-full bg-emerald-500/80" />
            <span className="ml-2 font-mono text-xs text-zinc-400">
              {lang === 'c' ? 'my-core-bot/src/main.c' : 'my-core-bot/main.go'}
            </span>
          </div>
          <div className="flex gap-1 rounded-lg border border-white/10 bg-zinc-950 p-0.5">
            <button
              type="button"
              onClick={() => setLang('c')}
              className={cn(
                'rounded-md px-2.5 py-0.5 font-mono text-xs font-semibold transition-colors',
                lang === 'c'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-zinc-400 hover:text-zinc-100',
              )}
            >
              C
            </button>
            <button
              type="button"
              onClick={() => setLang('go')}
              className={cn(
                'rounded-md px-2.5 py-0.5 font-mono text-xs font-semibold transition-colors',
                lang === 'go'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-zinc-400 hover:text-zinc-100',
              )}
            >
              Go
            </button>
          </div>
        </div>

        <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed sm:text-[13px]">
          {lang === 'c' ? (
            <code>
              <span className="text-pink-400">void</span>{' '}
              <span className="text-purple-300">ft_on_tick</span>(
              <span className="text-pink-400">unsigned long</span>{' '}
              <span className="text-orange-300">tick</span>){'\n{\n    '}
              <span className="text-sky-300">t_obj</span> *own ={' '}
              <span className="text-purple-300">ft_get_core_own</span>();
              {'\n    '}
              <span className="text-sky-300">t_obj</span> *enemy ={' '}
              <span className="text-purple-300">ft_get_core_opponent</span>();
              {'\n\n    '}
              <span className="text-zinc-500">
                // 1. Spawn custom units when ready
              </span>
              {'\n    '}
              <span className="text-pink-400">if</span> (own &amp;&amp; own-&gt;
              <span className="text-sky-300">s_core</span>.
              <span className="text-sky-300">spawn_cooldown</span> =={' '}
              <span className="text-orange-300">0</span>){'\n        '}
              <span className="text-purple-300">core_action_createUnit</span>(
              <span className="text-emerald-300">&quot;Warrior&quot;</span>,{' '}
              <span className="text-emerald-300">&quot;unit_attack&quot;</span>,{' '}
              <span className="text-orange-300">NULL</span>);
              {'\n\n    '}
              <span className="text-zinc-500">
                // 2. Steer every warrior toward the enemy Core
              </span>
              {'\n    '}
              <span className="text-sky-300">t_obj</span> **units ={' '}
              <span className="text-purple-300">core_get_units_byName</span>(
              <span className="text-emerald-300">&quot;Warrior&quot;</span>);
              {'\n    '}
              <span className="text-pink-400">for</span> (
              <span className="text-sky-300">size_t</span> i ={' '}
              <span className="text-orange-300">0</span>; enemy &amp;&amp; units
              &amp;&amp; units[i]; i++)
              {'\n        '}
              <span className="text-purple-300">core_action_travel</span>
              (units[i], enemy-&gt;<span className="text-sky-300">
                pos
              </span>, <span className="text-orange-300">NULL</span>);
              {'\n    '}
              <span className="text-purple-300">free</span>(units);
              {'\n}'}
            </code>
          ) : (
            <code>
              <span className="text-pink-400">func</span>{' '}
              <span className="text-purple-300">tick</span>(
              <span className="text-orange-300">elapsedTicks</span>{' '}
              <span className="text-sky-300">uint</span>) {'{\n    '}
              own := <span className="text-purple-300">ownCore</span>()
              {'\n    '}
              enemy := <span className="text-purple-300">opponentCore</span>()
              {'\n\n    '}
              <span className="text-zinc-500">
                // 1. Spawn custom units when ready
              </span>
              {'\n    '}
              <span className="text-pink-400">if</span> data, err := own.
              <span className="text-purple-300">CoreData</span>(); err =={' '}
              <span className="text-orange-300">nil</span> &amp;&amp; data.
              <span className="text-sky-300">SpawnCooldown</span> =={' '}
              <span className="text-orange-300">0</span> {'{\n        '}
              core.<span className="text-purple-300">CreateUnit</span>(
              <span className="text-emerald-300">&quot;Warrior&quot;</span>,{' '}
              <span className="text-emerald-300">&quot;unit_attack&quot;</span>,{' '}
              <span className="text-emerald-300">&quot;core_attack&quot;</span>)
              {'\n    }\n\n    '}
              <span className="text-zinc-500">
                // 2. Steer every warrior toward the enemy Core
              </span>
              {'\n    '}
              <span className="text-pink-400">for</span> _, unit :={' '}
              <span className="text-pink-400">range</span> core.
              <span className="text-purple-300">UnitsByName</span>(
              <span className="text-emerald-300">&quot;Warrior&quot;</span>){' '}
              {'{\n        '}
              <span className="text-pink-400">if</span> enemy !={' '}
              <span className="text-orange-300">nil</span> {'{\n            '}
              core.<span className="text-purple-300">Travel</span>(unit, enemy.
              <span className="text-sky-300">Pos</span>,{' '}
              <span className="text-orange-300">nil</span>)
              {'\n        }\n    }\n}'}
            </code>
          )}
        </pre>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border bg-background/70 p-2.5">
          <span className="font-mono font-semibold text-primary">
            Read State
          </span>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Receive full grid & object data each tick
          </p>
        </div>
        <div className="rounded-xl border bg-background/70 p-2.5">
          <span className="font-mono font-semibold text-primary">
            Compute Logic
          </span>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Filter targets & plan unit paths
          </p>
        </div>
        <div className="rounded-xl border bg-background/70 p-2.5">
          <span className="font-mono font-semibold text-primary">
            Send Actions
          </span>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Create, move, mine, transfer & attack
          </p>
        </div>
      </div>
    </div>
  )
}

function formatTimeLeft(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  const hhmmss = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`

  return days > 0 ? `${days}d ${hhmmss}` : hhmmss
}

export default function HomePageClient(props: { currentLiveEvent?: Event }) {
  const { resolvedTheme } = useTheme()
  const prefersReducedMotion = useReducedMotion()
  const [isMounted, setIsMounted] = useState(false)
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const visualizerTheme =
    isMounted && resolvedTheme === 'light' ? 'light' : 'dark'

  const visualizerUrl = useMemo(() => {
    const base = getVisualizerUrl()
    const params = new URLSearchParams({
      autoplay: 'true',
      speed: '5',
      ui: 'false',
      theme: visualizerTheme,
      gridlines: 'off',
      themeColor: '000000',
      suppress_version_warning: 'true',
    })
    return `${base}/?${params.toString()}`
  }, [visualizerTheme])

  const timeLeftMs = props.currentLiveEvent
    ? new Date(props.currentLiveEvent.submissionDeadline).getTime() -
      now.getTime()
    : 0

  return (
    <div className="overflow-hidden">
      <section className="px-4 pb-16 pt-6 sm:pb-20 sm:pt-10 lg:pb-28">
        <div className="mx-auto flex max-w-6xl flex-col items-center text-center">
          <CoreLogoWhite
            className="h-auto w-40 text-foreground sm:w-52 md:w-64"
            aria-label="CORE Game"
          />
          <div className="mt-10 mb-6 flex w-full justify-center sm:mt-14 sm:mb-10">
            <WorldChampionshipBanner />
          </div>
          <h1 className="mt-5 max-w-3xl text-2xl font-bold leading-tight text-balance sm:text-3xl md:text-4xl">
            Imagine a game contest that brings people from around the world
            together for fun and learning.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            CORE is a strategy game you can only play by programming. Write a
            bot that mines gems, spawns custom units, and destroys the enemy
            Core.
          </p>

          <div className="mt-7 grid w-full max-w-sm grid-cols-1 gap-3 sm:flex sm:max-w-none sm:justify-center">
            <Button asChild size="lg" className="min-h-11 w-full sm:w-auto">
              <Link href="/wiki">
                <WikiIcon size={20} />
                Documentation
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
            >
              <Link
                href="https://github.com/42core-team"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GithubIcon size={20} />
                GitHub
              </Link>
            </Button>
          </div>

          {props.currentLiveEvent &&
            props.currentLiveEvent.state !== 'COMPLETED' && (
              <motion.div
                className="mt-7 w-full max-w-xl sm:mt-9"
                initial={
                  prefersReducedMotion
                    ? false
                    : { scale: 0.95, opacity: 0, y: 10 }
                }
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <Link
                  href={`/events/${props.currentLiveEvent.id}`}
                  className="group block rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                >
                  <Card className="relative overflow-hidden border-white/10 bg-background/60 shadow-xl backdrop-blur-xl transition-all duration-300 group-hover:border-primary/50 group-hover:bg-background/80 group-hover:shadow-2xl group-active:scale-[0.99] motion-safe:sm:group-hover:-translate-y-1">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50 transition-opacity group-hover:opacity-100" />
                    <CardHeader className="flex flex-col gap-5 space-y-0 p-4 text-left sm:flex-row sm:items-center sm:justify-between sm:p-6">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-75" />
                            <span className="relative h-2 w-2 rounded-full bg-destructive" />
                          </span>
                          <span className="text-xs font-semibold tracking-widest text-destructive uppercase">
                            {
                              lifecycleLabels[
                                eventState(
                                  props.currentLiveEvent,
                                  now.getTime(),
                                )
                              ]
                            }
                          </span>
                        </div>
                        <CardTitle className="mt-2 text-lg font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-2xl">
                          {props.currentLiveEvent.name}
                        </CardTitle>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-4 sm:justify-end sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                        <div className="flex min-w-0 flex-col sm:items-end sm:text-right">
                          <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                            {timeLeftMs > 0 ? 'Coding ends in' : 'Code freeze'}
                          </span>
                          <span className="font-mono text-sm font-bold text-foreground tabular-nums sm:text-base">
                            {timeLeftMs > 0
                              ? formatTimeLeft(timeLeftMs)
                              : 'View event'}
                          </span>
                        </div>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-105">
                          <svg
                            className="h-5 w-5"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              </motion.div>
            )}
        </div>

        <div className="mx-auto mt-10 w-full max-w-6xl sm:mt-14">
          <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted shadow-lg sm:aspect-video sm:rounded-2xl">
            {isMounted && (
              <iframe
                key={visualizerUrl}
                src={visualizerUrl}
                className="h-full w-full border-0"
                allow="autoplay; fullscreen"
                loading="lazy"
                referrerPolicy="no-referrer"
                title="CORE Game Replay"
              />
            )}
          </div>
        </div>
        <noscript>
          <div className="p-4 text-center">JavaScript is disabled</div>
        </noscript>
      </section>

      <GlobalStats />

      {/* Section 1: What is the Goal of the Game? */}
      <section
        className="px-4 py-20 sm:py-24 lg:py-32"
        aria-labelledby="game-overview-heading"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-2xl text-center sm:mb-20">
            <h2
              id="game-overview-heading"
              className="text-3xl font-bold tracking-tight text-balance sm:text-4xl"
            >
              What is CORE all about?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Two player-coded bots clash on a 2D grid. Your code manages your
              economy, builds your army, and steers every unit in battle.
            </p>
          </div>

          <div className="flex flex-col gap-16 sm:gap-20 lg:gap-28">
            {/* Feature 1: Objective */}
            <motion.article
              className="grid items-center gap-8 md:grid-cols-2 md:gap-12 lg:gap-20"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
            >
              <ArenaObjectiveVisual isLight={visualizerTheme === 'light'} />

              <div>
                <span className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
                  01 · The Objective
                </span>
                <h3 className="mt-3 text-2xl font-bold leading-tight text-balance sm:text-3xl lg:text-4xl">
                  Defend Your Core, Destroy Theirs
                </h3>
                <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                  Each player starts in a corner of the map with a base called a{' '}
                  <strong className="font-semibold text-foreground">
                    Core
                  </strong>
                  . If your Core is destroyed, you lose the match. To win, you
                  must spawn units, steer them across the grid, break through
                  walls and enemy defenders, and bring your opponent&apos;s Core
                  HP down to zero.
                </p>
              </div>
            </motion.article>

            {/* Feature 2: Gems & Unit Builder */}
            <motion.article
              className="grid items-center gap-8 md:grid-cols-2 md:gap-12 lg:gap-20"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
            >
              <div className="md:order-2">
                <EconomyAndUnitBuilderVisual />
              </div>

              <div className="md:order-1">
                <span className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
                  02 · Economy & Unit Design
                </span>
                <h3 className="mt-3 text-2xl font-bold leading-tight text-balance sm:text-3xl lg:text-4xl">
                  Mine Gems & Assemble Custom Units
                </h3>
                <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                  Spawning units costs{' '}
                  <strong className="font-semibold text-foreground">
                    gems
                  </strong>
                  . Beyond small idle income, you earn gems by sending miner
                  units to break open gem deposits scattered across the map,
                  pick up the dropped gem piles, and transfer them back to your
                  Core. Using the{' '}
                  <strong className="font-semibold text-foreground">
                    Unit Builder
                  </strong>
                  , you stack modular components to create specialized
                  roles—from fast, high-capacity miners to heavily armored tanks
                  and Core breakers.
                </p>
              </div>
            </motion.article>

            {/* Feature 3: Code-Only Gameplay */}
            <motion.article
              className="grid items-center gap-8 md:grid-cols-2 md:gap-12 lg:gap-20"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
            >
              <AutonomousCodeVisual />

              <div>
                <span className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
                  03 · Pure Programming
                </span>
                <h3 className="mt-3 text-2xl font-bold leading-tight text-balance sm:text-3xl lg:text-4xl">
                  Your Code Is the Only Controller
                </h3>
                <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                  Once a match begins, everything runs autonomously tick by
                  tick. On every tick, your bot receives the latest game state
                  from the server—every unit, wall, deposit, cooldown, and gem
                  pile on the map—and issues action commands in{' '}
                  <strong className="font-semibold text-foreground">C</strong>{' '}
                  or{' '}
                  <strong className="font-semibold text-foreground">Go</strong>.
                  Smart resource management, pathfinding, and target priority
                  separate the winners from the rest.
                </p>
              </div>
            </motion.article>
          </div>
        </div>
      </section>

      {/* Section 2: How to Play / Getting Started */}
      <section
        className="border-t bg-muted/25 px-4 py-20 sm:py-24 lg:py-32"
        aria-labelledby="how-to-play-heading"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
            <h2
              id="how-to-play-heading"
              className="text-3xl font-bold tracking-tight text-balance sm:text-4xl"
            >
              From zero to your first match
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Join an event, get your bot repository, and start testing your
              strategy locally and online.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {howToPlaySteps.map((item, index) => (
              <motion.div
                key={item.step}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="h-full"
              >
                <Card className="flex h-full flex-col justify-between border bg-card/85 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                  <CardContent className="flex h-full flex-col justify-between p-6">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold tracking-widest text-primary uppercase">
                          Step {item.step}
                        </span>
                        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <item.icon className="size-5" aria-hidden="true" />
                        </div>
                      </div>

                      <h3 className="mt-4 text-lg font-bold leading-snug">
                        {item.title}
                      </h3>
                      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-5 border-t pt-3">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                        <GitBranch className="size-3.5 text-primary" />
                        {item.badge}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/events">
                Browse Events
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Link href="/wiki/my_first_core_bot">
                <WikiIcon size={18} />
                Read &ldquo;My First CORE Bot&rdquo; Guide
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
