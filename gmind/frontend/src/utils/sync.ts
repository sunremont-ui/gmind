import { offlineQueue, offlineSettings } from './offline'
import type { Workbook } from '../types'

interface SessionState {
  lastWorkbookId: string | null
  lastSheetId: string | null
  lastZoom: number
  lastPanX: number
  lastPanY: number
  lastTheme: string
}

export async function saveSession(state: SessionState): Promise<void> {
  await offlineSettings.set('session', state)
}

export async function loadSession(): Promise<SessionState | null> {
  return (await offlineSettings.get<SessionState>('session')) ?? null
}

export async function clearSession(): Promise<void> {
  await offlineSettings.set('session', null)
}

export async function syncPendingOps(): Promise<{ synced: number; failed: number }> {
  const ops = await offlineQueue.getAll()
  let synced = 0
  let failed = 0

  for (const op of ops) {
    try {
      const url = `/api/v1${op.endpoint}`
      const options: RequestInit = {
        method: op.type === 'delete' ? 'DELETE' : op.type === 'move' ? 'POST' : op.type === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
      }
      if (op.body && op.type !== 'delete') {
        options.body = JSON.stringify(op.body)
      }
      const res = await fetch(url, options)
      if (!res.ok) {
        failed++
        continue
      }
      await offlineQueue.remove(op.id)
      synced++
    } catch {
      failed++
    }
  }

  return { synced, failed }
}
