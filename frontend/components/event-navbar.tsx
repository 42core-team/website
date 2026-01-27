"use client";
import type { Event } from "@/app/actions/event";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
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
}: Readonly<EventNavbarProps>) {
  const pathname = usePathname();
  const hasStarted = Date.now() >= new Date(event.startDate).getTime();

  const navItems = useMemo(() => {
    const items = [
      { name: "Info", path: `/events/${eventId}` },
      { name: "Teams", path: `/events/${eventId}/teams` },
    ];

    if (isUserRegistered) {
      items.push({ name: "My Team", path: `/events/${eventId}/my-team` });
    }

    if (hasStarted) {
      items.push({ name: "Queue", path: `/events/${eventId}/queue` });
    }

    if (event.currentRound > 0) {
      items.push(
        { name: "Group Phase", path: `/events/${eventId}/groups` },
        { name: "Tournament Tree", path: `/events/${eventId}/bracket` },
      );
    }

    if (isEventAdmin) {
      items.push(
        { name: "Queue Matches", path: `/events/${eventId}/queue-matches` },
        { name: "Dashboard", path: `/events/${eventId}/dashboard` },
      );
    }

    return items;
  }, [eventId, isUserRegistered, isEventAdmin, hasStarted]);

  return (
    <div className="py-4 flex items-center pl-12 md:pl-0 justify-start md:justify-center">
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
            <Button
              variant="ghost"
              className="w-fit"
              size="icon"
              aria-label="Open navigation menu"
            >
              <Menu className="size-5" />
              Event Menu
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <DropdownMenuItem
                  key={item.path}
                  asChild
                  className={cn(isActive && "bg-accent text-accent-foreground")}
                >
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
