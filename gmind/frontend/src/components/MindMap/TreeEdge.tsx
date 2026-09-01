import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { closestDirectionForPort, oppositeNodeSide, type ChildDirection, type NodeSide } from './nodeDirections'
import { sidePoint, type NodeObstacle, type Point } from '../../renderer/edgeRouting'
import { colors } from '../../styles/tokens'

interface Props {
  childId: string
  path: string
  parentRect: NodeObstacle
  childRect: NodeObstacle
  fromSide: NodeSide
  stroke: string
  strokeWidth: number
  opacity: number
  dash?: string
  onAnchorChange?: (childId: string, parentSide: NodeSide, childDirection: ChildDirection) => void
}

type DragEnd = 'parent' | 'child'

const SIDES: NodeSide[] = ['top', 'right', 'bottom', 'left']

function clientToSvg(event: PointerEvent): Point {
  const svg = event.target instanceof SVGElement ? event.target.ownerSVGElement : document.querySelector('svg')
  const matrix = svg?.getScreenCTM?.()
  if (!svg || !matrix) return { x: event.clientX, y: event.clientY }
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const world = point.matrixTransform(matrix.inverse())
  return { x: world.x, y: world.y }
}

function nearestSide(rect: NodeObstacle, point: Point): NodeSide {
  const distances: Record<NodeSide, number> = {
    top: Math.hypot(point.x - (rect.x + rect.width / 2), point.y - rect.y),
    right: Math.hypot(point.x - (rect.x + rect.width), point.y - (rect.y + rect.height / 2)),
    bottom: Math.hypot(point.x - (rect.x + rect.width / 2), point.y - (rect.y + rect.height)),
    left: Math.hypot(point.x - rect.x, point.y - (rect.y + rect.height / 2)),
  }
  return SIDES.reduce((best, side) => distances[side] < distances[best] ? side : best, 'top')
}

export function TreeEdge({
  childId, path, parentRect, childRect, fromSide,
  stroke, strokeWidth, opacity, dash, onAnchorChange,
}: Props) {
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState<DragEnd | null>(null)
  const [pointer, setPointer] = useState<Point | null>(null)
  const groupRef = useRef<SVGGElement>(null)
  const leaveTimer = useRef<number | null>(null)
  const [overlayHost, setOverlayHost] = useState<SVGGElement | null>(null)
  const toSide = oppositeNodeSide(fromSide)
  const from = sidePoint(parentRect, fromSide)
  const to = sidePoint(childRect, toSide)
  const targetRect = dragging === 'parent' ? parentRect : childRect
  const candidateSide = useMemo(
    () => pointer && dragging ? nearestSide(targetRect, pointer) : null,
    [pointer, dragging, targetRect],
  )

  useEffect(() => {
    if (!dragging) return
    const move = (event: PointerEvent) => setPointer(clientToSvg(event))
    const up = (event: PointerEvent) => {
      const point = clientToSvg(event)
      const side = nearestSide(targetRect, point)
      const parentSide = dragging === 'parent' ? side : oppositeNodeSide(side)
      const parentCenter = {
        x: parentRect.x + parentRect.width / 2,
        y: parentRect.y + parentRect.height / 2,
      }
      const childCenter = {
        x: childRect.x + childRect.width / 2,
        y: childRect.y + childRect.height / 2,
      }
      const childDirection = closestDirectionForPort(
        parentSide,
        childCenter.x - parentCenter.x,
        childCenter.y - parentCenter.y,
      )
      onAnchorChange?.(childId, parentSide, childDirection)
      setDragging(null)
      setPointer(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [childId, childRect, dragging, onAnchorChange, parentRect, targetRect])

  useEffect(() => () => {
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
  }, [])

  const enter = () => {
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
    setOverlayHost(groupRef.current?.parentElement as SVGGElement | null)
    setHovered(true)
  }
  const leave = () => {
    if (dragging) return
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => setHovered(false), 140)
  }

  const begin = (end: DragEnd) => (event: React.PointerEvent<SVGCircleElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragging(end)
    setPointer({ x: end === 'parent' ? from.x : to.x, y: end === 'parent' ? from.y : to.y })
  }

  const showHandles = !!onAnchorChange && (hovered || dragging)

  return (
    <g
      ref={groupRef}
      data-tree-edge-child={childId}
      onPointerEnter={enter}
      onPointerLeave={leave}
    >
      <path d={path} fill="none" stroke="transparent" strokeWidth={Math.max(16, strokeWidth + 12)} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth}
        opacity={opacity} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />

      {showHandles && overlayHost && createPortal(
        <g data-tree-edge-overlay-child={childId} onPointerEnter={enter} onPointerLeave={leave}>
          <circle data-edge-handle="parent" cx={from.x} cy={from.y} r={7}
            fill={colors.bgTertiary} stroke={colors.accent} strokeWidth={2}
            style={{ cursor: 'grab' }} onPointerDown={begin('parent')} />
          <circle data-edge-handle="child" cx={to.x} cy={to.y} r={7}
            fill={colors.bgTertiary} stroke={colors.accent} strokeWidth={2}
            style={{ cursor: 'grab' }} onPointerDown={begin('child')} />
          {dragging && (
            <g pointerEvents="none">
              {SIDES.map(side => {
                const point = sidePoint(targetRect, side)
                const active = candidateSide === side
                return <circle key={side} cx={point.x} cy={point.y} r={active ? 10 : 6}
                  fill={active ? colors.accent : colors.bgTertiary}
                  stroke={colors.accent} strokeWidth={2} opacity={0.95} />
              })}
              {pointer && <line
                x1={dragging === 'parent' ? to.x : from.x}
                y1={dragging === 'parent' ? to.y : from.y}
                x2={pointer.x} y2={pointer.y}
              stroke={colors.accent} strokeWidth={2} strokeDasharray="5,4" opacity={0.65}
              />}
            </g>
          )}
        </g>,
        overlayHost,
      )}
    </g>
  )
}
