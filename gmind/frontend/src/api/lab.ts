// Клиент слоя лабы: реестр проектов, состояние трека, отчёты замеров.
// Всё идёт через бэкенд Gmind (/api/v1/lab/*), а не напрямую в MASys: адрес
// MASys ищет монитор бэкенда, и второй поисковик в браузере разошёлся бы с ним.
import { API_ORIGIN } from './base'
import type { Workbook } from '../types'
import type {
  LabProject, LabTrackState, LabEntry, LabRunSummary, LabRunReport, LabMemoryLayer,
  LabRunProcess, LabHistoryEntry,
} from '../types/lab'

const BASE = `${API_ORIGIN}/api/v1/lab`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(BASE + path, init)
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText)
    throw new Error(text || `${resp.status}`)
  }
  return resp.json() as Promise<T>
}

export const labApi = {
  projects: () => request<{ projects: LabProject[] }>('/projects').then(r => r.projects),

  addProject: (path: string, label?: string) =>
    request<{ projects: LabProject[] }>('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, label }),
    }).then(r => r.projects),

  removeProject: (path: string) =>
    request<{ projects: LabProject[] }>(`/projects?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    }).then(r => r.projects),

  /** Состояние трека; `withEntries` докладывает все записи одним ответом. */
  track: (track: string, namespace: string, withEntries = false) =>
    request<{ state: LabTrackState; entries?: LabEntry[] }>(
      `/track?track=${encodeURIComponent(track)}&namespace=${encodeURIComponent(namespace)}`
      + (withEntries ? '&entries=1' : '')
    ),

  runs: (path: string) =>
    request<{ runs: LabRunSummary[] }>(`/runs?path=${encodeURIComponent(path)}`).then(r => r.runs),

  /** Память MASys в namespace проекта — счётчиками по слоям. */
  memory: (namespace: string) =>
    request<{ namespace: string; layers: LabMemoryLayer[] }>(
      `/memory?namespace=${encodeURIComponent(namespace)}`
    ).then(r => r.layers),

  run: (path: string, lab: string) =>
    request<LabRunReport>(`/run?path=${encodeURIComponent(path)}&lab=${encodeURIComponent(lab)}`),

  /**
   * Запустить замер. Платные ячейки каркас пропускает сам: флага --paid у этого
   * пути нет, и кнопка потратить деньги не может.
   */
  startRun: (path: string, lab: string) =>
    request<LabRunProcess>('/runs/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, lab }),
    }),

  stopRun: (id: string) =>
    request<LabRunProcess>(`/runs/${encodeURIComponent(id)}/stop`, { method: 'POST' }),

  /** Архив прогонов замера: lab-out держит только последний. */
  history: (path: string, lab: string) =>
    request<{ history: LabHistoryEntry[] }>(
      `/history?path=${encodeURIComponent(path)}&lab=${encodeURIComponent(lab)}`
    ).then(r => r.history),

  historyReport: (path: string, lab: string, at: string) =>
    request<LabRunReport>(
      `/history/report?path=${encodeURIComponent(path)}&lab=${encodeURIComponent(lab)}`
      + `&at=${encodeURIComponent(at)}`
    ),

  /**
   * Выложить трек (или весь портфель, если путь не задан) на холст: узлы по
   * видам записей, supersedes — типизированными связями.
   */
  canvas: (path?: string, title?: string) =>
    request<{ workbook: Workbook; stats: Record<string, number> }>('/canvas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, title }),
    }),

  /** Адрес потока вывода — читается через EventSource. */
  streamUrl: (id: string) => `${BASE}/runs/${encodeURIComponent(id)}/stream`,
}
