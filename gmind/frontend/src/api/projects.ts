// Схема проекта: каталог на диске → карта. Предпросмотр (scan) ничего не
// сохраняет и нужен, чтобы увидеть размер будущей карты до импорта.
import type { Topic, Workbook } from '../types'
import { API_BASE } from './base'

export interface ProjectScanOptions {
  /** Сколько уровней каталогов разворачивать. */
  max_depth?: number
  /** Потолок числа узлов: большая карта не должна вешать отрисовку. */
  max_nodes?: number
  /** Только .md и .xmind (папки без документов отбрасываются). */
  docs_only?: boolean
  /** Дополнительные имена каталогов к списку игнорируемых. */
  ignore?: string[]
  /** Включать имена, начинающиеся с точки. */
  include_hidden?: boolean
}

export interface ProjectStats {
  dirs: number
  files: number
  markdown: number
  xmind: number
  nodes: number
  truncated: boolean
}

export interface ProjectScanResult {
  path: string
  title: string
  stats: ProjectStats
  root: Topic
}

export interface ProjectImportResult {
  workbook: Workbook
  stats: ProjectStats
}

export interface ProjectDirEntry {
  name: string
  path: string
  dir: boolean
}

export interface ProjectDirListing {
  path: string
  parent: string
  dirs: ProjectDirEntry[]
}

export interface ProjectFileMutationResult {
  path: string
  workbook: Workbook
  deleted_workbook_ids?: string[]
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(API_BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!resp.ok) {
    const detail = await resp.text().catch(() => resp.statusText)
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${resp.status}: ${detail}`)
  }
  if (resp.status === 204) return undefined as T
  return resp.json() as Promise<T>
}

export const projectsApi = {
  /** Считает схему каталога, ничего не сохраняя. */
  scan: (path: string, options: ProjectScanOptions = {}): Promise<ProjectScanResult> =>
    req('/projects/scan', { method: 'POST', body: JSON.stringify({ path, ...options }) }),

  /** Строит карту и сохраняет её книгой — проект сразу можно открыть. */
  import: (path: string, title?: string, options: ProjectScanOptions = {}): Promise<ProjectImportResult> =>
    req('/projects/import', { method: 'POST', body: JSON.stringify({ path, title, ...options }) }),

  /** Открывает документ схемы (.md или .xmind) как карту. */
  openDoc: (path: string, reuse = true): Promise<Workbook> =>
    req('/projects/open-doc', { method: 'POST', body: JSON.stringify({ path, reuse }) }),

  /** Создаёт Markdown-файл внутри открытого корня и пересобирает карту проекта. */
  createFile: (root: string, workbookId: string, directory: string, name: string): Promise<ProjectFileMutationResult> =>
    req('/projects/files', {
      method: 'POST',
      body: JSON.stringify({ root, workbook_id: workbookId, directory, name }),
    }),

  /** Удаляет документ внутри открытого корня и пересобирает карту проекта. */
  deleteFile: (root: string, workbookId: string, path: string): Promise<ProjectFileMutationResult> =>
    req('/projects/files', {
      method: 'DELETE',
      body: JSON.stringify({ root, workbook_id: workbookId, path }),
    }),

  /** Подкаталоги — чтобы выбрать проект кликами, а не вводить путь руками. */
  dirs: (path?: string): Promise<ProjectDirListing> =>
    req(`/projects/dirs${path ? `?path=${encodeURIComponent(path)}` : ''}`),
}

const RECENT_KEY = 'gmind_recent_projects'
const RECENT_LIMIT = 8

/** Недавние проекты живут локально: список путей — не данные карты. */
export function recentProjects(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter(p => typeof p === 'string') : []
  } catch {
    return []
  }
}

export function rememberProject(path: string): string[] {
  const next = [path, ...recentProjects().filter(p => p !== path)].slice(0, RECENT_LIMIT)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* приватный режим — список просто не переживёт перезагрузку */
  }
  return next
}

export function forgetProject(path: string): string[] {
  const next = recentProjects().filter(p => p !== path)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* см. rememberProject */
  }
  return next
}
