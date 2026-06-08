// V5.0 — global pointer tracking for relationship drag.
// Translates client coordinates to SVG/world coordinates and resolves drop target.
import { useEffect, useCallback } from 'react'
import { useRelationshipsStore, type AnchorSide } from '../../store/relationships'

interface Options {
  svgRef: React.RefObject<SVGSVGElement | null>
  clientToWorld: (x: number, y: number) => { x: number; y: number }
  // Перетащили от якоря в пустоту → создать ребёнка в этом направлении.
  onCreateChildDrag?: (topicId: string, side: AnchorSide) => void
}

// World-space movement below this counts as a click (not a relationship drag).
const CLICK_THRESHOLD = 6

export function useGraphDragTracking({ svgRef, clientToWorld, onCreateChildDrag }: Options) {
  const drag = useRelationshipsStore(s => s.drag)
  const updateDrag = useRelationshipsStore(s => s.updateDrag)
  const endDrag = useRelationshipsStore(s => s.endDrag)
  const openPopover = useRelationshipsStore(s => s.openPopover)
  const openAnchorMenu = useRelationshipsStore(s => s.openAnchorMenu)
  const cancelDrag = useRelationshipsStore(s => s.cancelDrag)

  const resolveHover = useCallback((clientX: number, clientY: number): string | null => {
    const el = document.elementFromPoint(clientX, clientY)
    if (!el) return null
    const target = (el.closest('[data-topic-id]') as HTMLElement | SVGElement | null)
    return target?.getAttribute('data-topic-id') ?? null
  }, [])

  useEffect(() => {
    if (!drag.isDragging) return

    const onMove = (e: PointerEvent) => {
      const { x, y } = clientToWorld(e.clientX, e.clientY)
      const hoverId = resolveHover(e.clientX, e.clientY)
      updateDrag(x, y, hoverId)
    }

    const onUp = (e: PointerEvent) => {
      // Capture drag origin before endDrag() resets it.
      const dr = useRelationshipsStore.getState().drag
      const moved = Math.hypot(dr.currentX - dr.startX, dr.currentY - dr.startY)
      const fromId = dr.fromTopicId
      const side = dr.fromAnchor
      const result = endDrag()
      if (result && result.from !== result.to) {
        // Dropped on another node → create a relationship.
        openPopover(result.from, result.to, e.clientX, e.clientY)
      } else if (moved < CLICK_THRESHOLD && fromId && side) {
        // Click on the anchor (no drag) → offer to create a child in that direction.
        openAnchorMenu(fromId, side, e.clientX, e.clientY)
      } else if (fromId && onCreateChildDrag) {
        // Dragged into empty space → create a child toward the drag direction.
        const dx = dr.currentX - dr.startX
        const dy = dr.currentY - dr.startY
        const dragSide: AnchorSide = Math.abs(dx) >= Math.abs(dy)
          ? (dx >= 0 ? 'right' : 'left')
          : (dy >= 0 ? 'bottom' : 'top')
        onCreateChildDrag(fromId, dragSide)
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDrag()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [drag.isDragging, clientToWorld, resolveHover, updateDrag, endDrag, openPopover, openAnchorMenu, onCreateChildDrag, cancelDrag])
}
