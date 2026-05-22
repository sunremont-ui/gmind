import { create } from 'zustand'

interface ShellState {
  activeModuleId: string | null
  setActiveModule: (id: string | null) => void
  toggleModule: (id: string) => void
  closeModule: () => void
}

export const useShellStore = create<ShellState>((set, get) => ({
  activeModuleId: null,

  setActiveModule: (id) => set({ activeModuleId: id }),

  toggleModule: (id) => {
    const current = get().activeModuleId
    set({ activeModuleId: current === id ? null : id })
  },

  closeModule: () => set({ activeModuleId: null }),
}))
