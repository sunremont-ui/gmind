import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TreeEdge } from './TreeEdge'

describe('TreeEdge port reassignment', () => {
  it('shows endpoint handles on hover and drags the parent end to another port', () => {
    const onChange = vi.fn()
    const { container } = render(
      <svg>
        <TreeEdge
          childId="child"
          path="M 100 50 L 200 50"
          parentRect={{ id: 'parent', x: 20, y: 20, width: 80, height: 60 }}
          childRect={{ id: 'child', x: 200, y: 20, width: 80, height: 60 }}
          fromSide="right"
          stroke="#333"
          strokeWidth={2}
          opacity={1}
          onAnchorChange={onChange}
        />
      </svg>,
    )
    const edge = container.querySelector('[data-tree-edge-child="child"]')!
    fireEvent.pointerEnter(edge)
    const handle = container.querySelector('[data-edge-handle="parent"]')!
    expect(handle).toBeTruthy()
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 50 })
    fireEvent.pointerUp(window, { clientX: 60, clientY: 20 })
    expect(onChange).toHaveBeenCalledWith('child', 'top', 'up-right')
  })
})
