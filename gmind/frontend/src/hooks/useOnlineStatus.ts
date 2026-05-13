import { useState, useEffect, useCallback } from 'react'

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)

  const goOnline = useCallback(() => {
    setOnline(true)
    setWasOffline(true)
  }, [])

  const goOffline = useCallback(() => {
    setOnline(false)
  }, [])

  useEffect(() => {
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [goOnline, goOffline])

  return { online, wasOffline, clearReconnectedFlag: () => setWasOffline(false) }
}
