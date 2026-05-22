import { create } from 'zustand'
import { notesApi, type Note, type CreateNoteRequest } from '../api/notes'

interface NotesState {
  notes: Note[]
  loading: boolean
  error: string | null
  searchQuery: string

  fetchNotes: (query?: string) => Promise<void>
  createNote: (req: CreateNoteRequest) => Promise<Note>
  updateNote: (id: string, updates: { content?: string; tags?: string[]; pinned?: boolean }) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  setSearchQuery: (q: string) => void
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  loading: false,
  error: null,
  searchQuery: '',

  fetchNotes: async (query) => {
    set({ loading: true, error: null })
    try {
      const notes = await notesApi.list(query)
      set({ notes: notes ?? [] })
    } catch (e) {
      set({ error: String(e) })
    } finally {
      set({ loading: false })
    }
  },

  createNote: async (req) => {
    const note = await notesApi.create(req)
    set(s => ({ notes: [note, ...s.notes] }))
    return note
  },

  updateNote: async (id, updates) => {
    const updated = await notesApi.update(id, updates)
    set(s => ({
      notes: s.notes.map(n => n.id === id ? updated : n),
    }))
  },

  deleteNote: async (id) => {
    await notesApi.delete(id)
    set(s => ({ notes: s.notes.filter(n => n.id !== id) }))
  },

  setSearchQuery: (q) => {
    set({ searchQuery: q })
    get().fetchNotes(q || undefined)
  },
}))
