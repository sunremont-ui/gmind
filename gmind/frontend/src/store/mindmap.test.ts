import { describe, it, expect, beforeEach } from 'vitest'
import { useMindMapStore } from './mindmap'
import type { Workbook, Topic } from '../types'

const makeTopic = (id: string, children: Topic[] = []): Topic => ({
  id,
  title: id,
  folded: false,
  children,
  labels: [],
  markers: [],
})

const makeWorkbook = (rootChildren: Topic[] = []): Workbook => ({
  id: 'wb1',
  title: 'Test',
  private: false,
  owner_id: '',
  created_at: '',
  updated_at: '',
  sheets: [{
    id: 'sheet1',
    title: 'Sheet 1',
    root_topic: makeTopic('root', rootChildren),
    floating_topics: [],
    relationships: [],
  }],
})

beforeEach(() => {
  useMindMapStore.setState({
    workbook: null,
    activeSheetId: null,
    selectedTopicId: null,
    selectedTopicIds: [],
    loading: false,
    error: null,
  })
})

describe('addTopic', () => {
  it('adds a child to the parent topic', () => {
    useMindMapStore.getState().setWorkbook(makeWorkbook())
    const child = makeTopic('child1')
    useMindMapStore.getState().addTopic('root', child)

    const sheet = useMindMapStore.getState().workbook!.sheets[0]
    expect(sheet.root_topic.children!).toHaveLength(1)
    expect(sheet.root_topic.children![0].id).toBe('child1')
  })

  it('appends to existing children', () => {
    useMindMapStore.getState().setWorkbook(makeWorkbook([makeTopic('existing')]))
    useMindMapStore.getState().addTopic('root', makeTopic('new'))

    const children = useMindMapStore.getState().workbook!.sheets[0].root_topic.children!
    expect(children).toHaveLength(2)
    expect(children.map(c => c.id)).toEqual(['existing', 'new'])
  })

  it('does NOT add duplicate — skips if topic ID already exists (regression)', () => {
    useMindMapStore.getState().setWorkbook(makeWorkbook([makeTopic('child1')]))

    // Simulate receiving the same topic_created operation twice (ghost WS session bug)
    useMindMapStore.getState().addTopic('root', makeTopic('child1'))

    const children = useMindMapStore.getState().workbook!.sheets[0].root_topic.children
    expect(children).toHaveLength(1)
  })

  it('adds to deeply nested parent', () => {
    const grandchild = makeTopic('gc')
    const child = makeTopic('child', [grandchild])
    useMindMapStore.getState().setWorkbook(makeWorkbook([child]))

    useMindMapStore.getState().addTopic('gc', makeTopic('ggc'))

    const store = useMindMapStore.getState()
    const topic = store.getTopic('ggc')
    expect(topic).not.toBeNull()
    expect(topic!.id).toBe('ggc')
  })

  it('does nothing when workbook is null', () => {
    useMindMapStore.getState().addTopic('root', makeTopic('x'))
    expect(useMindMapStore.getState().workbook).toBeNull()
  })
})

describe('removeTopic', () => {
  it('removes a direct child', () => {
    useMindMapStore.getState().setWorkbook(makeWorkbook([makeTopic('c1'), makeTopic('c2')]))
    useMindMapStore.getState().removeTopic('c1')

    const children = useMindMapStore.getState().workbook!.sheets[0].root_topic.children!
    expect(children).toHaveLength(1)
    expect(children[0].id).toBe('c2')
  })

  it('removes a deeply nested topic', () => {
    const gc = makeTopic('gc')
    const child = makeTopic('child', [gc])
    useMindMapStore.getState().setWorkbook(makeWorkbook([child]))
    useMindMapStore.getState().removeTopic('gc')

    const store = useMindMapStore.getState()
    expect(store.getTopic('gc')).toBeNull()
    expect(store.getTopic('child')).not.toBeNull()
  })

  it('is a no-op for non-existent id', () => {
    useMindMapStore.getState().setWorkbook(makeWorkbook([makeTopic('c1')]))
    useMindMapStore.getState().removeTopic('ghost')

    const children = useMindMapStore.getState().workbook!.sheets[0].root_topic.children
    expect(children).toHaveLength(1)
  })
})

