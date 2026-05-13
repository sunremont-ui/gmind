import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SaveStatusBar } from './SaveStatusBar'

describe('SaveStatusBar', () => {
  it('shows saved state when no pending changes', () => {
    render(<SaveStatusBar pendingCount={0} />)
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
  })

  it('shows offline state when pending count > 0', () => {
    render(<SaveStatusBar pendingCount={3} />)
    expect(screen.getByText(/Offline/)).toBeInTheDocument()
    expect(screen.getByText(/3 pending/)).toBeInTheDocument()
  })

  it('shows offline state when pending count = 0 but navigator.onLine = false', () => {
    const original = navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    render(<SaveStatusBar pendingCount={0} />)
    expect(screen.getByText(/Offline/)).toBeInTheDocument()
    Object.defineProperty(navigator, 'onLine', { value: original, configurable: true })
  })
})
