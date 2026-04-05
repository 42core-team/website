"use client";

import type { PropsWithChildren } from "react";
import { createContext, useContext, useMemo, useState } from "react";

interface EventAccessState {
  eventId: string;
  startDate: string;
  isPrivate: boolean;
  isUserRegistered: boolean;
  hasTeam: boolean;
  isEventAdmin: boolean;
}

interface EventAccessContextValue extends EventAccessState {
  setEventAccess: (patch: Partial<EventAccessState>) => void;
}

const EventAccessContext = createContext<EventAccessContextValue | null>(null);

export function EventAccessProvider({
  children,
  initialState,
}: PropsWithChildren<{ initialState: EventAccessState }>) {
  const [state, setState] = useState(initialState);

  const value = useMemo<EventAccessContextValue>(() => ({
    ...state,
    setEventAccess: patch => setState(current => ({ ...current, ...patch })),
  }), [state]);

  return (
    <EventAccessContext.Provider value={value}>
      {children}
    </EventAccessContext.Provider>
  );
}

export function useEventAccess() {
  const context = useContext(EventAccessContext);

  if (!context) {
    throw new Error("useEventAccess must be used within EventAccessProvider");
  }

  return context;
}
