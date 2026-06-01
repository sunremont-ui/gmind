import { describe, it, expect } from 'vitest'
import { edgeAttachment, type Rect } from './edgeAttachment'

const r = (x: number, y: number, w = 100, h = 40): Rect => ({ x, y, w, h })

describe('edgeAttachment', () => {
  it('attaches right→left when target is to the right', () => {
    const a = edgeAttachment(r(0, 0), r(300, 0))
    expect(a.fromX).toBe(100)        // from right edge
    expect(a.fromY).toBe(20)         // vertical center
    expect(a.toX).toBe(300)          // to left edge
    expect(a.toY).toBe(20)
  })

  it('attaches left→right when target is to the left', () => {
    const a = edgeAttachment(r(300, 0), r(0, 0))
    expect(a.fromX).toBe(300)        // from left edge
    expect(a.toX).toBe(100)          // to right edge
  })

  it('attaches bottom→top when target is below', () => {
    const a = edgeAttachment(r(0, 0), r(0, 300))
    expect(a.fromY).toBe(40)         // from bottom edge
    expect(a.fromX).toBe(50)         // horizontal center
    expect(a.toY).toBe(300)          // to top edge
  })

  it('attaches top→bottom when target is above', () => {
    const a = edgeAttachment(r(0, 300), r(0, 0))
    expect(a.fromY).toBe(300)        // from top edge
    expect(a.toY).toBe(40)           // to bottom edge
  })

  it('prefers the horizontal axis on a tie/diagonal with larger dx', () => {
    const a = edgeAttachment(r(0, 0), r(300, 100))
    // dx=300 > dy=100 → horizontal
    expect(a.fromX).toBe(100)
    expect(a.toX).toBe(300)
  })
})
