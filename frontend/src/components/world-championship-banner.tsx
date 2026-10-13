import { ExternalLink, Trophy, UserPlus } from 'lucide-react'
import Link from '@/components/app-link'
import { Button } from '@/components/ui/button'

const EVENTBRITE_URL = 'https://link.coregame.sh/core-global-eventbrite'
const EVENT_URL = '/events/ca841f27-eb2d-438c-a46f-d2f6e3004ccc'

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
              Register for the event to compete online or on-site. Joining us
              on-site? Also grab your ticket on Eventbrite.
            </p>
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <Button asChild className="w-full font-semibold sm:w-auto">
            <Link href={EVENT_URL}>
              <UserPlus aria-hidden="true" />
              Register for event
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full font-semibold sm:w-auto"
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
    </aside>
  )
}
