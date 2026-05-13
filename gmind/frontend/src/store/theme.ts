import { create } from 'zustand'
import { themes, type Theme } from '../types/theme'

interface ThemeState {
  currentThemeId: string
  theme: Theme
  setTheme: (id: string) => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  currentThemeId: 'lumen',
  theme: themes[0],
  setTheme: (id: string) => {
    const found = themes.find(t => t.id === id)
    if (found) {
      set({ currentThemeId: id, theme: found })
    }
  },
}))
