import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { Activity, Flame, Gem, Users } from 'lucide-react'
import { getGlobalStats } from '@/app/actions/stats'
import AnimatedNumber from '@/components/animatedNumber'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const statStyles = [
  {
    title: 'Total Damage',
    description: 'Damage dealt across every match',
    icon: Flame,
    accent: 'text-orange-600 dark:text-orange-400',
    iconBackground: 'bg-orange-500/10',
    hoverBorder: 'hover:border-orange-500/40',
    glow: 'bg-orange-500/15',
    line: 'from-orange-500 via-red-500 to-transparent',
  },
  {
    title: 'Gems Gained',
    description: 'Resources collected by all players',
    icon: Gem,
    accent: 'text-sky-600 dark:text-sky-400',
    iconBackground: 'bg-sky-500/10',
    hoverBorder: 'hover:border-sky-500/40',
    glow: 'bg-sky-500/15',
    line: 'from-sky-500 via-cyan-400 to-transparent',
  },
  {
    title: 'Units Spawned',
    description: 'Units deployed into the arena',
    icon: Users,
    accent: 'text-emerald-600 dark:text-emerald-400',
    iconBackground: 'bg-emerald-500/10',
    hoverBorder: 'hover:border-emerald-500/40',
    glow: 'bg-emerald-500/15',
    line: 'from-emerald-500 via-green-400 to-transparent',
  },
]

export default function GlobalStats() {
  const prefersReducedMotion = useReducedMotion()
  const statsQuery = useQuery({
    queryKey: ['stats', 'global'],
    queryFn: getGlobalStats,
    refetchInterval: 2000,
  })

  const values = [
    Number.parseInt(statsQuery.data?.damageTotal || '0'),
    Number.parseInt(statsQuery.data?.gemsGained || '0'),
    Number.parseInt(statsQuery.data?.unitsSpawned || '0'),
  ]

  return (
    <section className="relative isolate overflow-hidden border-y bg-gradient-to-b from-muted/50 via-background to-muted/30 px-4 py-16 sm:py-24">
      <div
        className="pointer-events-none absolute -left-24 top-10 -z-10 h-64 w-64 rounded-full bg-orange-500/5 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 -z-10 h-72 w-72 rounded-full bg-sky-500/5 blur-3xl"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            The arena never stands still
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            A live look at everything players have achieved across CORE Game.
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
                  'group relative h-full overflow-hidden bg-card/80 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
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
