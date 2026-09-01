// Выводы узла — короткие штрихи на тех сторонах, куда уходят дети.
//
// Аналогия из электроники: по числу ножек корпуса сразу видно, насколько
// деталь «связная». Так и здесь: узел-ветвление отличается от простого узла
// не подписью, а силуэтом — у листа выводов нет вообще.

import type { Side } from '../../renderer/edgeVisuals'

// Больше пяти штрихов на сторону сливаются в гребёнку и перестают читаться.
const MAX_PINS_PER_SIDE = 5

interface NodePinsProps {
  width: number
  height: number
  /** Число детей по сторонам. */
  counts: Record<Side, number>
  /** Свёрнутые стороны — выводы там бледнее: ветка есть, но скрыта. */
  foldedSides?: string[]
  color: string
  length: number
  strokeWidth: number
}

export function NodePins({ width, height, counts, foldedSides, color, length, strokeWidth }: NodePinsProps) {
  const sides: Side[] = ['top', 'right', 'bottom', 'left']
  const lines: React.ReactElement[] = []

  for (const side of sides) {
    const n = Math.min(counts[side], MAX_PINS_PER_SIDE)
    if (n <= 0) continue
    const folded = !!foldedSides?.includes(side)
    const horizontal = side === 'left' || side === 'right'
    // Штрихи распределяются по грани: n=1 → центр, n=2 → трети, и так далее.
    const span = horizontal ? height : width

    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 1)
      const pos = span * t
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0
      switch (side) {
        case 'right': x1 = width; x2 = width + length; y1 = y2 = pos; break
        case 'left': x1 = 0; x2 = -length; y1 = y2 = pos; break
        case 'bottom': y1 = height; y2 = height + length; x1 = x2 = pos; break
        case 'top': y1 = 0; y2 = -length; x1 = x2 = pos; break
      }
      lines.push(
        <line
          key={`${side}-${i}`}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={folded ? 0.35 : 0.75}
        />,
      )
    }
  }

  if (lines.length === 0) return null
  return <g pointerEvents="none">{lines}</g>
}
