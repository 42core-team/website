export enum EventState {
  REGISTRATION = "REGISTRATION",
  PLAYING = "PLAYING",
  SUBMISSIONS_CLOSED = "SUBMISSIONS_CLOSED",
  SHOWCASE = "SHOWCASE",
  COMPLETED = "COMPLETED",
}

type LifecycleEvent = {
  state?: EventState;
  startDate: Date;
  submissionDeadline?: Date | null;
  repoLockDate?: Date | null;
  endDate?: Date;
};

export function getEventState(
  event: LifecycleEvent,
  now = new Date(),
): EventState {
  if (
    event.state === EventState.SHOWCASE ||
    event.state === EventState.COMPLETED ||
    event.state === EventState.SUBMISSIONS_CLOSED
  )
    return event.state;
  const deadline =
    event.submissionDeadline ?? event.repoLockDate ?? event.endDate;
  if (deadline && now >= deadline) return EventState.SUBMISSIONS_CLOSED;
  return now >= event.startDate ? EventState.PLAYING : EventState.REGISTRATION;
}

/** Registration and team changes remain available throughout playing. */
export function isRegistrationOpen(
  event: LifecycleEvent,
  now = new Date(),
): boolean {
  return [EventState.REGISTRATION, EventState.PLAYING].includes(
    getEventState(event, now),
  );
}

export function isPlaying(event: LifecycleEvent, now = new Date()): boolean {
  return getEventState(event, now) === EventState.PLAYING;
}
