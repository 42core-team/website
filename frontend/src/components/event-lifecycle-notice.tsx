import type { Event } from '@/app/actions/event'
import { eventState, lifecycleLabels } from '@/lib/event-lifecycle'
import TimeBadge from '@/components/timeBadge'

export function EventLifecycleNotice({ event }: { event: Event }) {
  const state = eventState(event)
  return (
    <section
      role="status"
      className="mx-auto w-full max-w-7xl space-y-2 rounded-md border p-4 text-sm"
    >
      <p className="font-semibold">{lifecycleLabels[state]}</p>
      {state === 'REGISTRATION' && (
        <p>
          Registration is open. Repositories will be prepared when play starts.
        </p>
      )}
      {state === 'PLAYING' && (
        <p>
          Registration and team edits remain open until the submission deadline.
          Match making requires a ready repository.
        </p>
      )}
      {state === 'SUBMISSIONS_CLOSED' && (
        <p>
          Submissions, registration, team edits, match making and betting are
          closed. Organizers are confirming repository locks before showcase;
          results remain available.
        </p>
      )}
      {state === 'SHOWCASE' && (
        <p>Showcase is underway. Watch matches and revealed results.</p>
      )}
      {state === 'COMPLETED' && (
        <p>This event is complete. Matches and results remain available.</p>
      )}
      <p>
        Submission deadline: <TimeBadge time={event.submissionDeadline} />
      </p>
      {event.introEnabled && (
        <p>
          Optional introduction:{' '}
          <TimeBadge
            time={new Date(
              new Date(event.startDate).getTime() -
                event.introLeadMinutes * 60000,
            ).toISOString()}
          />
          . Play starts at the scheduled start time.
        </p>
      )}
    </section>
  )
}
