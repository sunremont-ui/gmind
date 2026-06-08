// Resolves the backend origin for both web and desktop builds.
//
// In dev (Vite) and the Docker/web build, the frontend is served from the same
// origin as the API proxy (Vite proxy / nginx), so relative `/api` works.
// In the Tauri desktop app the webview origin is `tauri.localhost`, so a
// relative `/api` never reaches the Go sidecar — we must target it absolutely
// at http://localhost:1010 (where the bundled sidecar listens).

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  // Primary: the Tauri IPC global. Fallback: the webview origin — on Windows
  // the packaged app is served from http(s)://tauri.localhost, on macOS/Linux
  // from tauri://localhost. The origin check is robust even if the global isn't
  // injected yet when this module is first evaluated.
  if ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) return true
  const host = window.location.hostname
  return host === 'tauri.localhost' || window.location.protocol === 'tauri:'
}

// Empty string in web/dev (relative URLs); absolute sidecar origin in desktop.
export const API_ORIGIN = isTauri() ? 'http://localhost:1010' : ''

export const API_BASE = `${API_ORIGIN}/api/v1`

// WebSocket URL honouring the same origin rule.
export function wsUrl(path = '/ws'): string {
  if (isTauri()) return `ws://localhost:1010${path}`
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:1010'
  return `${protocol}//${host}${path}`
}
