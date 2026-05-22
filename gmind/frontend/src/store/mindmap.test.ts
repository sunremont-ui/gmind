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
