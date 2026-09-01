import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isLocalDocLink, OPEN_WORKBOOK_EVENT, openTopicLink } from './openTopicLink'
import { projectsApi } from '../api/projects'
import { useMindMapStore } from '../store/mindmap'

const workbook = {
  id: 'wb-doc',
  title: 'plan',
  sheets: [{ id: 's', title: 'plan', root_topic: { id: 'r', title: 'plan', folded: false, children: [] } }],
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('isLocalDocLink', () => {
  it.each([
    ['D:\\проект\\docs\\plan.md', true],
    ['/home/user/notes/idea.markdown', true],
    ['docs/map.xmind', true],
    ['https://example.com/plan.md', false],
    ['http://localhost:1010/x.xmind', false],
    ['mailto:me@example.com', false],
    ['D:\\проект\\src\\main.go', false],
    ['', false],
  ])('%s → %s', (link, expected) => {
    expect(isLocalDocLink(link)).toBe(expected)
  })

  it('пустую ссылку не считает документом', () => {
    expect(isLocalDocLink(undefined)).toBe(false)
    expect(isLocalDocLink(null)).toBe(false)
  })
})

describe('openTopicLink', () => {
  it('документ проекта открывается картой и попадает на холст', async () => {
    const open = vi.spyOn(projectsApi, 'openDoc').mockResolvedValue(workbook as never)
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null)

    const result = await openTopicLink('D:\\проект\\docs\\plan.md')

    expect(open).toHaveBeenCalledWith('D:\\проект\\docs\\plan.md', true)
    expect(windowOpen).not.toHaveBeenCalled()
    expect(result).toEqual({ kind: 'workbook', workbook })
    expect(useMindMapStore.getState().workbook?.id).toBe('wb-doc')
  })

  it('передаёт документ оболочке, когда она управляет общей историей', async () => {
    vi.spyOn(projectsApi, 'openDoc').mockResolvedValue(workbook as never)
    const setWorkbook = vi.spyOn(useMindMapStore.getState(), 'setWorkbook')
    const handler = vi.fn((event: Event) => event.preventDefault())
    window.addEventListener(OPEN_WORKBOOK_EVENT, handler)

    await openTopicLink('D:\\проект\\docs\\plan.md')

    expect(handler).toHaveBeenCalledOnce()
    expect(setWorkbook).not.toHaveBeenCalled()
    window.removeEventListener(OPEN_WORKBOOK_EVENT, handler)
  })

  it('внешний адрес открывается ссылкой, а не запросом к бэкенду', async () => {
    const open = vi.spyOn(projectsApi, 'openDoc').mockResolvedValue(workbook as never)
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null)

    const result = await openTopicLink('https://example.com/doc')

    expect(result).toEqual({ kind: 'external' })
    expect(open).not.toHaveBeenCalled()
    expect(windowOpen).toHaveBeenCalledWith('https://example.com/doc', '_blank', 'noopener,noreferrer')
  })
})
