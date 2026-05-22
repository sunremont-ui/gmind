import { invoke } from '@tauri-apps/api/core'

export interface StartupSettings {
  autostart: boolean
  startMinimized: boolean
  startupAgentIds: string[]
  mainWindowShortcut: string
}

const DEFAULTS: StartupSettings = {
  autostart: false,
  startMinimized: true,
  startupAgentIds: [],
  mainWindowShortcut: 'ctrl+shift+g',
}

const STORE_KEY = 'startup'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// Lazy-loaded store instance
let _store: import('@tauri-apps/plugin-store').Store | null = null

async function getStore() {
  if (!isTauri()) return null
  if (_store) return _store
  const { Store } = await import('@tauri-apps/plugin-store')
  _store = await Store.load('settings.json')
  return _store
}

export const settingsApi = {
  async load(): Promise<StartupSettings> {
    const store = await getStore()
    if (!store) return { ...DEFAULTS }
    const saved = await store.get<StartupSettings>(STORE_KEY)
    return { ...DEFAULTS, ...saved }
  },

  async save(settings: StartupSettings): Promise<void> {
    const store = await getStore()
    if (!store) return
    await store.set(STORE_KEY, settings)
    await store.save()
  },

  async patch(partial: Partial<StartupSettings>): Promise<StartupSettings> {
    const current = await this.load()
    const updated = { ...current, ...partial }
    await this.save(updated)
    return updated
  },

  // OS autostart helpers — delegates to Tauri commands
  async enableAutostart(): Promise<void> {
    if (!isTauri()) return
    await invoke('enable_autostart')
  },

  async disableAutostart(): Promise<void> {
    if (!isTauri()) return
    await invoke('disable_autostart')
  },

  async isAutostartEnabled(): Promise<boolean> {
    if (!isTauri()) return false
    return invoke<boolean>('is_autostart_enabled')
  },

  async updateMainShortcut(keys: string): Promise<void> {
    if (!isTauri()) return
    await invoke('update_main_shortcut', { keys })
  },
}
