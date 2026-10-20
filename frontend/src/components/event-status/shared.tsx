import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ExternalLink, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { joinEvent } from '@/app/actions/event'
import { myTeamQueryKey } from '@/app/events/my-team-queries'
import Link from '@/components/app-link'
import { Button } from '@/components/ui/button'
import type { MomentAction, MomentTone } from '@/lib/event-moment'

export const toneStyles: Record<
  MomentTone,
  { text: string; panel: string; border: string; ring: string; dot: string }
> = {
  neutral: {
    text: 'text-muted-foreground',
    panel: 'bg-muted/40',
    border: 'border-border',
    ring: 'ring-muted-foreground/20',
    dot: 'bg-muted-foreground',
  },
  active: {
    text: 'text-emerald-600 dark:text-emerald-400',
    panel: 'bg-emerald-500/[0.07] dark:bg-emerald-500/10',
    border: 'border-emerald-500/25',
    ring: 'ring-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  warning: {
    text: 'text-amber-600 dark:text-amber-400',
    panel: 'bg-amber-500/[0.07] dark:bg-amber-500/10',
    border: 'border-amber-500/30',
    ring: 'ring-amber-500/20',
    dot: 'bg-amber-500',
  },
  danger: {
    text: 'text-destructive',
    panel: 'bg-destructive/[0.07] dark:bg-destructive/10',
    border: 'border-destructive/30',
    ring: 'ring-destructive/20',
    dot: 'bg-destructive',
  },
}

/** "Oct 16, 09:00" in the viewer's time zone. */
export function formatEventDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

/** "09:00" today, otherwise "Oct 16, 09:00". */
export function formatEventTime(iso: string, now = Date.now()) {
  const date = new Date(iso)
  if (date.toDateString() === new Date(now).toDateString())
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
  return formatEventDateTime(iso)
}

export function viewerTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function MomentActions({
  eventId,
  actions,
  size = 'default',
}: Readonly<{
  eventId: string
  actions: MomentAction[]
  size?: 'default' | 'sm'
}>) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const joinMutation = useMutation({
    mutationFn: async () => joinEvent(eventId),
    onSuccess: () => {
      toast.success('Successfully joined the event!')
      queryClient.setQueryData(['event', eventId, 'is-user-registered'], true)
      void queryClient.invalidateQueries({ queryKey: ['events'] })
      void queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      void queryClient.invalidateQueries({ queryKey: myTeamQueryKey(eventId) })
      void navigate({ to: '/events/$id/my-team', params: { id: eventId } })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to join event')
    },
  })

  if (actions.length === 0) return null

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      {actions.map((action, index) => {
        const variant = index === 0 ? 'default' : 'outline'
        if (action.kind === 'join')
          return (
            <Button
              key={action.label}
              size={size}
              variant={variant}
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
              isLoading={joinMutation.isPending}
            >
              {!joinMutation.isPending && <UserPlus aria-hidden="true" />}
              {joinMutation.isPending ? 'Joining...' : action.label}
            </Button>
          )
        return (
          <Button key={action.label} size={size} variant={variant} asChild>
            {action.external ? (
              <a href={action.href} target="_blank" rel="noreferrer">
                {action.label}
                <ExternalLink aria-hidden="true" />
              </a>
            ) : (
              <Link href={action.href}>{action.label}</Link>
            )}
          </Button>
        )
      })}
    </div>
  )
}
