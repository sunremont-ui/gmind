import { api } from '../api/client'
import { isNotFound } from '../api/errors'
import { offlineStorage, offlineSettings } from './offline'
import type { Workbook } from '../types'

const INBOX_WB_KEY = 'inbox_workbook_id'

function findInbox(workbooks: Workbook[], excludedId?: string): Workbook | undefined {
  return workbooks
    .filter(wb => wb.id !== excludedId && wb.title.trim().toLocaleLowerCase() === 'inbox')
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0]
}

async function rememberInbox(workbook: Workbook): Promise<string> {
  await offlineSettings.set(INBOX_WB_KEY, workbook.id)
  await offlineStorage.saveWorkbook(workbook)
  return workbook.id
}

export async function ensureInboxWorkbook(): Promise<string> {
  const existing = await offlineSettings.get<string>(INBOX_WB_KEY)
  let deletedInboxId: string | undefined
  if (existing) {
    try {
      return await rememberInbox(await api.getWorkbook(existing))
    } catch (err) {
      // A confirmed 404 must not resurrect a deleted cached workbook. For a
      // transient backend outage, however, keep using the cached Inbox rather
      // than creating a new local duplicate.
      if (isNotFound(err)) {
        deletedInboxId = existing
      } else {
        const cached = await offlineStorage.getWorkbook(existing)
        if (cached) return existing
      }
    }
  }

  try {
    const reusable = findInbox(await api.listWorkbooks(), deletedInboxId)
    if (reusable) return await rememberInbox(reusable)

    const wb = await api.createWorkbook('Inbox')
    return await rememberInbox(wb)
  } catch {
    const cached = findInbox(await offlineStorage.listWorkbooks(), deletedInboxId)
    if (cached) {
      await offlineSettings.set(INBOX_WB_KEY, cached.id)
      return cached.id
    }

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
