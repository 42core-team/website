"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Event } from "@/app/actions/event";
import { EventState } from "@/app/actions/event-model";

interface EventNavbarProps {
  eventId: string;
  isUserRegistered?: boolean;
  isEventAdmin?: boolean;
  event: Event;
}

export default function EventNavbar({
  eventId,
  isUserRegistered = false,
  isEventAdmin = false,
  event,
}: EventNavbarProps) {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(pathname);
  }, [pathname]);

  const navItems = useMemo(() => {
    const baseItems = [
      { name: "Info", path: `/events/${eventId}` },
      ...(isUserRegistered
        ? [
            { name: "My Team", path: `/events/${eventId}/my-team` },
            { name: "Queue", path: `/events/${eventId}/queue` },
          ]
        : []),
      { name: "Teams", path: `/events/${eventId}/teams` },
      ...(event.state === EventState.ELIMINATION_ROUND ||
      event.state === EventState.SWISS_ROUND ||
      event.state === EventState.FINISHED
        ? [
            { name: "Group Phase", path: `/events/${eventId}/groups` },
            { name: "Tournament Tree", path: `/events/${eventId}/bracket` },
          ]
        : []),
    ];

    return isEventAdmin
      ? [
          ...baseItems,
          { name: "Queue Matches", path: `/events/${eventId}/queue-matches` },
          { name: "Dashboard", path: `/events/${eventId}/dashboard` },
        ]
      : baseItems;
  }, [eventId, isUserRegistered, isEventAdmin, event.state]);

  return (
    <div className="w-full border-t">
      <nav className="container mx-auto max-w-7xl px-6 h-16 flex items-center justify-center gap-8">
        {navItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            onPointerDown={() => setActiveTab(item.path)}
            onClick={() => setActiveTab(item.path)}
            className={`text-base hover:text-primary transition-colors ${
              (activeTab || pathname) === item.path
                ? "text-primary font-medium border-b-2 border-primary pb-1"
                : "text-foreground-500"
            }`}
          >
            {item.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}
