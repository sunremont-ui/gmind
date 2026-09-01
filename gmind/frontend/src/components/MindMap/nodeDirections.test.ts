import { describe, expect, it } from 'vitest'
import {
  closestDirectionForPort,
  DIRECTIONS_BY_PORT,
  isDirectionCompatibleWithPort,
  type ChildDirection,
  type NodeSide,
} from './nodeDirections'

describe('physical port direction fan', () => {
  it('exposes exactly the three compatible 45-degree rays for every port', () => {
    expect(DIRECTIONS_BY_PORT).toEqual({
      top: ['up-left', 'up', 'up-right'],
      right: ['up-right', 'right', 'down-right'],
      bottom: ['down-right', 'down', 'down-left'],
      left: ['down-left', 'left', 'up-left'],
    })

    for (const [side, directions] of Object.entries(DIRECTIONS_BY_PORT) as [NodeSide, readonly ChildDirection[]][]) {
      expect(directions).toHaveLength(3)
      for (const direction of directions) {
        expect(isDirectionCompatibleWithPort(side, direction)).toBe(true)
      }
    }
  })

  it('selects the compatible ray closest to the child geometry', () => {
    expect(closestDirectionForPort('top', -300, -200)).toBe('up-left')
    expect(closestDirectionForPort('top', 0, -200)).toBe('up')
    expect(closestDirectionForPort('top', 300, -200)).toBe('up-right')
    expect(closestDirectionForPort('right', 200, -300)).toBe('up-right')
    expect(closestDirectionForPort('bottom', -300, 200)).toBe('down-left')
    expect(closestDirectionForPort('left', -200, 300)).toBe('down-left')
  })

  it('uses the central ray when geometry is absent or angularly ambiguous', () => {
    expect(closestDirectionForPort('top', 0, 0)).toBe('up')
    expect(closestDirectionForPort('right', 0, 0)).toBe('right')
    // 22.5 degrees is exactly between the central and upper diagonal rays.
    expect(closestDirectionForPort('right', 1, -(Math.SQRT2 - 1))).toBe('right')
  })
})
