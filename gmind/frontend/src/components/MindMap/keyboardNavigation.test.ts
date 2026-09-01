import { describe, expect, it } from 'vitest'
import { nearestNodeInDirection } from './keyboardNavigation'

const nodes = new Map([
  ['center', { cx: 0, cy: 0 }],
  ['right-near-line', { cx: 100, cy: 10 }],
  ['right-off-axis', { cx: 60, cy: 80 }],
  ['left', { cx: -80, cy: 0 }],
  ['up', { cx: 0, cy: -70 }],
  ['down', { cx: 0, cy: 90 }],
])

describe('nearestNodeInDirection', () => {
  it('prefers the node continuing the visual branch', () => {
    expect(nearestNodeInDirection(nodes, 'center', 'right')).toBe('right-near-line')
  })

  it('supports every arrow direction', () => {
    expect(nearestNodeInDirection(nodes, 'center', 'left')).toBe('left')
    expect(nearestNodeInDirection(nodes, 'center', 'up')).toBe('up')
    expect(nearestNodeInDirection(nodes, 'center', 'down')).toBe('down')
  })

  it('returns null at the edge of the map', () => {
    expect(nearestNodeInDirection(nodes, 'right-near-line', 'right')).toBeNull()
  })
})
