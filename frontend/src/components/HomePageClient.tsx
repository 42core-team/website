import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Event } from '@/app/actions/event'
import Image from '@/components/app-image'
import Link from '@/components/app-link'
import GlobalStats from '@/components/GlobalStats'
import { GithubIcon, WikiIcon } from '@/components/icons'
import { CoreLogoWhite } from '@/components/social'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { getVisualizerUrl } from '@/lib/env'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const features = [
  {
    src: '/images/goblin_archer_idle__0.png',
    alt: 'Gib Character',
    title: 'What the Game is About',
    description:
      'CORE Game is a competitive coding challenge where you design and program your own bots to battle it out in a dynamic 2D arena. Every decision matters—strategy, efficiency, and adaptability will determine whether your bot rises to victory or falls in defeat. Are you ready to code your way to the top?',
    direction: 1,
  },
  {
    src: '/images/goblin_basic_idle__0.png',
    alt: 'Bob Character',
    title: 'How to Play the Game',
    description:
      "Write your own bot, fine-tune its strategy, and deploy it into battle. The game runs autonomously based on the logic you've programmed, so your code is your weapon. Learn from past matches, tweak your tactics, and keep improving—because in CORE Game, the smartest code wins.",
    direction: -1,
  },
  {
    src: '/images/goblin_tank_idle__0.png',
    alt: 'Rob Character',
    title: 'What is Necessary to Play',
    description:
      "All you need is basic programming knowledge, a curious mind, and a hunger for competition! Whether you're a beginner or an experienced coder, you can jump in, experiment, and refine your bot as you go. No fancy hardware required—just bring your creativity and a love for coding!",
    direction: 1,
  },
  {
    src: '/images/goblin_healer_idle__0.png',
    alt: 'Zob Character',
    title: 'What We Offer as a Team',
    description:
      "We're more than just a game—we're a community of coders, innovators, and problem-solvers. As a team, we provide an engaging platform, regular challenges, and a space to connect with like-minded programmers. Workshops and thrilling competitions we've got everything you need to grow, learn, and have fun!",
    direction: -1,
  },
]

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
    ? new Date(props.currentLiveEvent.endDate).getTime() - now.getTime()
    : 0

  return (
    <div className="overflow-hidden">
      <section className="px-4 pb-16 pt-6 sm:pb-20 sm:pt-10 lg:pb-28">
        <div className="mx-auto flex max-w-6xl flex-col items-center text-center">
          <CoreLogoWhite
            className="h-auto w-40 text-foreground sm:w-52 md:w-64"
            aria-label="CORE Game"
          />
          <h1 className="mt-5 max-w-3xl text-2xl font-bold leading-tight text-balance sm:text-3xl md:text-4xl">
            Imagine a game contest that brings people from around the world
            together for fun and learning.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Build a bot, test your strategy, and learn by competing in a dynamic
            coding arena.
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

          {props.currentLiveEvent && timeLeftMs > 0 && (
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
                          Live now
                        </span>
                      </div>
                      <CardTitle className="mt-2 text-lg font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-2xl">
                        {props.currentLiveEvent.name}
                      </CardTitle>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-4 sm:justify-end sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                      <div className="flex min-w-0 flex-col sm:items-end sm:text-right">
                        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                          Closing in
                        </span>
                        <span className="font-mono text-sm font-bold text-foreground tabular-nums sm:text-base">
                          {formatTimeLeft(timeLeftMs)}
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

      <section
        className="px-4 py-20 sm:py-24 lg:py-32"
        aria-labelledby="learn-core-heading"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
            <h2
              id="learn-core-heading"
              className="text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Learn, build, compete
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Everything you need to turn your code into a contender.
            </p>
          </div>

          <div className="flex flex-col gap-16 sm:gap-20 lg:gap-28">
            {features.map((feature, index) => (
              <motion.article
                key={feature.alt}
                className="grid items-center gap-6 md:grid-cols-2 md:gap-12 lg:gap-20"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.65, ease: 'easeOut' }}
              >
                <div
                  className={cn(
                    'flex min-h-56 items-center justify-center rounded-3xl bg-muted/45 p-6 sm:min-h-72 sm:p-10',
                    index % 2 === 1 && 'md:order-2',
                  )}
                >
                  <motion.div
                    initial={
                      prefersReducedMotion
                        ? false
                        : { opacity: 0, x: feature.direction * -24 }
                    }
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  >
                    <Image
                      src={feature.src}
                      alt={feature.alt}
                      width={800}
                      height={800}
                      className="image-rendering-pixel w-36 sm:w-48 lg:w-60"
                      style={{
                        imageRendering: 'pixelated',
                        transform:
                          feature.direction === 1 ? 'scaleX(-1)' : 'none',
                      }}
                    />
                  </motion.div>
                </div>

                <div className={cn(index % 2 === 1 && 'md:order-1')}>
                  <span className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-3 text-2xl font-bold leading-tight text-balance sm:text-3xl lg:text-4xl">
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                    {feature.description}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
