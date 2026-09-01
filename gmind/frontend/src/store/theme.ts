import { create } from 'zustand'
import { themes, type Theme } from '../types/theme'

export const DEFAULT_THEME_ID = 'midnight'
const THEME_STORAGE_KEY = 'gmind_theme'

function savedTheme(): Theme {
  try {
    const id = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME_ID
    return themes.find(theme => theme.id === id) ?? themes.find(theme => theme.id === DEFAULT_THEME_ID)!
  } catch {
    return themes.find(theme => theme.id === DEFAULT_THEME_ID)!
  }
}

function saveTheme(id: string) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id)
  } catch {
    // В приватном режиме выбранная тема просто не переживёт перезапуск.
  }
}

interface ThemeState {
  currentThemeId: string
  theme: Theme
  setTheme: (id: string) => void
}

const initialTheme = savedTheme()

export const useThemeStore = create<ThemeState>((set) => ({
  currentThemeId: initialTheme.id,
  theme: initialTheme,
  setTheme: (id: string) => {
    const found = themes.find(t => t.id === id)
    if (found) {
      set({ currentThemeId: id, theme: found })
      saveTheme(id)
    }
  },
}))
