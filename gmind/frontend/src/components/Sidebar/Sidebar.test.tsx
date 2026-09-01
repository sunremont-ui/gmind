import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from './Sidebar'
import { api } from '../../api/client'
import { offlineSettings } from '../../utils/offline'

describe('Sidebar resize', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(api, 'listWorkbooks').mockResolvedValue([])
    vi.spyOn(offlineSettings, 'get').mockResolvedValue(undefined)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
  })

  it('изменяет ширину мышью и сохраняет результат', async () => {
    render(<Sidebar activeWorkbookId={null} onSelectWorkbook={() => {}} />)
    const separator = screen.getByRole('separator', { name: 'Изменить ширину боковой панели' })
    const sidebar = separator.parentElement!

    expect(sidebar).toHaveStyle({ width: '260px' })
    fireEvent.pointerDown(separator, { button: 0, clientX: 260 })
    fireEvent.pointerMove(window, { clientX: 380 })
    expect(sidebar).toHaveStyle({ width: '380px' })
    fireEvent.pointerUp(window)

    await waitFor(() => expect(localStorage.getItem('gmind_sidebar_width')).toBe('380'))
  })

  it('поддерживает клавиатуру, ограничения и сброс ширины', () => {
    localStorage.setItem('gmind_sidebar_width', '552')
    render(<Sidebar activeWorkbookId={null} onSelectWorkbook={() => {}} />)
    const separator = screen.getByRole('separator', { name: 'Изменить ширину боковой панели' })
    const sidebar = separator.parentElement!

    fireEvent.keyDown(separator, { key: 'ArrowRight' })
    expect(sidebar).toHaveStyle({ width: '560px' })
    fireEvent.keyDown(separator, { key: 'Home' })
    expect(sidebar).toHaveStyle({ width: '260px' })
    fireEvent.doubleClick(separator)
    expect(localStorage.getItem('gmind_sidebar_width')).toBe('260')
  })

  it('не показывает разделитель у скрытой панели', () => {
    render(<Sidebar activeWorkbookId={null} onSelectWorkbook={() => {}} collapsed />)
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })
})
