import { Link as RouterLink } from '@tanstack/react-router'
import type { ActiveOptions } from '@tanstack/react-router'
import React from 'react'

type AppLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> & {
  activeOptions?: ActiveOptions
  href?: string
  to?: string
}

export default function Link({
  activeOptions,
  href,
  to,
  ...props
}: AppLinkProps) {
  const target = to || href || '/'

  if (/^(https?:|mailto:|tel:)/.test(target) || props.target === '_blank') {
    return <a href={target} {...props} />
  }

  return (
    <RouterLink
      to={target}
      activeOptions={
        activeOptions ?? (target === '/' ? { exact: true } : undefined)
      }
      {...props}
    />
  )
}
