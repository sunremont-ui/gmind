import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Workbook } from '../types'

const mocks = vi.hoisted(() => ({
  getWorkbook: vi.fn(),
  listWorkbooks: vi.fn(),
  createWorkbook: vi.fn(),
  createTopic: vi.fn(),
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  getCachedWorkbook: vi.fn(),
  listCachedWorkbooks: vi.fn(),
  saveWorkbook: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: {
    getWorkbook: mocks.getWorkbook,
    listWorkbooks: mocks.listWorkbooks,
    createWorkbook: mocks.createWorkbook,
    createTopic: mocks.createTopic,
  },
}))

vi.mock('./offline', () => ({
  offlineSettings: {
    get: mocks.getSetting,
    set: mocks.setSetting,
  },
  offlineStorage: {
    getWorkbook: mocks.getCachedWorkbook,
    listWorkbooks: mocks.listCachedWorkbooks,
    saveWorkbook: mocks.saveWorkbook,
  },
}))

import { ApiError } from '../api/errors'
import { ensureInboxWorkbook } from './inbox'

function workbook(id: string, title = 'Inbox', updatedAt = '2026-01-01T00:00:00Z'): Workbook {
  return {
    id,
    title,
    sheets: [],
    private: false,
    owner_id: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: updatedAt,
  }
}

describe('ensureInboxWorkbook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSetting.mockResolvedValue(undefined)
    mocks.listWorkbooks.mockResolvedValue([])
    mocks.listCachedWorkbooks.mockResolvedValue([])
    mocks.getCachedWorkbook.mockResolvedValue(undefined)
    mocks.setSetting.mockResolvedValue(undefined)
    mocks.saveWorkbook.mockResolvedValue(undefined)
  })

  it('reuses the stored Inbox while the backend is temporarily unavailable', async () => {
    const cached = workbook('inbox-1')
    mocks.getSetting.mockResolvedValue(cached.id)
    mocks.getWorkbook.mockRejectedValue(new TypeError('fetch failed'))
    mocks.getCachedWorkbook.mockResolvedValue(cached)

    await expect(ensureInboxWorkbook()).resolves.toBe(cached.id)
    expect(mocks.createWorkbook).not.toHaveBeenCalled()
  })

  it('adopts the newest existing Inbox instead of creating a duplicate', async () => {
    mocks.listWorkbooks.mockResolvedValue([
      workbook('map-1', 'Project'),
      workbook('inbox-old', 'Inbox', '2026-01-01T00:00:00Z'),
      workbook('inbox-new', ' inbox ', '2026-02-01T00:00:00Z'),
    ])

    await expect(ensureInboxWorkbook()).resolves.toBe('inbox-new')
    expect(mocks.createWorkbook).not.toHaveBeenCalled()
    expect(mocks.setSetting).toHaveBeenCalledWith('inbox_workbook_id', 'inbox-new')
  })

  it('does not resurrect a cached Inbox that was deleted on the backend', async () => {
    const deleted = workbook('inbox-deleted')
    const created = workbook('inbox-created')
    mocks.getSetting.mockResolvedValue(deleted.id)
    mocks.getWorkbook.mockRejectedValue(new ApiError('not found', 'NOT_FOUND', 404))
    mocks.listWorkbooks.mockResolvedValue([])
    mocks.createWorkbook.mockResolvedValue(created)
    mocks.listCachedWorkbooks.mockResolvedValue([deleted])

    await expect(ensureInboxWorkbook()).resolves.toBe(created.id)
    expect(mocks.getCachedWorkbook).not.toHaveBeenCalled()
  })
})
