import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ToolPanel, type Tool, type ToolPanelProps } from './ToolPanel'

function defaultProps(overrides: Partial<ToolPanelProps> = {}): ToolPanelProps {
  return {
    activeTool: 'pointer' as Tool,
    onToolSelect: vi.fn() as ToolPanelProps['onToolSelect'],
    showStyle: false,
    onStyleToggle: vi.fn() as ToolPanelProps['onStyleToggle'],
    onExportXMind: vi.fn() as ToolPanelProps['onExportXMind'],
    onExportSVG: vi.fn() as ToolPanelProps['onExportSVG'],
    onExportPNG: vi.fn() as ToolPanelProps['onExportPNG'],
    onExportPDF: vi.fn() as ToolPanelProps['onExportPDF'],
    onExportMarkdown: vi.fn() as ToolPanelProps['onExportMarkdown'],
    onExportFreeMind: vi.fn() as ToolPanelProps['onExportFreeMind'],
    onExportOPML: vi.fn() as ToolPanelProps['onExportOPML'],
    onImportXMind: vi.fn() as ToolPanelProps['onImportXMind'],
    onImportMarkdown: vi.fn() as ToolPanelProps['onImportMarkdown'],
    onBatchImport: vi.fn() as ToolPanelProps['onBatchImport'],
    onImportFreeMind: vi.fn() as ToolPanelProps['onImportFreeMind'],
    onImportJSON: vi.fn() as ToolPanelProps['onImportJSON'],
    onClearImportData: vi.fn() as ToolPanelProps['onClearImportData'],
    hasImportedData: false,
    presenceCount: 0,
    onPresenceToggle: vi.fn() as ToolPanelProps['onPresenceToggle'],
    onSummarize: vi.fn() as ToolPanelProps['onSummarize'],
    summaryLoading: false,
    onGenerateImage: vi.fn() as ToolPanelProps['onGenerateImage'],
    onAIServer: vi.fn() as ToolPanelProps['onAIServer'],
    closeToken: 0,
    ...overrides,
  }
}

describe('ToolPanel', () => {
  it('renders all tool buttons (pointer, topic, floating, sticky)', () => {
    render(<ToolPanel {...defaultProps({})} />)
    expect(screen.getByTitle('Select')).toBeInTheDocument()
    expect(screen.getByTitle('Add Topic')).toBeInTheDocument()
    expect(screen.getByTitle('Floating')).toBeInTheDocument()
    expect(screen.getByTitle('Sticky Note')).toBeInTheDocument()
  })

  it('calls onToolSelect when a tool is clicked', () => {
    const onToolSelect = vi.fn()
    render(<ToolPanel {...defaultProps({ onToolSelect })} />)

    fireEvent.click(screen.getByTitle('Add Topic'))
    expect(onToolSelect).toHaveBeenCalledWith('topic')
  })

  it('highlights the active tool', () => {
    render(<ToolPanel {...defaultProps({ activeTool: 'floating' })} />)
    const floatingBtn = screen.getByTitle('Floating')
    const pointerBtn = screen.getByTitle('Select')
    expect(floatingBtn.style.color).toBe('rgb(91, 108, 255)')
    expect(pointerBtn.style.color).not.toBe('rgb(91, 108, 255)')
  })

  it('renders style panel toggle', () => {
    render(<ToolPanel {...defaultProps({})} />)
    expect(screen.getByTitle('Style Panel')).toBeInTheDocument()
  })

  it('calls onStyleToggle when style button clicked', () => {
    const onStyleToggle = vi.fn()
    render(<ToolPanel {...defaultProps({ onStyleToggle })} />)
    fireEvent.click(screen.getByTitle('Style Panel'))
    expect(onStyleToggle).toHaveBeenCalledOnce()
  })

  it('renders export button and shows popover on click', () => {
    render(<ToolPanel {...defaultProps({})} />)
    fireEvent.click(screen.getByTitle('Export'))
    expect(screen.getByText('SVG')).toBeInTheDocument()
    expect(screen.getByText('PNG')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
    expect(screen.getByText('XMind (.xmind)')).toBeInTheDocument()
    expect(screen.getByText('OPML (.opml)')).toBeInTheDocument()
  })

  it('renders import button and shows popover on click', () => {
    render(<ToolPanel {...defaultProps({})} />)
    fireEvent.click(screen.getByTitle('Import'))
    expect(screen.getByText('Batch import (multi-file)')).toBeInTheDocument()
    expect(screen.getByText('XMind (.xmind)')).toBeInTheDocument()
    expect(screen.getByText('JSON (AI context)')).toBeInTheDocument()
    expect(screen.getByText('Markdown (.md)')).toBeInTheDocument()
    expect(screen.getByText('FreeMind (.mm)')).toBeInTheDocument()
  })

  it('renders presence count when > 0', () => {
    render(<ToolPanel {...defaultProps({ presenceCount: 3 })} />)
    expect(screen.getByTitle('Online: 3')).toBeInTheDocument()
  })

  it('renders AI server button', () => {
    render(<ToolPanel {...defaultProps({})} />)
    expect(screen.getByTitle('Local AI Server')).toBeInTheDocument()
  })

  it('renders AI summarize button', () => {
    render(<ToolPanel {...defaultProps({})} />)
    expect(screen.getByTitle('AI Summarize')).toBeInTheDocument()
  })

  it('renders generate image button', () => {
    render(<ToolPanel {...defaultProps({})} />)
    expect(screen.getByTitle('Generate Image (DALL-E)')).toBeInTheDocument()
  })

  it('shows clear import button when hasImportedData', () => {
    render(<ToolPanel {...defaultProps({ hasImportedData: true })} />)
    expect(screen.getByTitle('Clear imported data')).toBeInTheDocument()
  })

  it('calls onExportSVG when SVG clicked', () => {
    const onExportSVG = vi.fn()
    render(<ToolPanel {...defaultProps({ onExportSVG })} />)
    fireEvent.click(screen.getByTitle('Export'))
    fireEvent.click(screen.getByText('SVG'))
    expect(onExportSVG).toHaveBeenCalledOnce()
  })

  it('closes popovers when closeToken changes', () => {
    const { rerender } = render(<ToolPanel {...defaultProps({ closeToken: 0 })} />)
    fireEvent.click(screen.getByTitle('Export'))
    expect(screen.getByText('SVG')).toBeInTheDocument()

    rerender(<ToolPanel {...defaultProps({ closeToken: 1 })} />)
    expect(screen.queryByText('SVG')).not.toBeInTheDocument()
  })
})