describe('updateTopicInTree', () => {
  it('updates title of a direct child', () => {
    useMindMapStore.getState().setWorkbook(makeWorkbook([makeTopic('c1')]))
    useMindMapStore.getState().updateTopicInTree('c1', { title: 'Updated' })

    const topic = useMindMapStore.getState().getTopic('c1')
    expect(topic!.title).toBe('Updated')
  })

  it('updates deeply nested topic', () => {
    const gc = makeTopic('gc')
    const child = makeTopic('child', [gc])
    useMindMapStore.getState().setWorkbook(makeWorkbook([child]))
    useMindMapStore.getState().updateTopicInTree('gc', { title: 'Deep Update' })

    const topic = useMindMapStore.getState().getTopic('gc')
    expect(topic!.title).toBe('Deep Update')
  })
})

describe('addTopicAt', () => {
  it('inserts at the given index', () => {
    useMindMapStore.getState().setWorkbook(makeWorkbook([makeTopic('a'), makeTopic('b')]))
    useMindMapStore.getState().addTopicAt('root', makeTopic('mid'), 1)
    const ids = useMindMapStore.getState().workbook!.sheets[0].root_topic.children!.map(c => c.id)
    expect(ids).toEqual(['a', 'mid', 'b'])
  })

  it('appends when index omitted or out of range', () => {
    useMindMapStore.getState().setWorkbook(makeWorkbook([makeTopic('a')]))
    useMindMapStore.getState().addTopicAt('root', makeTopic('end'), 99)
    const ids = useMindMapStore.getState().workbook!.sheets[0].root_topic.children!.map(c => c.id)
    expect(ids).toEqual(['a', 'end'])
  })

  it('does not insert a duplicate id', () => {
    useMindMapStore.getState().setWorkbook(makeWorkbook([makeTopic('dup')]))
    useMindMapStore.getState().addTopicAt('root', makeTopic('dup'), 0)
    expect(useMindMapStore.getState().workbook!.sheets[0].root_topic.children!).toHaveLength(1)
  })
})

describe('isDescendant', () => {
  it('detects nested descendants', () => {
    const gc = makeTopic('gc')
    const child = makeTopic('child', [gc])
    useMindMapStore.getState().setWorkbook(makeWorkbook([child]))
    const s = useMindMapStore.getState()
    expect(s.isDescendant('child', 'gc')).toBe(true)
    expect(s.isDescendant('root', 'gc')).toBe(true)
    expect(s.isDescendant('gc', 'child')).toBe(false)
    expect(s.isDescendant('child', 'nope')).toBe(false)
  })
})

describe('moveTopicInTree', () => {
  it('reparents a topic under a new parent', () => {
    useMindMapStore.getState().setWorkbook(makeWorkbook([makeTopic('a'), makeTopic('b')]))
    useMindMapStore.getState().moveTopicInTree('b', 'a', 0)
    const root = useMindMapStore.getState().workbook!.sheets[0].root_topic
    expect(root.children!.map(c => c.id)).toEqual(['a'])
    expect(useMindMapStore.getState().getTopic('a')!.children!.map(c => c.id)).toEqual(['b'])
  })

  it('blocks moving a node into its own descendant (no-op)', () => {
    const gc = makeTopic('gc')
    const child = makeTopic('child', [gc])
    useMindMapStore.getState().setWorkbook(makeWorkbook([child]))
    useMindMapStore.getState().moveTopicInTree('child', 'gc', 0)
    // unchanged: child still under root, gc still under child
    const root = useMindMapStore.getState().workbook!.sheets[0].root_topic
    expect(root.children!.map(c => c.id)).toEqual(['child'])
    expect(useMindMapStore.getState().getTopic('child')!.children!.map(c => c.id)).toEqual(['gc'])
  })

  it('reparents a floating topic preserving its id', () => {
    const wb = makeWorkbook([makeTopic('parent')])
    wb.sheets[0].floating_topics = [makeTopic('floater')]
    useMindMapStore.getState().setWorkbook(wb)
    useMindMapStore.getState().moveTopicInTree('floater', 'parent', 0)
    const sheet = useMindMapStore.getState().workbook!.sheets[0]
    expect(sheet.floating_topics).toHaveLength(0)
    expect(useMindMapStore.getState().getTopic('parent')!.children!.map(c => c.id)).toEqual(['floater'])
  })

  it('is a no-op when the new parent is not in the tree', () => {
    useMindMapStore.getState().setWorkbook(makeWorkbook([makeTopic('a')]))
    useMindMapStore.getState().moveTopicInTree('a', 'ghost', 0)
    // 'a' must not be dropped
    expect(useMindMapStore.getState().getTopic('a')).not.toBeNull()
  })
})

