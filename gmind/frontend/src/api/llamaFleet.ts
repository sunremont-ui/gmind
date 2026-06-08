import { API_BASE } from './base'

export interface LlamaModel {
  path: string      // relative path inside models dir (forward slashes)
  name: string      // file name
  category: string  // top-level subdir (llm, code, vision...) or "root"
  size: number      // bytes
  running: boolean
  port: number
}

export interface LlamaInstance {
  model: string
  port: number
  context: number
  gpu_layers: number
  threads: number
  started_at: string
}

export interface LlamaFleetStatus {
  models_dir: string
  models: LlamaModel[]
  running: LlamaInstance[]
}

export interface StartModelRequest {
  path: string
  port: number
  context?: number
  gpu_layers?: number
  threads?: number
}

export async function listLlamaModels(): Promise<LlamaFleetStatus> {
  const res = await fetch(`${API_BASE}/llama/models`)
  if (!res.ok) throw new Error(`Failed to load models: ${res.statusText}`)
  return res.json()
}

export async function startLlamaModel(req: StartModelRequest): Promise<{ status: string; instance: LlamaInstance }> {
  const res = await fetch(`${API_BASE}/llama/models/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Failed to start model: ${res.statusText}`)
  return body
}

export async function stopLlamaModel(path: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/llama/models/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Failed to stop model: ${res.statusText}`)
  return body
}
