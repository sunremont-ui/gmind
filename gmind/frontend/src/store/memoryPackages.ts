// Стор пользовательских корпусов памяти.
//
// Реестр в renderer/memoryPackages.ts остаётся чистым: стор лишь «внедряет» в
// него свой список через setCustomPackages, поэтому рендер узла и тесты не
// зависят от React. Список сохраняется локально — визуальный язык переживает
// перезапуск приложения.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setCustomPackages, type MemoryPackage } from '../renderer/memoryPackages'

const STORAGE_KEY = 'gmind-memory-packages'

interface MemoryPackagesState {
  /** Пользовательские корпуса; kind может перекрывать встроенный. */
  custom: MemoryPackage[]
  /** Добавить новый или заменить существующий по kind. */
  savePackage: (pkg: MemoryPackage) => void
  /**
   * Удалить пользовательский корпус. Для перекрытого встроенного вида это
   * же действие возвращает исходный корпус — он живёт в коде.
   */
  removePackage: (kind: string) => void
  /** Убрать все пользовательские корпуса. */
  clearAll: () => void
}

export const useMemoryPackagesStore = create<MemoryPackagesState>()(
  persist(
    (set, get) => ({
      custom: [],

      savePackage(pkg) {
        const kind = pkg.kind.trim().toLowerCase()
        const next = get().custom.filter(p => p.kind !== kind)
        next.push({ ...pkg, kind })
        set({ custom: next })
        setCustomPackages(next)
      },

      removePackage(kind) {
        const next = get().custom.filter(p => p.kind !== kind)
        set({ custom: next })
        setCustomPackages(next)
      },

      clearAll() {
        set({ custom: [] })
        setCustomPackages([])
      },
    }),
    {
      name: STORAGE_KEY,
      // После восстановления из localStorage реестр надо наполнить сразу,
      // иначе первый рендер холста пройдёт без пользовательских корпусов.
      onRehydrateStorage: () => (state) => {
        if (state?.custom?.length) setCustomPackages(state.custom)
      },
    },
  ),
)
