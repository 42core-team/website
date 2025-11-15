"use client";

import type { NavbarProps } from "@heroui/react";
import {
  Button,
  cn,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
} from "@heroui/react";

import React from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeSwitch } from "@/components/theme-switch";
import GithubLoginButton from "@/components/github";
import { signOut } from "next-auth/react";
import { useNavbar } from "@/contexts/NavbarContext";
import Image from "next/image";

const BasicNavbar = React.forwardRef<
  HTMLElement,
  {
    children?: React.ReactNode | React.ReactNode[];
    classNames?: Partial<NavbarProps["classNames"]>;
    session: any;
  }
>(({ classNames = {}, ...props }, ref) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [clickedItem, setClickedItem] = React.useState<string | null>(null);
  const pathname = usePathname();
  const { setIsBasicNavbarMenuOpen } = useNavbar();
  const router = useRouter();

  React.useEffect(() => {
    setClickedItem(null);
  }, [pathname]);

  const isActive = React.useCallback(
    (path: string) => {
      if (clickedItem) {
        return clickedItem === path;
      }
      if (path === "/events") {
        return pathname === "/events" || pathname.startsWith("/events/");
      }
      if (path === "/wiki") {
        return pathname.startsWith("/wiki");
      }
      return pathname === path;
    },
    [clickedItem, pathname],
  );

  return (
    <Navbar
      ref={ref}
      {...props}
      classNames={{
        base: cn("border-default-100 bg-transparent", {
          "bg-default-200/50 dark:bg-default-100/50": isMenuOpen,
        }),
        wrapper: "w-full justify-center",
        item: "hidden md:flex",
        ...classNames,
      }}
      height="60px"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={(open) => {
        setIsMenuOpen(open);
        setIsBasicNavbarMenuOpen(open);
      }}
    >
      {/* Left Content */}
      <NavbarBrand>
        <Link
          className="flex items-center"
          href="/"
          onPointerDown={() => setClickedItem("/")}
          onClick={() => setClickedItem("/")}
        >
          <Image
            src="/logo-black.svg"
            width={35}
            height={35}
            alt="CORE"
            className="dark:hidden"
          />
          <Image
            src="/logo-white.svg"
            width={35}
            height={35}
            alt="CORE"
            className="hidden dark:block"
          />
          <span className="ml-1 text-small font-medium text-default-foreground">
            CORE
          </span>
        </Link>
      </NavbarBrand>

      {/* Center Content */}
      <NavbarContent justify="center">
        <NavbarItem>
          <Link
            className={cn("text-default-500", {
              "font-bold text-default-foreground": isActive("/"),
            })}
            href="/"
            onPointerDown={() => setClickedItem("/")}
            onClick={() => setClickedItem("/")}
          >
            Home
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Link
            className={cn("text-default-500", {
              "font-bold text-default-foreground": isActive("/events"),
            })}
            href="/events"
            onPointerDown={() => setClickedItem("/events")}
            onClick={() => setClickedItem("/events")}
          >
            Events
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Link
            className={cn("text-default-500", {
              "font-bold text-default-foreground": isActive("/wiki"),
            })}
            href="/wiki"
            onPointerDown={() => setClickedItem("/wiki")}
            onClick={() => setClickedItem("/wiki")}
          >
            Wiki
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Link
            className={cn("text-default-500", {
              "font-bold text-default-foreground": isActive("/changelog"),
            })}
            href="/changelog"
            onPointerDown={() => setClickedItem("/changelog")}
            onClick={() => setClickedItem("/changelog")}
          >
            Changelog
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Link
            className={cn("text-default-500", {
              "font-bold text-default-foreground": isActive("/about"),
            })}
            href="/about"
            onPointerDown={() => setClickedItem("/about")}
            onClick={() => setClickedItem("/about")}
          >
            About Us
          </Link>
        </NavbarItem>
      </NavbarContent>

      {/* Right Content */}
      <NavbarContent className="hidden md:flex" justify="end">
        <NavbarItem className="ml-2 flex! gap-2">
          <ThemeSwitch />
          {props.session?.user.id ? (
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <button
                  className="p-0 border-none outline-hidden"
                  style={{ borderRadius: "50%" }}
                >
                  <Image
                    className="transition-transform"
                    src={props?.session?.user.image}
                    alt="Profile"
                    width={40}
                    height={40}
                    style={{ borderRadius: "50%" }}
                  />
                </button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Profile Actions" variant="flat">
                <DropdownItem
                  key="profile"
                  onPress={() => router.push("/profile")}
                >
                  Profile
                </DropdownItem>

                {/* <DropdownItem key="settings" href="/settings">
                                        Settings
                                    </DropdownItem> */}
                <DropdownItem
                  key="logout"
                  color="danger"
                  onPress={() => {
                    signOut().then(() => {
                      router.push("/");
                    });
                  }}
                >
                  Log Out
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          ) : (
            <GithubLoginButton />
          )}
        </NavbarItem>
      </NavbarContent>

      <NavbarMenuToggle className="text-default-400 md:hidden" />

      <NavbarMenu
        className="top-[calc(var(--navbar-height)-1px)] max-h-fit bg-default-200/50 pb-6 pt-6 shadow-medium backdrop-blur-md backdrop-saturate-150 dark:bg-default-100/50"
        motionProps={{
          initial: { opacity: 0, y: -20 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -20 },
          transition: {
            ease: "easeInOut",
            duration: 0.2,
          },
        }}
      >
        <NavbarMenuItem className="mb-4">
          <Button
            fullWidth
            as={Link}
            className="bg-foreground text-background"
            href="/#"
            onPressStart={() => setClickedItem("/#")}
            onPress={() => setClickedItem("/#")}
          >
            Get Started
          </Button>
        </NavbarMenuItem>
        <NavbarMenuItem>
          <Link
            className={cn("mb-2 w-full text-default-500", {
              "font-bold text-default-foreground": isActive("/"),
            })}
            href="/"
            onPointerDown={() => setClickedItem("/")}
            onClick={() => setClickedItem("/")}
          >
            Home
          </Link>
        </NavbarMenuItem>
        <NavbarMenuItem>
          <Link
            className={cn("mb-2 w-full text-default-500", {
              "font-bold text-default-foreground": isActive("/events"),
            })}
            href="/events"
            onPointerDown={() => setClickedItem("/events")}
            onClick={() => setClickedItem("/events")}
          >
            Events
          </Link>
        </NavbarMenuItem>
        <NavbarMenuItem>
          <Link
            className={cn("mb-2 w-full text-default-500", {
              "font-bold text-default-foreground": isActive("/wiki"),
            })}
            href="/wiki"
            onPointerDown={() => setClickedItem("/wiki")}
            onClick={() => setClickedItem("/wiki")}
          >
            Wiki
          </Link>
        </NavbarMenuItem>
        <NavbarMenuItem>
          <Link
            className={cn("mb-2 w-full text-default-500", {
              "font-bold text-default-foreground": isActive("/changelog"),
            })}
            href="/changelog"
            onPointerDown={() => setClickedItem("/changelog")}
            onClick={() => setClickedItem("/changelog")}
          >
            Changelog
          </Link>
        </NavbarMenuItem>
        <NavbarMenuItem>
          <Link
            className={cn("mb-2 w-full text-default-500", {
              "font-bold text-default-foreground": isActive("/about"),
            })}
            href="/about"
            onPointerDown={() => setClickedItem("/about")}
            onClick={() => setClickedItem("/about")}
          >
            About us
          </Link>
        </NavbarMenuItem>

        {/* Theme Switch and Login/Logout in mobile menu */}
        <NavbarMenuItem className="mt-4 pt-4 border-t border-default-200 flex flex-col gap-4">
          {props?.session?.user.id ? (
            <Button
              color="danger"
              variant="flat"
              fullWidth
              onPress={() => {
                signOut().then(() => {
                  router.push("/");
                });
              }}
            >
              Log Out
            </Button>
          ) : (
            <GithubLoginButton />
          )}
        </NavbarMenuItem>
      </NavbarMenu>
    </Navbar>
  );
});

BasicNavbar.displayName = "BasicNavbar";

export default BasicNavbar;
