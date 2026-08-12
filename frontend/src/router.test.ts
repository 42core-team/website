import { describe, expect, it } from 'vitest'
import { getRouter } from './router'

describe('router scroll restoration', () => {
  it('resets the nested wiki scroll container on page navigation', () => {
    const router = getRouter()

    expect(router.options.scrollToTopSelectors).toContain('.main-wiki-content')
  })
})
