const API_BASE = '/api/v1'

export interface ModelServer {
  name: string
  endpoint: string
  type: 'openai' | 'ollama' | 'llama'
  port: number
}

export interface ModelServersConfig {
  servers: ModelServer[]
}

export async function getModelServers(): Promise<ModelServersConfig> {
  const res = await fetch(`${API_BASE}/model-servers`)
  if (!res.ok) throw new Error(`Failed to load model servers: ${res.statusText}`)
  return res.json()
}

export async function saveModelServers(cfg: ModelServersConfig): Promise<ModelServersConfig> {
  const res = await fetch(`${API_BASE}/model-servers`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  })
  if (!res.ok) throw new Error(`Failed to save model servers: ${res.statusText}`)
  return res.json()
}
