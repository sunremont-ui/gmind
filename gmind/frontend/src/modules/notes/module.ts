import { lazy } from 'react'
import type { AppModule } from '../types'
import { LumenStickyNote } from '../../components/UI/LumenIcon'

const NotesPanel = lazy(() =>
  import('../../components/NotesPanel/NotesPanel').then(m => ({ default: m.NotesPanel }))
)

export const NotesModule: AppModule = {
  id: 'notes',
  name: 'Notes',
  icon: LumenStickyNote,
  order: 1,
  tooltip: 'Quick Notes',
  panel: NotesPanel,

  commands: (_ctx) => [
    {
      id: 'open-notes',
      label: 'Open Notes',
      icon: 'sticky-note',
      section: 'Panels',
      action: () => {
        import('../../store/shell').then(({ useShellStore }) => {
          useShellStore.getState().toggleModule('notes')
        })
      },
    },
    {
      id: 'new-note',
      label: 'New note',
      shortcut: 'Ctrl+Shift+N',
      icon: 'sticky-note',
      section: 'Notes',
      action: () => {
        import('../../store/shell').then(({ useShellStore }) => {
          useShellStore.getState().setActiveModule('notes')
        })
        // Signal NotesPanel to focus input — via a custom event
        window.dispatchEvent(new CustomEvent('gmind:focus-note-input'))
      },
    },
  ],

  agentTools: [
    { name: 'save_note', label: 'Save Note', description: 'Save a quick note with optional tags', category: 'notes' },
    { name: 'search_notes', label: 'Search Notes', description: 'Search notes by content or tags', category: 'notes' },
  ],
}
