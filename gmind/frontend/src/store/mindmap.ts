import { create } from 'zustand'
import type { Workbook, Sheet, Topic } from '../types'

interface MindMapState {
  workbook: Workbook | null
  activeSheetId: string | null
  selectedTopicId: string | null
  selectedTopicIds: string[]
  loading: boolean
  error: string | null

  setWorkbook: (wb: Workbook) => void
  setActiveSheet: (sheetId: string) => void
  setSelectedTopic: (topicId: string | null) => void
  setSelectedTopics: (ids: string[]) => void
  toggleSelectedTopic: (topicId: string) => void
  clearSelection: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  updateTopicInTree: (topicId: string, updates: Partial<Topic>) => void
  addTopic: (parentId: string, topic: Topic) => void
  removeTopic: (topicId: string) => void

  addFloatingTopic: (topic: Topic) => void
  updateFloatingTopic: (topicId: string, updates: Partial<Topic>) => void
  removeFloatingTopic: (topicId: string) => void

  getActiveSheet: () => Sheet | null
  getTopic: (topicId: string) => Topic | null
}

export const useMindMapStore = create<MindMapState>((set, get) => ({
  workbook: null,
  activeSheetId: null,
  selectedTopicId: null,
  selectedTopicIds: [],
  loading: false,
  error: null,

  setWorkbook: (wb) => set({
    workbook: wb,
    activeSheetId: wb.sheets[0]?.id ?? null,
  }),

  setActiveSheet: (sheetId) => set({ activeSheetId: sheetId }),
  setSelectedTopic: (topicId) => set({ selectedTopicId: topicId, selectedTopicIds: topicId ? [topicId] : [] }),
  setSelectedTopics: (ids) => set({ selectedTopicIds: ids, selectedTopicId: ids[0] ?? null }),
  toggleSelectedTopic: (topicId) => set(state => {
    const exists = state.selectedTopicIds.includes(topicId)
    const ids = exists
      ? state.selectedTopicIds.filter(id => id !== topicId)
      : [...state.selectedTopicIds, topicId]
    return { selectedTopicIds: ids, selectedTopicId: ids[0] ?? null }
  }),
  clearSelection: () => set({ selectedTopicIds: [], selectedTopicId: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  updateTopicInTree: (topicId, updates) => {
    const { workbook } = get()
    if (!workbook) return

    const updated = { ...workbook }
    const updateRecursive = (topic: Topic): Topic => {
      if (topic.id === topicId) {
        return { ...topic, ...updates }
      }
      if (topic.children) {
        return { ...topic, children: topic.children.map(updateRecursive) }
      }
      return topic
    }

    updated.sheets = updated.sheets.map(sheet => ({
      ...sheet,
      root_topic: updateRecursive(sheet.root_topic),
    }))

    set({ workbook: updated })
  },

  addTopic: (parentId, topic) => {
    const { workbook } = get()
    if (!workbook) return

    const existsInTree = (t: Topic): boolean => {
      if (t.id === topic.id) return true
      return (t.children ?? []).some(existsInTree)
    }
    if (workbook.sheets.some(s => existsInTree(s.root_topic))) return

    const updated = { ...workbook }

    const addRecursive = (t: Topic): Topic => {
      if (t.id === parentId) {
        return { ...t, children: [...(t.children || []), topic] }
      }
      if (t.children) {
        return { ...t, children: t.children.map(addRecursive) }
      }
      return t
    }

    updated.sheets = updated.sheets.map(sheet => ({
      ...sheet,
      root_topic: addRecursive(sheet.root_topic),
    }))

    set({ workbook: updated })
  },

  removeTopic: (topicId) => {
    const { workbook } = get()
    if (!workbook) return

    const updated = { ...workbook }

    const removeRecursive = (t: Topic): Topic | null => {
      if (t.id === topicId) return null
      if (t.children) {
        const filtered = t.children
          .map(removeRecursive)
          .filter((c): c is Topic => c !== null)
        return { ...t, children: filtered }
      }
      return t
    }

    updated.sheets = updated.sheets.map(sheet => ({
      ...sheet,
      root_topic: removeRecursive(sheet.root_topic) ?? sheet.root_topic,
    }))

    set({ workbook: updated })
  },

  addFloatingTopic: (topic) => {
    const { workbook } = get()
    if (!workbook) return

    const updated = { ...workbook }
    const sheet = updated.sheets.find(s => s.id === useMindMapStore.getState().activeSheetId)
    if (sheet) {
      sheet.floating_topics = [...(sheet.floating_topics || []), topic]
    }
    set({ workbook: updated })
  },

  updateFloatingTopic: (topicId, updates) => {
    const { workbook } = get()
    if (!workbook) return

    const updated = { ...workbook }
    for (const sheet of updated.sheets) {
      const idx = (sheet.floating_topics || []).findIndex(ft => ft.id === topicId)
      if (idx !== -1) {
        const ft = [...sheet.floating_topics!]
        ft[idx] = { ...ft[idx], ...updates }
        sheet.floating_topics = ft
        break
      }
    }
    set({ workbook: updated })
  },

  removeFloatingTopic: (topicId) => {
    const { workbook } = get()
    if (!workbook) return

    const updated = { ...workbook }
    for (const sheet of updated.sheets) {
      if (sheet.floating_topics) {
        sheet.floating_topics = sheet.floating_topics.filter(ft => ft.id !== topicId)
      }
    }
    set({ workbook: updated })
  },

  getActiveSheet: () => {
    const { workbook, activeSheetId } = get()
    if (!workbook || !activeSheetId) return null
    return workbook.sheets.find(s => s.id === activeSheetId) ?? null
  },

  getTopic: (topicId) => {
    const { workbook } = get()
    if (!workbook) return null

    const findRecursive = (topic: Topic): Topic | null => {
      if (topic.id === topicId) return topic
      for (const child of topic.children ?? []) {
        const found = findRecursive(child)
        if (found) return found
      }
      return null
    }

    for (const sheet of workbook.sheets) {
      const found = findRecursive(sheet.root_topic)
      if (found) return found
      for (const ft of sheet.floating_topics ?? []) {
        if (ft.id === topicId) return ft
      }
    }
    return null
  },
}))
