import { ExternalLink, Trophy } from 'lucide-react'
import Link from '@/components/app-link'
import { Button } from '@/components/ui/button'

const EVENTBRITE_URL = 'https://link.coregame.sh/core-global-eventbrite'

export default function WorldChampionshipBanner() {
  return (
    <aside
      aria-labelledby="world-championship-heading"
      className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-primary/30 bg-primary/5 text-left shadow-sm"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Trophy className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p
              id="world-championship-heading"
              className="text-sm font-semibold tracking-tight sm:text-base"
            >
              The CORE Game World Championship is coming!
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Want to compete on-site? Register for the onsite event on
              Eventbrite.
            </p>
          </div>
        </div>
        <Button asChild className="w-full shrink-0 font-semibold sm:w-auto">
          <Link href={EVENTBRITE_URL} target="_blank" rel="noopener noreferrer">
            Register now
            <ExternalLink aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </aside>
  )
}
