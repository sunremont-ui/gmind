// Стрелки связей: направление читается по картинке, поэтому проверяем именно
// маркеры. Двунаправленная связь раньше рисовала обе стрелки в одну сторону
// (маркер начала имел orient="auto" вместо auto-start-reverse), а связь со
// своим цветом получала наконечник цвета типа.
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Relationship } from '../../types'
import { RelationshipLine, RelationshipMarkers } from './RelationshipLine'
import { useRelationshipsStore } from '../../store/relationships'

function rel(o: Partial<Relationship> = {}): Relationship {
  return {
    id: 'r1',
    end1_id: 'a',
    end2_id: 'b',
    type: 'depends_on',
    direction: 'forward',
    ...o,
  } as Relationship
}

/** Видимая линия связи: первый path в группе — прозрачная зона попадания. */
function drawLine(relationship: Relationship): SVGPathElement {
  const { container } = render(
    <svg>
      <RelationshipMarkers />
      <RelationshipLine relationship={relationship} fromX={0} fromY={0} toX={200} toY={100} />
    </svg>,
  )
  return container.querySelectorAll<SVGPathElement>('g[data-relationship-id] path')[1]
}

beforeEach(() => {
  const store = useRelationshipsStore.getState()
  store.selectRel(null)
})

describe('стрелки связи', () => {
  it('односторонняя связь: стрелка только на конце', () => {
    const path = drawLine(rel({ direction: 'forward' }))
    expect(path.getAttribute('marker-end')).toBe('url(#rel-arrow-depends_on)')
    expect(path.getAttribute('marker-start')).toBeNull()
  })

  it('ненаправленная связь: стрелок нет вовсе', () => {
    const path = drawLine(rel({ direction: 'undirected' }))
    expect(path.getAttribute('marker-end')).toBeNull()
    expect(path.getAttribute('marker-start')).toBeNull()
  })

  it('двунаправленная связь: стрелки на обоих концах', () => {
    const path = drawLine(rel({ direction: 'bidirectional' }))
    expect(path.getAttribute('marker-start')).toBe('url(#rel-arrow-depends_on)')
    expect(path.getAttribute('marker-end')).toBe('url(#rel-arrow-depends_on)')
  })

  it('маркер разворачивается в начале линии', () => {
    const { container } = render(<svg><RelationshipMarkers /></svg>)
    const marker = container.querySelector('#rel-arrow-depends_on')!
    // Без auto-start-reverse стрелка начала смотрит туда же, куда стрелка конца.
    expect(marker.getAttribute('orient')).toBe('auto-start-reverse')
  })

  it('наконечник берёт цвет самой линии', () => {
    const { container } = render(<svg><RelationshipMarkers /></svg>)
    const head = container.querySelector('#rel-arrow-depends_on path')!
    expect(head.getAttribute('fill')).toBe('context-stroke')
  })

  it('свой цвет связи применяется к линии', () => {
    const path = drawLine(rel({ color: '#FF0000' }))
    expect(path.getAttribute('stroke')).toBe('#FF0000')
  })
})

describe('петля на себя', () => {
  it('рисуется дугой, а не нулевой линией', () => {
    const { container } = render(
      <svg>
        <RelationshipLine
          relationship={rel({ end1_id: 'a', end2_id: 'a' })}
          fromX={10} fromY={10} toX={10} toY={10}
          nodeWidth={120} nodeHeight={40}
        />
      </svg>,
    )
    const path = container.querySelector('path')!
    const d = path.getAttribute('d')!
    expect(d).toContain('C')
    // Дуга должна выходить за правый край узла, иначе её не видно под ним.
    const xs = [...d.matchAll(/-?\d+(\.\d+)?/g)].map(m => Number(m[0]))
    expect(Math.max(...xs)).toBeGreaterThan(10 + 120)
  })
})

describe('фильтр типов связей', () => {
  it('скрытый тип не рисуется', () => {
    useRelationshipsStore.setState({ visibleTypes: new Set(['relates_to']) })
    const { container } = render(
      <svg><RelationshipLine relationship={rel({ type: 'depends_on' })} fromX={0} fromY={0} toX={10} toY={10} /></svg>,
    )
    expect(container.querySelector('path')).toBeNull()
    useRelationshipsStore.setState({ visibleTypes: new Set(['relates_to', 'depends_on']) })
  })
})
