// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import LocationTags from './LocationTags'

afterEach(cleanup)

describe('LocationTags', () => {
  it('renders every complete tag', () => {
    render(<LocationTags tags={['42-berlin', '42-paris']} />)

    expect(screen.getByText('42-berlin')).toBeTruthy()
    expect(screen.getByText('42-paris')).toBeTruthy()
  })

  it('renders nothing for an empty tag list', () => {
    const { container } = render(<LocationTags tags={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
