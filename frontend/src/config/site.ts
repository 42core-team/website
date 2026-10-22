export type SiteConfig = typeof siteConfig

export const siteConfig = {
  name: 'CORE',
  description:
    'CORE is a strategy game you can only play by programming. Write a bot in C or Go, command custom units to mine gems and outsmart your opponent, and destroy the enemy Core.',
  navItems: [
    {
      label: 'Home',
      href: '/',
    },
    {
      label: 'Wiki',
      href: '/wiki',
    },
    {
      label: 'About us',
      href: '/about',
    },
  ],
  navMenuItems: [
    {
      label: 'Profile',
      href: '/profile',
    },
    {
      label: 'Index',
      href: '/dashboard',
    },
    {
      label: 'Projects',
      href: '/projects',
    },
    {
      label: 'Help & Feedback',
      href: '/help-feedback',
    },
  ],
  links: {
    github: 'https://github.com/42core-team',
  },
}
