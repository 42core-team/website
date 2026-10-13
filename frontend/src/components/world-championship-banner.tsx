import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ExternalLink, Sparkles, Trophy } from 'lucide-react'
import Link from '@/components/app-link'
import { Button } from '@/components/ui/button'

const EVENTBRITE_URL = 'https://link.coregame.sh/core-global-eventbrite'
const EVENT_URL = '/events/ca841f27-eb2d-438c-a46f-d2f6e3004ccc'

export default function WorldChampionshipBanner() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.aside
      aria-labelledby="world-championship-heading"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 160, damping: 16, delay: 0.15 }}
      className="relative w-full max-w-4xl overflow-hidden rounded-2xl p-[3px] shadow-[0_0_60px_-12px_rgb(236_72_153/0.6)]"
    >
      {/* Spinning rainbow border */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 aspect-square w-[200%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,#f59e0b,#ec4899,#8b5cf6,#06b6d4,#22c55e,#f59e0b)] motion-safe:animate-border-spin"
      />

      <div className="relative overflow-hidden rounded-[calc(1rem-3px)] bg-background">
        {/* Colorful wash */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-amber-500/15 via-pink-500/15 to-violet-500/20"
        />
        {/* Shimmer sweep */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent motion-safe:animate-shimmer"
        />

        <div className="relative flex flex-col items-center gap-5 p-5 text-center sm:p-7 md:flex-row md:text-left">
          <motion.div
            aria-hidden="true"
            animate={
              prefersReducedMotion
                ? undefined
                : { rotate: [0, -10, 10, -6, 6, 0], scale: [1, 1.1, 1] }
            }
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2.5 }}
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-pink-500 to-violet-600 text-white shadow-lg shadow-pink-500/40"
          >
            <Trophy className="size-8" />
          </motion.div>

          <div className="min-w-0 flex-1">
            <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-pink-500/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-pink-600 dark:text-pink-400">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Registration open
            </p>
            <h2
              id="world-championship-heading"
              className="bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent sm:text-2xl md:text-3xl"
            >
              CORE Game World Championship
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
              Register for the event to compete online or on-site. Joining us
              on-site? Also grab your ticket on Eventbrite.
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row md:flex-col">
            <Button
              asChild
              size="lg"
              className="group min-h-11 w-full border-0 bg-gradient-to-r from-pink-500 to-violet-600 font-bold text-white hover:from-pink-600 hover:to-violet-700 motion-safe:animate-glow-pulse sm:w-auto"
            >
              <Link href={EVENT_URL}>
                Register now
                <ArrowRight
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-11 w-full bg-background/60 font-semibold sm:w-auto"
            >
              <Link
                href={EVENTBRITE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Onsite tickets
                <ExternalLink aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </motion.aside>
  )
}
