export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "CORE",
  description:
    "CORE game is a competitive coding challenge where you design and program your own bots to battle it out in a dynamic 2D arena.",
  navItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Wiki",
      href: "/docs",
    },
    {
      label: "About us",
      href: "/about",
    },
  ],
  navMenuItems: [
    {
      label: "Profile",
      href: "/profile",
    },
    {
      label: "Index",
      href: "/dashboard",
    },
    {
      label: "Projects",
      href: "/projects",
    },
    {
      label: "Help & Feedback",
      href: "/help-feedback",
    },
  ],
  links: {
    github: "https://github.com/42core-team",
  },
};
