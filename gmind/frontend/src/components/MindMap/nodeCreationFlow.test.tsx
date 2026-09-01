import { fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LayoutNode } from '../../types'
import { useRelationshipsStore } from '../../store/relationships'
import { EdgeAnchorsLayer } from './EdgeAnchorsLayer'
import { NodeStyleQuickPicker } from './NodeStyleQuickPicker'
import { TopicNode } from './TopicNode'
import { RichTextEditor } from '../RichTextEditor/RichTextEditor'

const node: LayoutNode = {
  x: 100,
  y: 100,
  width: 120,
  height: 48,
  topic: { id: 'root', title: 'Root', folded: false, children: [] },
  children: [],
}

describe('directed node creation flow', () => {
  beforeEach(() => {
    useRelationshipsStore.getState().cancelDrag()
  })

  it('reveals three 45-degree choices for a hovered side', () => {
    const onCreate = vi.fn()
    const { container } = render(
      <svg>
        <EdgeAnchorsLayer node={node} onCreateChild={onCreate} />
      </svg>,
    )

    fireEvent.pointerEnter(container.querySelector('[data-anchor-side="top"]')!)
    expect([...container.querySelectorAll('[data-create-direction]')].map(element =>
      element.getAttribute('data-create-direction'))).toEqual(['up-left', 'up', 'up-right'])

    fireEvent.click(container.querySelector('[data-create-direction="up-right"]')!)
    expect(onCreate).toHaveBeenCalledWith('root', 'up-right', 'top')
  })

  it('hands Tab from title editing to the style step', () => {
    const onStyleRequest = vi.fn()
    const { container } = render(
      <RichTextEditor
        value="Новый узел"
        onChange={() => {}}
        onSave={() => {}}
        onStyleRequest={onStyleRequest}
        onCancel={() => {}}
        fontSize={14}
        fontFamily="sans-serif"
        fontColor="#111"
        textAlign="left"
      />,
    )
    const editor = container.querySelector('[contenteditable="true"]')!
    fireEvent.keyDown(editor, { key: 'Tab' })
    expect(onStyleRequest).toHaveBeenCalledWith('Новый узел')
  })

  it('accepts a custom node class in the style picker', () => {
    const onChange = vi.fn()
    const { getByLabelText } = render(
      <NodeStyleQuickPicker
        topic={node.topic}
        x={120}
        y={120}
        onChange={onChange}
        onClose={() => {}}
      />,
    )

    const classInput = getByLabelText('Класс узла')
    fireEvent.change(classInput, { target: { value: 'research-note' } })
    fireEvent.blur(classInput)
    expect(onChange).toHaveBeenCalledWith({ memory_kind: 'research-note' })
  })

  it('loads the existing node text when inline editing starts', async () => {
    const existingNode: LayoutNode = {
      ...node,
      topic: { ...node.topic, title: 'Существующий заголовок', body: 'Тело узла' },
    }
    const noop = () => {}
    const { container } = render(
      <svg>
        <TopicNode
          layout={existingNode}
          isSelected
          isDragOver={false}
          isDragging={false}
          isRoot
          isEditing
          searchQuery=""
          onSelect={noop}
          onDoubleClick={noop}
          onContextMenu={noop}
          onDragStart={noop}
          onDragOver={noop}
          onDrop={noop}
          onEditSave={noop}
          onEditCancel={noop}
        />
      </svg>,
    )

    await waitFor(() => expect(container.querySelector('[contenteditable="true"]')?.textContent)
      .toContain('Существующий заголовок'))
    expect(container.querySelector('[contenteditable="true"]')?.textContent).toContain('Тело узла')
  })
})
