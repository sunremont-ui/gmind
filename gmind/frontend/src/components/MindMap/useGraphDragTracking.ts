// V5.0 — global pointer tracking for relationship drag.
// Translates client coordinates to SVG/world coordinates and resolves drop target.
import { useEffect, useCallback } from 'react'
import { useRelationshipsStore } from '../../store/relationships'

interface Options {
  svgRef: React.RefObject<SVGSVGElement | null>
  clientToWorld: (x: number, y: number) => { x: number; y: number }
}

export function useGraphDragTracking({ svgRef, clientToWorld }: Options) {
  const drag = useRelationshipsStore(s => s.drag)
  const updateDrag = useRelationshipsStore(s => s.updateDrag)
  const endDrag = useRelationshipsStore(s => s.endDrag)
  const openPopover = useRelationshipsStore(s => s.openPopover)
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
      const result = endDrag()
      if (result && result.from !== result.to) {
        openPopover(result.from, result.to, e.clientX, e.clientY)
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
  }, [drag.isDragging, clientToWorld, resolveHover, updateDrag, endDrag, openPopover, cancelDrag])
}
