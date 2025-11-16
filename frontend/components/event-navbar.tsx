"use client";
import type { Event } from "@/app/actions/event";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { EventState } from "@/app/actions/event-model";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

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
      ...(event.state === EventState.ELIMINATION_ROUND
        || event.state === EventState.SWISS_ROUND
        || event.state === EventState.FINISHED
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
    <div className="py-4 flex items-center justify-center">
      {/* Desktop navigation */}
      <NavigationMenu className="hidden md:flex">
        <NavigationMenuList>
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <NavigationMenuItem key={item.path}>
                <NavigationMenuLink
                  asChild
                  className={cn(
                    navigationMenuTriggerStyle(),
                    isActive && "bg-accent text-accent-foreground",
                  )}
                >
                  <Link href={item.path}>{item.name}</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>

      {/* Mobile navigation dropdown */}
      <div className="px-3 flex md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation menu">
              <Menu className="size-5" />
              {" "}
              Event Menu
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <DropdownMenuItem key={item.path} asChild className={cn(isActive && "bg-accent text-accent-foreground")}>
                  <Link href={item.path}>{item.name}</Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
