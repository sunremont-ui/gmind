// V6.1 — side-aware edge attachment for relationship lines.
// Given the bounding rects of two nodes, picks the pair of facing border
// midpoints (left/right/top/bottom) so the edge visually connects the sides
// that face each other instead of a fixed corner point.

export interface Rect { x: number; y: number; w: number; h: number }

export interface Attachment { fromX: number; fromY: number; toX: number; toY: number }

function center(r: Rect) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

// Border midpoint of `r` on the given side.
function sidePoint(r: Rect, side: 'left' | 'right' | 'top' | 'bottom') {
  switch (side) {
    case 'left': return { x: r.x, y: r.y + r.h / 2 }
    case 'right': return { x: r.x + r.w, y: r.y + r.h / 2 }
    case 'top': return { x: r.x + r.w / 2, y: r.y }
    case 'bottom': return { x: r.x + r.w / 2, y: r.y + r.h }
  }
}

export function edgeAttachment(from: Rect, to: Rect): Attachment {
  const fc = center(from)
  const tc = center(to)
  const dx = tc.x - fc.x
  const dy = tc.y - fc.y

  let fromSide: 'left' | 'right' | 'top' | 'bottom'
  let toSide: 'left' | 'right' | 'top' | 'bottom'
  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal dominant.
    fromSide = dx >= 0 ? 'right' : 'left'
    toSide = dx >= 0 ? 'left' : 'right'
  } else {
    // Vertical dominant.
    fromSide = dy >= 0 ? 'bottom' : 'top'
    toSide = dy >= 0 ? 'top' : 'bottom'
  }

  const fp = sidePoint(from, fromSide)
  const tp = sidePoint(to, toSide)
  return { fromX: fp.x, fromY: fp.y, toX: tp.x, toY: tp.y }
}
