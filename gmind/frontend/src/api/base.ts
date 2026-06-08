// Resolves the backend origin for both web and desktop builds.
//
// In dev (Vite) and the Docker/web build, the frontend is served from the same
// origin as the API proxy (Vite proxy / nginx), so relative `/api` works.
// In the Tauri desktop app the webview origin is `tauri.localhost`, so a
// relative `/api` never reaches the Go sidecar — we must target it absolutely
// at http://localhost:1010 (where the bundled sidecar listens).

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
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
