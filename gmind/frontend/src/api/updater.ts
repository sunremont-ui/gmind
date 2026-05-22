import { getVersion } from '@tauri-apps/api/app'
import { useState, useEffect } from 'react'

export function useVersion() {
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return
    getVersion().then(setAppVersion).catch(() => {})
  }, [])

  return { appVersion }
}
