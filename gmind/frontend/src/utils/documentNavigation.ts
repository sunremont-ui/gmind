import type { Topic, Workbook } from '../types'

const DOCUMENT_EXTENSIONS = ['.md', '.markdown', '.xmind']
const MAX_DOCUMENT_HISTORY = 50

export interface ProjectRootContext {
  workbookId: string
  title: string
  path: string
  root: Topic
}

export interface DocumentNavigationEntry {
  workbook: Workbook
  activeSheetId: string | null
  selectedTopicId: string | null
  projectRoot: ProjectRootContext | null
}

export interface DocumentNavigationState {
  entries: DocumentNavigationEntry[]
  index: number
}

export const EMPTY_DOCUMENT_NAVIGATION: DocumentNavigationState = {
  entries: [],
  index: -1,
}

export function isDocumentSourcePath(path: string | undefined | null): boolean {
  if (!path) return false
  const value = path.trim().toLowerCase()
  return DOCUMENT_EXTENSIONS.some(extension => value.endsWith(extension))
}

/** Сравнимый вид пути. Windows нечувствителен к регистру, slash унифицируем. */
export function normalizeFsPath(path: string | undefined | null): string {
  if (!path) return ''
  return path.trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

export function isPathInsideRoot(path: string | undefined | null, rootPath: string): boolean {
  const normalizedPath = normalizeFsPath(path)
  const normalizedRoot = normalizeFsPath(rootPath)
  return !!normalizedPath && !!normalizedRoot
    && (normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`))
}

/** Workbook схемы проекта отличается от документа source_path-каталогом. */
export function projectRootFromWorkbook(workbook: Workbook): ProjectRootContext | null {
  const sourcePath = workbook.source_path?.trim()
  const root = workbook.sheets[0]?.root_topic
  if (!sourcePath || !root || isDocumentSourcePath(sourcePath)) return null
  return {
    workbookId: workbook.id,
    title: workbook.title,
    path: sourcePath,
    root,
  }
}

export function resolveProjectRoot(
  workbook: Workbook,
  previousRoot: ProjectRootContext | null,
): ProjectRootContext | null {
  const ownRoot = projectRootFromWorkbook(workbook)
  if (ownRoot) return ownRoot
  if (previousRoot && isPathInsideRoot(workbook.source_path, previousRoot.path)) return previousRoot
  return null
}

export function createNavigationEntry(
  workbook: Workbook,
  activeSheetId: string | null = workbook.sheets[0]?.id ?? null,
  selectedTopicId: string | null = null,
  projectRoot: ProjectRootContext | null = null,
): DocumentNavigationEntry {
  return { workbook, activeSheetId, selectedTopicId, projectRoot }
}

export function captureCurrentNavigationEntry(
  navigation: DocumentNavigationState,
  workbook: Workbook | null,
  activeSheetId: string | null,
  selectedTopicId: string | null,
): DocumentNavigationState {
  if (!workbook || navigation.index < 0 || !navigation.entries[navigation.index]) return navigation
  const entries = [...navigation.entries]
  entries[navigation.index] = {
    ...entries[navigation.index],
    workbook,
    activeSheetId,
    selectedTopicId,
  }
  return { ...navigation, entries }
}

export function pushDocumentNavigation(
  navigation: DocumentNavigationState,
  entry: DocumentNavigationEntry,
): DocumentNavigationState {
  const current = navigation.entries[navigation.index]
  if (
    current
    && current.workbook.id === entry.workbook.id
    && current.activeSheetId === entry.activeSheetId
    && current.selectedTopicId === entry.selectedTopicId
  ) {
    const entries = [...navigation.entries]
    entries[navigation.index] = entry
    return { entries, index: navigation.index }
  }

  const entries = [...navigation.entries.slice(0, navigation.index + 1), entry]
  if (entries.length > MAX_DOCUMENT_HISTORY) entries.shift()
  return { entries, index: entries.length - 1 }
}

export function resetDocumentNavigation(entry: DocumentNavigationEntry): DocumentNavigationState {
  return { entries: [entry], index: 0 }
}

/** Сегменты после имени корня, пригодные для breadcrumb. */
export function relativeDocumentSegments(
  sourcePath: string | undefined | null,
  projectRoot: ProjectRootContext | null,
): string[] {
  if (!sourcePath) return []
  const displayPath = sourcePath.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (!projectRoot) {
    const parts = displayPath.split('/').filter(Boolean)
    return parts.length > 0 ? [parts.at(-1)!] : []
  }
  const rootDisplay = projectRoot.path.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (!isPathInsideRoot(displayPath, projectRoot.path)) return [displayPath.split('/').at(-1) ?? displayPath]
  return displayPath.slice(rootDisplay.length).replace(/^\/+/, '').split('/').filter(Boolean)
}
