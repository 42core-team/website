import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { Activity, Flame, Gem, Users } from 'lucide-react'
import { getGlobalStats } from '@/app/actions/stats'
import AnimatedNumber from '@/components/animatedNumber'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { GLOBAL_STATS_REFETCH_INTERVAL_MS } from '@/lib/query-intervals'
import { cn } from '@/lib/utils'

const statStyles = [
  {
    title: 'Total Damage',
    description: 'Dealt by units to enemy troops, walls, and opposing Cores',
    icon: Flame,
    accent: 'text-link',
    iconBackground: 'bg-highlight',
    hoverBorder: 'hover:border-highlight-border',
    glow: 'bg-brand-orange/15',
    line: 'from-brand-orange via-brand-dark-orange to-transparent',
  },
  {
    title: 'Gems Gained',
    description:
      'Mined from deposits and collected from gem piles to fund new units',
    icon: Gem,
    accent: 'text-info',
    iconBackground: 'bg-info-surface',
    hoverBorder: 'hover:border-info-border',
    glow: 'bg-info/15',
    line: 'from-info via-info-border to-transparent',
  },
  {
    title: 'Units Spawned',
    description: 'Custom-built units assembled and deployed from player Cores',
    icon: Users,
    accent: 'text-success',
    iconBackground: 'bg-success-surface',
    hoverBorder: 'hover:border-success-border',
    glow: 'bg-success/15',
    line: 'from-success via-success-border to-transparent',
  },
]

export default function GlobalStats() {
  const prefersReducedMotion = useReducedMotion()
  const statsQuery = useQuery({
    queryKey: ['stats', 'global'],
    queryFn: getGlobalStats,
    refetchInterval: GLOBAL_STATS_REFETCH_INTERVAL_MS,
  })

  const values = [
    Number.parseInt(statsQuery.data?.damageTotal || '0'),
    Number.parseInt(statsQuery.data?.gemsGained || '0'),
    Number.parseInt(statsQuery.data?.unitsSpawned || '0'),
  ]

  return (
    <section className="relative isolate overflow-hidden border-y bg-gradient-to-b from-muted/50 via-background to-muted/30 py-16 sm:py-24">
      <div
        className="pointer-events-none absolute -left-24 top-10 -z-10 h-64 w-64 rounded-full bg-brand-orange/5 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 -z-10 h-72 w-72 rounded-full bg-primary/5 blur-3xl"
        aria-hidden="true"
      />

      <div className="page-frame">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
          <h2 className="section-title text-balance">Live from the Arena</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Every match runs tick by tick on a 2D grid—here is what player-coded
            bots have done across all games so far.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {statStyles.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="h-full"
            >
              <Card
                className={cn(
                  'group relative h-full overflow-hidden transition-colors',
                  stat.hoverBorder,
                )}
              >
                <div
                  className={cn(
                    'absolute inset-x-0 top-0 h-px bg-gradient-to-r',
                    stat.line,
                  )}
                  aria-hidden="true"
                />
                <div
                  className={cn(
                    'pointer-events-none absolute -right-14 -top-14 size-36 rounded-full opacity-40 blur-3xl transition-opacity duration-300 group-hover:opacity-80',
                    stat.glow,
                  )}
                  aria-hidden="true"
                />

                <CardContent className="relative flex h-full flex-col p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={cn(
                        'flex size-12 items-center justify-center rounded-2xl ring-1 ring-current/10 sm:size-14',
                        stat.iconBackground,
                        stat.accent,
                      )}
                    >
                      <stat.icon
                        className="size-6 sm:size-7"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="rounded-full border bg-background/60 px-2.5 py-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                      All time
                    </span>
                  </div>

                  <div className="mt-8 sm:mt-10">
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    {statsQuery.isPending ? (
                      <Skeleton className="mt-3 h-12 w-3/4 rounded-lg" />
                    ) : (
                      <div
                        className={cn(
                          'mt-2 break-words text-4xl font-bold tracking-tight tabular-nums sm:text-5xl md:text-[2.6rem] lg:text-5xl',
                          stat.accent,
                        )}
                      >
                        <AnimatedNumber value={values[index]} />
                      </div>
                    )}
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="mt-7 flex items-center justify-center gap-2 text-xs text-muted-foreground sm:mt-8">
          <Activity className="size-3.5" aria-hidden="true" />
          Automatically refreshed every two seconds
        </div>
      </div>
    </section>
  )
}
