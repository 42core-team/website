"use client";
import { forwardRef, useState, useCallback } from "react";
import type { SVGAttributes, HTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ThemeSwitch } from "@/components/theme-switch";
import GithubLoginButton from "@/components/github";
import { signOut } from "next-auth/react";
import { useNavbar } from "@/contexts/NavbarContext";

const Logo = (props: SVGAttributes<SVGElement>) => {
  return (
    <svg viewBox="0 0 42 85" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g fill="#a2a2a2">
        <path d="M13 29L21 21V67L13 59V29Z" />
        <path d="M8 26L21 13V0L0 21V64L21 85V75L8 62L8 26Z" />
      </g>
      <g fill="#747474">
        <path d="M29 29L21 21V67L29 59V29Z" />
        <path d="M42 64L21 85V75L34 62L34 54L42 46V64Z" />
        <path d="M42 21V30L34 39L34 26L21 13V0L42 21Z" />
      </g>
    </svg>
  );
};

const HamburgerIcon = ({ className, ...props }: SVGAttributes<SVGElement>) => (
  <svg
    className={cn("pointer-events-none", className)}
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M4 12L20 12"
      className="origin-center -translate-y-[7px] transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-x-0 group-aria-expanded:translate-y-0 group-aria-expanded:rotate-315"
    />
    <path
      d="M4 12H20"
      className="origin-center transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.8)] group-aria-expanded:rotate-45"
    />
    <path
      d="M4 12H20"
      className="origin-center translate-y-[7px] transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-y-0 group-aria-expanded:rotate-135"
    />
  </svg>
);
// Types
export interface NavbarProps extends HTMLAttributes<HTMLElement> {
  session?: any;
}

export const Navbar = forwardRef<HTMLElement, NavbarProps>(
  ({ className, session, ...props }, ref) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const { setIsBasicNavbarMenuOpen } = useNavbar();

    const navLinks = [
      { href: "/", label: "Home" },
      { href: "/events", label: "Events" },
      { href: "/wiki", label: "Wiki" },
      { href: "/changelog", label: "Changelog" },
      { href: "/about", label: "About us" },
    ];

    const isActive = useCallback(
      (path: string) => {
        if (path === "/events") {
          return pathname === "/events" || pathname.startsWith("/events/");
        }
        if (path === "/wiki") {
          return pathname.startsWith("/wiki");
        }
        return pathname === path;
      },
      [pathname],
    );

    return (
      <header
        ref={ref}
        className={cn(
          "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-4 md:px-6 **:no-underline",
          className,
        )}
        {...props}
      >
        <div className="container mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-4">
          {/* Left side */}
          <div className="flex items-center gap-2">
            {/* Mobile menu trigger */}
            <div className="md:hidden">
              <Popover
                open={isMobileMenuOpen}
                onOpenChange={(open) => {
                  setIsMobileMenuOpen(open);
                  setIsBasicNavbarMenuOpen?.(open);
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    className="group h-9 w-9 hover:bg-accent hover:text-accent-foreground"
                    variant="ghost"
                    size="icon"
                  >
                    <HamburgerIcon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-3">
                  <nav className="mt-1 flex flex-col gap-1">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        className={cn(
                          "rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                          isActive(link.href) && "font-bold text-foreground",
                        )}
                        href={link.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                </PopoverContent>
              </Popover>
            </div>
            {/* Brand */}
            <Link href="/" className="flex items-center">
              <Logo className="size-6 light:invert" />
              <span className="ml-1 text-sm font-bold text-foreground">
                CORE
              </span>
            </Link>

            {/* Desktop nav */}
            <NavigationMenu className="ml-6 hidden md:block">
              <NavigationMenuList className="gap-2">
                {navLinks.map((link) => (
                  <NavigationMenuItem key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        "inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                        isActive(link.href)
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground/80 hover:text-foreground",
                      )}
                    >
                      {link.label}
                    </Link>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeSwitch />
            {session?.user?.id ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="outline-none rounded-full">
                    <Image
                      className="transition-transform rounded-full"
                      src={session?.user?.image}
                      alt="Profile"
                      width={40}
                      height={40}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-48 p-2">
                  <button
                    className="w-full rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                    onClick={() => router.push("/profile")}
                  >
                    Profile
                  </button>
                  <button
                    className="w-full rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent hover:text-accent-foreground text-left"
                    onClick={() => {
                      signOut().then(() => router.push("/"));
                    }}
                  >
                    Log Out
                  </button>
                </PopoverContent>
              </Popover>
            ) : (
              <GithubLoginButton />
            )}
          </div>
        </div>
      </header>
    );
  },
);
Navbar.displayName = "Navbar";
export default Navbar;
export { Logo, HamburgerIcon };
