// Markdown-файлы как рабочий формат: обзор хранилища, открытие .md как карты,
// сохранение карты обратно в связанный файл.
import type { Workbook } from '../types'
import { API_BASE } from './base'

export interface MarkdownFileInfo {
  name: string
  path: string
  size: number
  modified: string
  dir: boolean
}

export interface MarkdownListing {
  dir: string
  root: string
  files: MarkdownFileInfo[]
}

export interface MarkdownSaveResult {
  path: string
  bytes: number
  synced_at: string
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

export const markdownApi = {
  /** Содержимое каталога Markdown-хранилища (по умолчанию — корень vault). */
  listFiles: (dir?: string): Promise<MarkdownListing> =>
    req(`/md/files${dir ? `?dir=${encodeURIComponent(dir)}` : ''}`),

  /** Открывает .md с диска как карту, связывая её с файлом. */
  openFile: (path: string, reuse = true): Promise<Workbook> =>
    req('/md/open', { method: 'POST', body: JSON.stringify({ path, reuse }) }),

  /** Создаёт карту из текста Markdown (без файла на диске или с привязкой к нему). */
  importContent: (content: string, title?: string, path?: string): Promise<Workbook> =>
    req('/workbooks/import/markdown', { method: 'POST', body: JSON.stringify({ content, title, path }) }),

  /** Пишет карту в связанный файл; path задаёт «Сохранить как». */
  save: (workbookId: string, path?: string, sheetId?: string): Promise<MarkdownSaveResult> =>
    req(`/workbooks/${workbookId}/md/save`, {
      method: 'POST',
      body: JSON.stringify({ path, sheet_id: sheetId }),
    }),

  /** Перечитывает связанный файл с диска (правки из другого редактора). */
  reload: (workbookId: string): Promise<Workbook> =>
    req(`/workbooks/${workbookId}/md/reload`, { method: 'POST' }),
}
