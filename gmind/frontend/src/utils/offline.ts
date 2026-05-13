import { openDB, type IDBPDatabase } from 'idb'
import type { Workbook } from '../types'

const DB_NAME = 'gmind-offline'
const DB_VERSION = 1

interface OfflineOp {
  id: number
  type: 'create' | 'update' | 'delete' | 'move'
  endpoint: string
  body?: unknown
  timestamp: number
}

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('workbooks')) {
          db.createObjectStore('workbooks', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('pending_ops')) {
          const store = db.createObjectStore('pending_ops', {
            keyPath: 'id',
            autoIncrement: true,
          })
          store.createIndex('timestamp', 'timestamp')
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

export const offlineStorage = {
  async saveWorkbook(wb: Workbook): Promise<void> {
    const db = await getDB()
    await db.put('workbooks', { ...wb, _cached_at: Date.now() })
  },

  async getWorkbook(id: string): Promise<Workbook | undefined> {
    const db = await getDB()
    return db.get('workbooks', id)
  },

  async listWorkbooks(): Promise<Workbook[]> {
    const db = await getDB()
    return db.getAll('workbooks')
  },

  async deleteWorkbook(id: string): Promise<void> {
    const db = await getDB()
    await db.delete('workbooks', id)
  },

  async clearWorkbooks(): Promise<void> {
    const db = await getDB()
    await db.clear('workbooks')
  },
}

export const offlineQueue = {
  async add(op: Omit<OfflineOp, 'id' | 'timestamp'>): Promise<void> {
    const db = await getDB()
    await db.add('pending_ops', { ...op, timestamp: Date.now() })
  },

  async getAll(): Promise<OfflineOp[]> {
    const db = await getDB()
    return db.getAll('pending_ops')
  },

  async remove(id: number): Promise<void> {
    const db = await getDB()
    await db.delete('pending_ops', id)
  },

  async clear(): Promise<void> {
    const db = await getDB()
    await db.clear('pending_ops')
  },

  async count(): Promise<number> {
    const db = await getDB()
    return db.count('pending_ops')
  },
}

export const offlineSettings = {
  async get<T>(key: string, fallback?: T): Promise<T | undefined> {
    const db = await getDB()
    const entry = await db.get('settings', key)
    return entry?.value ?? fallback
  },

  async set<T>(key: string, value: T): Promise<void> {
    const db = await getDB()
    await db.put('settings', { key, value })
  },
}
