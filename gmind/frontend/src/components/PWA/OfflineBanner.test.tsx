import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { OfflineBanner } from './OfflineBanner'

describe('OfflineBanner', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('renders nothing when online with no pending changes', () => {
    const { container } = render(<OfflineBanner pendingCount={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows banner when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    render(<OfflineBanner pendingCount={2} />)
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })
})
