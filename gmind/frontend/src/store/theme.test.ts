import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_THEME_ID, useThemeStore } from './theme'

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear()
    useThemeStore.getState().setTheme(DEFAULT_THEME_ID)
  })

  it('использует Midnight как основную тему', () => {
    expect(DEFAULT_THEME_ID).toBe('midnight')
    expect(useThemeStore.getState().theme.id).toBe('midnight')
  })

  it('сохраняет выбранную тему', () => {
    useThemeStore.getState().setTheme('lumen')
    expect(localStorage.getItem('gmind_theme')).toBe('lumen')
  })
})
