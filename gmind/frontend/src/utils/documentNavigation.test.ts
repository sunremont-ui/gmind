import { describe, expect, it } from 'vitest'
import type { Workbook } from '../types'
import {
  EMPTY_DOCUMENT_NAVIGATION,
  captureCurrentNavigationEntry,
  createNavigationEntry,
  isPathInsideRoot,
  projectRootFromWorkbook,
  pushDocumentNavigation,
  relativeDocumentSegments,
  resetDocumentNavigation,
  resolveProjectRoot,
} from './documentNavigation'

function workbook(id: string, sourcePath: string, rootTitle = id): Workbook {
  return {
    id,
    title: id,
    source_path: sourcePath,
    private: false,
    owner_id: 'test',
    created_at: '',
    updated_at: '',
    sheets: [{
      id: `${id}-sheet`,
      title: id,
      root_topic: { id: `${id}-root`, title: rootTitle, folded: false, children: [] },
    }],
  }
}

describe('document navigation', () => {
  it('сохраняет корень проекта при переходе в документ внутри него', () => {
    const rootWorkbook = workbook('wiki-map', 'D:\\wiki', 'Wiki')
    const documentWorkbook = workbook('doc', 'D:\\wiki\\concepts\\graph.md')
    const root = projectRootFromWorkbook(rootWorkbook)

    expect(root).not.toBeNull()
    expect(resolveProjectRoot(documentWorkbook, root)).toEqual(root)
    expect(isPathInsideRoot('d:/WIKI/concepts/graph.md', 'D:\\wiki')).toBe(true)
  })

  it('обрезает forward-ветку после нового перехода', () => {
    const a = createNavigationEntry(workbook('a', 'D:\\a'))
    const b = createNavigationEntry(workbook('b', 'D:\\a\\b.md'))
    const c = createNavigationEntry(workbook('c', 'D:\\a\\c.md'))
    let navigation = resetDocumentNavigation(a)
    navigation = pushDocumentNavigation(navigation, b)
    navigation = { ...navigation, index: 0 }
    navigation = pushDocumentNavigation(navigation, c)

    expect(navigation.entries.map(entry => entry.workbook.id)).toEqual(['a', 'c'])
    expect(navigation.index).toBe(1)
  })

  it('сохраняет выбранный узел перед уходом назад', () => {
    const a = workbook('a', 'D:\\a')
    const initial = pushDocumentNavigation(EMPTY_DOCUMENT_NAVIGATION, createNavigationEntry(a))
    const captured = captureCurrentNavigationEntry(initial, a, 'a-sheet', 'topic-42')

    expect(captured.entries[0].selectedTopicId).toBe('topic-42')
  })

  it('строит breadcrumb относительно корня', () => {
    const root = projectRootFromWorkbook(workbook('wiki-map', 'D:\\wiki'))
    expect(relativeDocumentSegments('D:\\wiki\\concepts\\graph\\shortest-path.md', root))
      .toEqual(['concepts', 'graph', 'shortest-path.md'])
  })
})
