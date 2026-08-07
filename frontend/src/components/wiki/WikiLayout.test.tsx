// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WikiLayout } from './WikiLayout'

vi.mock('@/lib/router-hooks', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/contexts/NavbarContext', () => ({
  useNavbar: () => ({ isBasicNavbarMenuOpen: false }),
}))

vi.mock('./VersionSelector', () => ({
  VersionSelector: () => null,
}))

vi.mock('./WikiNavigation', () => ({
  WikiNavigation: () => null,
}))

vi.mock('./WikiSearch', () => ({
  WikiSearch: () => null,
}))

afterEach(cleanup)

describe('WikiLayout', () => {
  it('resets the wiki content scroll position when the page changes', () => {
    const { container, rerender } = render(
      <WikiLayout navigation={[]} currentSlug={['getting-started']}>
        First page
      </WikiLayout>,
    )
    const content = container.querySelector<HTMLElement>('.main-wiki-content')!
    content.scrollTop = 480

    rerender(
      <WikiLayout navigation={[]} currentSlug={['configuration']}>
        Second page
      </WikiLayout>,
    )

    expect(content.scrollTop).toBe(0)
  })

  it('preserves the scroll position when the current page rerenders', () => {
    const { container, rerender } = render(
      <WikiLayout navigation={[]} currentSlug={['getting-started']}>
        First render
      </WikiLayout>,
    )
    const content = container.querySelector<HTMLElement>('.main-wiki-content')!
    content.scrollTop = 480

    rerender(
      <WikiLayout navigation={[]} currentSlug={['getting-started']}>
        Updated render
      </WikiLayout>,
    )

    expect(content.scrollTop).toBe(480)
  })
})
