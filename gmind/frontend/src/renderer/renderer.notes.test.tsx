import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode } from '../types'
import { MindMapRenderer } from './renderer'

const root: LayoutNode = {
  topic: {
    id: 'topic-1',
    title: 'Research',
    notes: 'Check the primary sources.',
    folded: false,
    children: [],
  },
  x: 100,
  y: 80,
  width: 120,
  height: 48,
  children: [],
}

function renderMap(expandedNoteIds: ReadonlySet<string>, onNotesClick = vi.fn(), onNoteSelect = vi.fn()) {
  const view = render(
    <svg>
      <MindMapRenderer
        root={root}
        selectedTopicId={null}
        dragOverTopicId={null}
        draggingTopicId={null}
        editingTopicId={null}
        searchQuery=""
        expandedNoteIds={expandedNoteIds}
        selectedNoteId="topic-1"
        onTopicSelect={vi.fn()}
        onTopicDoubleClick={vi.fn()}
        onTopicContextMenu={vi.fn()}
        onTopicDragStart={vi.fn()}
        onTopicDragOver={vi.fn()}
        onTopicDrop={vi.fn()}
        onTopicEditSave={vi.fn()}
        onTopicEditCancel={vi.fn()}
        onTopicNotesClick={onNotesClick}
        onNoteSelect={onNoteSelect}
      />
    </svg>,
  )
  return { ...view, onNotesClick, onNoteSelect }
}

describe('expanded Notes nodes', () => {
  it('keeps Notes hidden by default', () => {
    renderMap(new Set())

    expect(screen.queryByRole('note', { name: 'Notes for Research' })).not.toBeInTheDocument()
  })

  it('renders a dashed, selectable note node without selecting its text', () => {
    const { onNotesClick, onNoteSelect } = renderMap(new Set(['topic-1']))

    const note = screen.getByRole('note', { name: 'Notes for Research' })
    expect(note).toHaveAttribute('data-note-topic-id', 'topic-1')
    expect(note.querySelector('rect')).toHaveAttribute('stroke-dasharray', '7,5')
    expect(note).toHaveTextContent('Check the primary sources.')
    expect(note).toHaveAttribute('data-selected', 'true')
    expect(note.querySelector('[data-note-scroll="true"]')).toHaveStyle({ userSelect: 'none' })

    fireEvent.click(note)
    expect(onNotesClick).not.toHaveBeenCalled()
    expect(onNoteSelect).toHaveBeenCalledWith('topic-1')
  })
})
