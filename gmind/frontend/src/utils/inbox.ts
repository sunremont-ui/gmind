import { api } from '../api/client'
import { offlineStorage, offlineSettings } from './offline'
import type { Workbook } from '../types'

const INBOX_WB_KEY = 'inbox_workbook_id'

export async function ensureInboxWorkbook(): Promise<string> {
  const existing = await offlineSettings.get<string>(INBOX_WB_KEY)
  if (existing) {
    try {
      await api.getWorkbook(existing)
      return existing
    } catch {
      // workbook was deleted, create new one
    }
  }

  try {
    const wb = await api.createWorkbook('Inbox')
    await offlineSettings.set(INBOX_WB_KEY, wb.id)
    await offlineStorage.saveWorkbook(wb)
    return wb.id
  } catch {
    // offline — create local placeholder
    const localId = 'inbox-local-' + Date.now()
    const localWb: Workbook = {
      id: localId,
      title: 'Inbox',
      sheets: [],
      private: false,
      owner_id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    await offlineSettings.set(INBOX_WB_KEY, localId)
    await offlineStorage.saveWorkbook(localWb)
    return localId
  }
}

export async function captureToInbox(text: string): Promise<void> {
  const inboxId = await ensureInboxWorkbook()
  try {
    const wb = await api.getWorkbook(inboxId)
    const sheet = wb.sheets[0]
    if (sheet) {
      await api.createTopic(inboxId, sheet.root_topic.id, text.trim())
    }
  } catch {
    // offline — queue via API (mutatingRequest handles it)
    throw new Error('offline')
  }
}