describe('swapTopics', () => {
  it('swaps two siblings', () => {
    useMindMapStore.getState().setWorkbook(makeWorkbook([makeTopic('a'), makeTopic('b'), makeTopic('c')]))
    useMindMapStore.getState().swapTopics('a', 'c')
    const ids = useMindMapStore.getState().workbook!.sheets[0].root_topic.children!.map(t => t.id)
    expect(ids).toEqual(['c', 'b', 'a'])
  })

  it('swaps across different parents, subtrees intact', () => {
    const a = makeTopic('a', [makeTopic('a1')])
    const b = makeTopic('b', [makeTopic('b1')])
    const p = makeTopic('p', [b])
    useMindMapStore.getState().setWorkbook(makeWorkbook([a, p]))
    useMindMapStore.getState().swapTopics('a', 'b')
    const store = useMindMapStore.getState()
    // a now under p, b now under root; children travel with them
    expect(store.workbook!.sheets[0].root_topic.children!.map(t => t.id)).toEqual(['b', 'p'])
    expect(store.getTopic('p')!.children!.map(t => t.id)).toEqual(['a'])
    expect(store.getTopic('a')!.children!.map(t => t.id)).toEqual(['a1'])
    expect(store.getTopic('b')!.children!.map(t => t.id)).toEqual(['b1'])
  })
})

describe('detachToFloating', () => {
  it('moves a tree node (with subtree) into floating_topics at a position', () => {
    const child = makeTopic('child', [makeTopic('gc')])
    useMindMapStore.getState().setWorkbook(makeWorkbook([makeTopic('a'), child]))
    useMindMapStore.setState({ activeSheetId: 'sheet1' })
    useMindMapStore.getState().detachToFloating('child', { x: 500, y: 300 })

    const sheet = useMindMapStore.getState().workbook!.sheets[0]
    expect(sheet.root_topic.children!.map(t => t.id)).toEqual(['a'])
    expect(sheet.floating_topics!.map(t => t.id)).toEqual(['child'])
    const floated = sheet.floating_topics![0]
    expect(floated.position).toEqual({ x: 500, y: 300 })
    expect(floated.children!.map(t => t.id)).toEqual(['gc'])
  })
})

describe('floating parents', () => {
  const withFloating = () => {
    const wb = makeWorkbook([makeTopic('a')])
    wb.sheets[0].floating_topics = [makeTopic('float', [makeTopic('fchild')])]
    useMindMapStore.getState().setWorkbook(wb)
    useMindMapStore.setState({ activeSheetId: 'sheet1' })
  }

  it('addTopic adds a child under a floating topic', () => {
    withFloating()
    useMindMapStore.getState().addTopic('float', makeTopic('newkid'))
    const float = useMindMapStore.getState().getTopic('float')
    expect(float!.children!.map(c => c.id)).toEqual(['fchild', 'newkid'])
  })

  it('getTopic finds a node nested inside a floating subtree', () => {
    withFloating()
    const t = useMindMapStore.getState().getTopic('fchild')
    expect(t).not.toBeNull()
    expect(t!.id).toBe('fchild')
  })

  it('removeTopic prunes a nested floating child but keeps the floating root', () => {
    withFloating()
    useMindMapStore.getState().removeTopic('fchild')
    const sheet = useMindMapStore.getState().workbook!.sheets[0]
    expect(sheet.floating_topics!.map(f => f.id)).toEqual(['float'])
    expect(useMindMapStore.getState().getTopic('fchild')).toBeNull()
    expect(useMindMapStore.getState().getTopic('float')).not.toBeNull()
  })

  it('updateTopicInTree reaches a nested floating child', () => {
    withFloating()
    useMindMapStore.getState().updateTopicInTree('fchild', { title: 'Renamed' })
    expect(useMindMapStore.getState().getTopic('fchild')!.title).toBe('Renamed')
  })
})

describe('getTopic', () => {
  it('finds root topic', () => {
    useMindMapStore.getState().setWorkbook(makeWorkbook())
    const t = useMindMapStore.getState().getTopic('root')
    expect(t).not.toBeNull()
    expect(t!.id).toBe('root')
  })

  it('returns null for unknown id', () => {
    useMindMapStore.getState().setWorkbook(makeWorkbook())
    expect(useMindMapStore.getState().getTopic('nope')).toBeNull()
  })
})
