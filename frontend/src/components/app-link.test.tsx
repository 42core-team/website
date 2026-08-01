// @vitest-environment jsdom

import type { ComponentProps } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Link from './app-link'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    activeOptions,
    to,
    ...props
  }: ComponentProps<'a'> & {
    activeOptions?: { exact?: boolean }
    to: string
  }) => (
    <a
      href={to}
      data-exact={activeOptions?.exact?.toString() ?? 'unset'}
      {...props}
    />
  ),
}))

afterEach(cleanup)

describe('AppLink', () => {
  it('requires an exact match before marking the home link active', () => {
    render(<Link href="/">Home</Link>)

    expect(screen.getByRole('link', { name: 'Home' }).dataset.exact).toBe(
      'true',
    )
  })

  it('keeps nested route matching for non-home links', () => {
    render(<Link href="/events">Events</Link>)

    expect(screen.getByRole('link', { name: 'Events' }).dataset.exact).toBe(
      'unset',
    )
  })
})
