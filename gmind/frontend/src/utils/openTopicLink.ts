// Ссылка узла ведёт либо наружу (адрес в сети), либо внутрь — в документ на
// диске. Второй случай появился вместе со схемой проекта: узлы .md и .xmind
// подписаны путём к файлу, и window.open по такому пути в браузере просто
// ничего не делает, а в десктопной оболочке блокируется. Такие ссылки
// открываем картой через бэкенд.
import { projectsApi } from '../api/projects'
import type { Workbook } from '../types'

const DOC_EXTENSIONS = ['.md', '.markdown', '.xmind']
export const OPEN_WORKBOOK_EVENT = 'gmind:open-workbook'

export interface OpenWorkbookEventDetail {
  workbook: Workbook
  source: 'topic-link' | 'project-import' | 'markdown'
  path: string
}

export function requestWorkbookOpen(
  workbook: Workbook,
  source: OpenWorkbookEventDetail['source'],
  path = workbook.source_path ?? '',
): boolean {
  const event = new CustomEvent<OpenWorkbookEventDetail>(OPEN_WORKBOOK_EVENT, {
    detail: { workbook, source, path },
    cancelable: true,
  })
  return !window.dispatchEvent(event)
}

/** Есть ли у ссылки схема (http:, https:, mailto:, file: …). */
function hasScheme(link: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(link) || /^(mailto|tel|data):/i.test(link)
}

/** Путь к документу на диске, который Gmind умеет открыть как карту. */
export function isLocalDocLink(link: string | undefined | null): boolean {
  if (!link) return false
  const value = link.trim()
  if (!value || hasScheme(value)) return false
  const lower = value.toLowerCase()
  return DOC_EXTENSIONS.some(ext => lower.endsWith(ext))
}

export type OpenLinkResult =
  | { kind: 'workbook'; workbook: Workbook }
  | { kind: 'external' }

/**
 * Открывает ссылку узла: документ проекта — картой, всё остальное — как
 * обычную ссылку. Повторное открытие того же файла переиспользует его карту,
 * чтобы клики по схеме не плодили копии.
 */
export async function openTopicLink(link: string): Promise<OpenLinkResult> {
  const value = link.trim()
  if (!isLocalDocLink(value)) {
    window.open(value, '_blank', 'noopener,noreferrer')
    return { kind: 'external' }
  }
  const workbook = await projectsApi.openDoc(value, true)
  // Shell владеет общей историей документов. Событие синхронное: если App
  // перехватил его и вызвал preventDefault(), он сам активирует workbook и
  // сохранит корневой контекст. Fallback нужен для изолированного MindMap
  // (storybook/тест/встраивание без App).
  const handled = requestWorkbookOpen(workbook, 'topic-link', value)
  if (!handled) {
    const { useMindMapStore } = await import('../store/mindmap')
    useMindMapStore.getState().setWorkbook(workbook)
  }
  return { kind: 'workbook', workbook }
}
