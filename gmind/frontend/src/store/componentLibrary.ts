// Стор пользовательских визуальных компонентов.
//
// Как и корпуса: реестр в renderer/componentLibrary.ts остаётся чистым, стор
// лишь внедряет в него свой список и сохраняет его локально — библиотека
// переживает перезапуск приложения.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setCustomComponents, type VisualComponent } from '../renderer/componentLibrary'

const STORAGE_KEY = 'gmind-visual-components'

interface ComponentLibraryState {
  /** Свои компоненты; id может перекрывать встроенный. */
  custom: VisualComponent[]
  saveComponent: (c: VisualComponent) => void
  /**
   * Удалить свой компонент. Для перекрытого встроенного это же действие
   * возвращает исходный — он живёт в коде.
   */
  removeComponent: (id: string) => void
  clearAll: () => void
}

export const useComponentLibraryStore = create<ComponentLibraryState>()(
  persist(
    (set, get) => ({
      custom: [],

      saveComponent(c) {
        const next = get().custom.filter(x => x.id !== c.id)
        next.push(c)
        set({ custom: next })
        setCustomComponents(next)
      },

      removeComponent(id) {
        const next = get().custom.filter(x => x.id !== id)
        set({ custom: next })
        setCustomComponents(next)
      },

      clearAll() {
        set({ custom: [] })
        setCustomComponents([])
      },
    }),
    {
      name: STORAGE_KEY,
      // Реестр надо наполнить сразу после восстановления, иначе палитра
      // откроется без своих компонентов.
      onRehydrateStorage: () => (state) => {
        if (state?.custom?.length) setCustomComponents(state.custom)
      },
    },
  ),
)
