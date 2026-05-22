import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../api/client'
import { secrets } from '../../api/secrets'
import { getModelServers, saveModelServers, type ModelServer, type ModelServersConfig } from '../../api/modelServers'
import { LumenX, LumenPlay, LumenSquare, LumenCloud, LumenGlobe, LumenZap } from '../UI/LumenIcon'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions, z } from '../../styles/tokens'

interface ServerConfig {
  server_path: string
  model_path: string
  port: number
  context: number
  gpu_layers: number
  threads: number
}

interface YandexConfig {
  apiKey: string
  folderId: string
  model: string
}

interface OllamaState {
  detected: boolean
  models: { name: string; modified_at: string; size: number }[]
  baseUrl: string
}

interface OpenAIConfig {
  apiKey: string
  endpoint: string
  model: string
}

interface AIServerPanelProps {
  onClose: () => void
}

const formatOllamaSize = (bytes: number): string => {
  if (bytes === 0) return ''
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

const formatOllamaDate = (dateStr: string): string => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString()
  } catch {
    return dateStr
  }
}

export function AIServerPanel({ onClose }: AIServerPanelProps) {
  const [config, setConfig] = useState<ServerConfig>({
    server_path: 'E:\\LlamaCpp\\llama.cpp\\build\\bin\\Release\\llama-server.exe',
    model_path: 'E:\\LlamaCpp\\models\\qwen2.5-coder-7b-instruct-q4_k_m.gguf',
    port: 1100,
    context: 4096,
    gpu_layers: 33,
    threads: 4,
  })
  const [yandexConfig, setYandexConfig] = useState<YandexConfig>({
    apiKey: '',
    folderId: '',
    model: 'yandexgpt-lite',
  })
  const [openAIConfig, setOpenAIConfig] = useState<OpenAIConfig>({
    apiKey: '',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  })
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [yandexStatus, setYandexStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [ollama, setOllama] = useState<OllamaState>({ detected: false, models: [], baseUrl: '' })
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'loading' | 'ok'>('idle')
  const [modelServers, setModelServers] = useState<ModelServersConfig>({ servers: [] })
  const [editingServer, setEditingServer] = useState<ModelServer | null>(null)
  const [addingServer, setAddingServer] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.getLlamaStatus()
      setRunning(res.running)
      setConfig(res.config)
      setError('')
    } catch {
      // server down
    }
  }, [])

  const fetchOllamaStatus = useCallback(async () => {
    try {
      const res = await api.getOllamaStatus()
      setOllama({ detected: res.detected, models: res.models, baseUrl: res.base_url })
    } catch {
      // ollama not reachable
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    fetchOllamaStatus()
    getModelServers().then(setModelServers).catch(() => {})
    // Load persisted secrets from Stronghold (Tauri only)
    secrets.loadYandexConfig().then(cfg => {
      if (cfg) setYandexConfig(cfg)
    })
    secrets.loadOpenAIConfig().then(cfg => {
      if (cfg) setOpenAIConfig(cfg)
    })
    pollRef.current = setInterval(() => {
      fetchStatus()
      fetchOllamaStatus()
    }, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchStatus, fetchOllamaStatus])

  const handleStart = async () => {
    setLoading(true)
    setError('')
    try {
      await api.updateLlamaConfig(config)
      await api.saveLlamaConfig()
      const res = await api.startLlama()
      setRunning(true)
      setConfig(res.config)
      await api.switchAIProvider('local', `http://localhost:${config.port}/v1`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start server')
    }
    setLoading(false)
  }

  const handleStop = async () => {
    setLoading(true)
    setError('')
    try {
      await api.stopLlama()
      setRunning(false)
      await api.switchAIProvider('openai')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop server')
    }
    setLoading(false)
  }

  const handleYandexApply = async () => {
    setYandexStatus('loading')
    setError('')
    try {
      await api.switchAIProvider('yandex', undefined, yandexConfig.model, yandexConfig.apiKey, yandexConfig.folderId)
      await secrets.saveYandexConfig(yandexConfig.apiKey, yandexConfig.folderId, yandexConfig.model)
      setYandexStatus('ok')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch to Yandex GPT')
      setYandexStatus('error')
    }
  }

  const handleOpenAIApply = async () => {
    setError('')
    try {
      await api.switchAIProvider('openai')
      await secrets.saveOpenAIConfig(openAIConfig.apiKey, openAIConfig.endpoint, openAIConfig.model)
      // Inject into backend immediately
      await api.applyConfig({
        openai_api_key: openAIConfig.apiKey,
        openai_endpoint: openAIConfig.endpoint,
        openai_model: openAIConfig.model,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply OpenAI config')
    }
  }

  const handleUseOllama = async (modelName?: string) => {
    setOllamaStatus('loading')
    setError('')
    try {
      await api.switchAIProvider('ollama', undefined, modelName || ollama.models[0]?.name)
      setOllamaStatus('ok')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch to Ollama')
      setOllamaStatus('idle')
    }
  }

  const handleUseOpenAI = async () => {
    setYandexStatus('loading')
    setError('')
    try {
      await api.switchAIProvider('openai')
      setYandexStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch to OpenAI')
      setYandexStatus('error')
    }
  }

  const updateOpenAI = (field: keyof OpenAIConfig, value: string) => {
    setOpenAIConfig(prev => ({ ...prev, [field]: value }))
  }

  const update = (field: keyof ServerConfig, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const updateYandex = (field: keyof YandexConfig, value: string) => {
    setYandexConfig(prev => ({ ...prev, [field]: value }))
  }

  const handleUseModelServer = async (srv: ModelServer) => {
    try {
      await api.switchAIProvider('local', srv.endpoint)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch provider')
    }
  }

  const handleSaveModelServers = async (servers: ModelServer[]) => {
    try {
      const updated = await saveModelServers({ servers })
      setModelServers(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save model servers')
    }
  }

  const handleDeleteServer = (endpoint: string) => {
    handleSaveModelServers(modelServers.servers.filter(s => s.endpoint !== endpoint))
  }

  const emptyServer = (): ModelServer => ({ name: '', endpoint: 'http://localhost:1100/v1', type: 'openai', port: 1100 })

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: `${spacing.md}px ${spacing.lg}px`,
    fontSize: fontSizes.body, fontFamily: fonts.ui,
    border: 'none',
    borderRadius: radii.md, outline: 'none',
    background: colors.bgTertiary,
    color: colors.text, boxSizing: 'border-box',
    boxShadow: shadows.neuInsetSm,
    transition: `box-shadow ${transitions.fast}`,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: z.modal,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: colors.scrim,
    }} onClick={onClose}>
      <div style={{
        background: colors.bgTertiary, borderRadius: 18, boxShadow: shadows.neuLg,
        width: 480, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto',
        fontFamily: fonts.ui, border: 'none',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: `${spacing.xl}px ${spacing.xxl}px`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg }}>
            <span style={{ fontSize: fontSizes.title, fontWeight: fontWeights.semibold, color: colors.text }}>Local AI Server</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
              padding: `${spacing.xxs}px ${spacing.md}px`, borderRadius: radii.full,
              fontSize: fontSizes.caption, fontWeight: fontWeights.semibold,
              background: running ? colors.green + '20' : colors.bgTertiary,
              color: running ? colors.green : colors.textSecondary,
            }}>
              {running ? <LumenPlay size={10} fill={colors.green} /> : <LumenSquare size={10} />}
              {running ? 'Running' : 'Stopped'}
            </span>
          </div>
          <button onClick={onClose}
            style={{
              border: 'none', background: 'none', cursor: 'pointer', display: 'flex',
              color: colors.textQuaternary, padding: 0,
              transition: `color ${transitions.fast}`,
            }}
            onMouseEnter={e => e.currentTarget.style.color = colors.text}
            onMouseLeave={e => e.currentTarget.style.color = colors.textQuaternary}
          >
            <LumenX size={18} strokeWidth={1.8} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: spacing.xxl, display: 'flex', flexDirection: 'column', gap: spacing.xl }}>

          {error && (
            <div style={{
              padding: `${spacing.md}px ${spacing.lg}px`,
              background: colors.red + '12', border: `1px solid ${colors.red}40`,
              borderRadius: radii.md, color: colors.red, fontSize: fontSizes.body,
            }}>
              {error}
            </div>
          )}

          <Field label="Server Path">
            <input value={config.server_path} onChange={e => update('server_path', e.target.value)}
              placeholder="E:\LlamaCpp\llama.cpp\build\bin\Release\llama-server.exe"
              style={inputStyle} disabled={running}
              onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
              onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
            />
          </Field>

          <Field label="Model Path">
            <input value={config.model_path} onChange={e => update('model_path', e.target.value)}
              placeholder="E:\LlamaCpp\models\qwen2.5-coder-7b-instruct-q4_k_m.gguf"
              style={inputStyle} disabled={running}
              onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
              onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
            />
          </Field>

          <div style={{ display: 'flex', gap: spacing.lg }}>
            <Field label="Port" style={{ flex: 1 }}>
              <input type="number" value={config.port} onChange={e => update('port', parseInt(e.target.value) || 1100)}
                style={inputStyle} disabled={running}
                onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
                onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
              />
            </Field>
            <Field label="Context Size" style={{ flex: 1 }}>
              <input type="number" value={config.context} onChange={e => update('context', parseInt(e.target.value) || 4096)}
                style={inputStyle} disabled={running}
                onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
                onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
              />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: spacing.lg }}>
            <Field label="GPU Layers" style={{ flex: 1 }}>
              <input type="number" value={config.gpu_layers} onChange={e => update('gpu_layers', parseInt(e.target.value) || 0)}
                style={inputStyle} disabled={running}
                onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
                onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
              />
            </Field>
            <Field label="Threads" style={{ flex: 1 }}>
              <input type="number" value={config.threads} onChange={e => update('threads', parseInt(e.target.value) || 4)}
                style={inputStyle} disabled={running}
                onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
                onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
              />
            </Field>
          </div>

          {/* Quick presets */}
          <div style={{ fontSize: fontSizes.body, color: colors.textSecondary }}>
            <span style={{ fontWeight: fontWeights.medium }}>Presets: </span>
            {[
              { label: 'Full GPU (33)', value: 33 },
              { label: 'Partial (20)', value: 20 },
              { label: 'CPU only', value: 0 },
            ].map(p => (
              <button key={p.label} onClick={() => update('gpu_layers', p.value)}
                style={{
                  padding: `${spacing.xxs}px ${spacing.md}px`,
                  border: `1px solid ${colors.separator}`, borderRadius: radii.sm,
                  background: colors.bg, cursor: 'pointer', fontSize: fontSizes.caption,
                  color: colors.textSecondary, marginLeft: spacing.xs, fontFamily: fonts.ui,
                  transition: `all ${transitions.fast}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.color = colors.accent }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = colors.separator; e.currentTarget.style.color = colors.textSecondary }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: colors.separator, margin: `0 ${-spacing.xxl}px` }} />

          {/* Ollama Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <LumenZap size={16} strokeWidth={2} color={ollama.detected ? colors.green : colors.textQuaternary} />
              <span style={{ fontSize: fontSizes.body, fontWeight: fontWeights.semibold, color: colors.text }}>Ollama</span>
              <span style={{
                fontSize: fontSizes.caption, fontWeight: fontWeights.medium, marginLeft: 'auto',
                color: ollama.detected ? colors.green : colors.textQuaternary,
              }}>
                {ollama.detected ? 'Detected ✓' : 'Not detected'}
              </span>
            </div>

            {ollama.detected && (
              <>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: spacing.sm,
                  marginBottom: spacing.md,
                }}>
                  {ollama.models.map(m => (
                    <button key={m.name} onClick={() => handleUseOllama(m.name)}
                      style={{
                        padding: `${spacing.xs}px ${spacing.md}px`,
                        border: `1px solid ${colors.separator}`, borderRadius: radii.md,
                        background: colors.bg, cursor: 'pointer',
                        fontSize: fontSizes.caption, fontFamily: fonts.ui,
                        color: colors.text, textAlign: 'left',
                        transition: `all ${transitions.fast}`,
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.background = colors.bgTertiary }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = colors.separator; e.currentTarget.style.background = colors.bg }}
                    >
                      <span style={{ fontWeight: fontWeights.medium }}>{m.name}</span>
                      <span style={{ fontSize: fontSizes.label, color: colors.textQuaternary }}>
                        {formatOllamaSize(m.size)}{m.size > 0 && ' · '}{formatOllamaDate(m.modified_at)}
                      </span>
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: spacing.md }}>
                  <button onClick={() => handleUseOllama()} disabled={ollamaStatus === 'loading' || ollama.models.length === 0}
                    style={{
                      flex: 1, padding: `${spacing.md}px ${spacing.lg}px`, border: 'none', borderRadius: radii.md,
                      background: ollamaStatus === 'loading' ? colors.textQuaternary : colors.accent,
                      color: colors.textInverse, cursor: ollamaStatus === 'loading' ? 'not-allowed' : 'pointer',
                      fontSize: fontSizes.body, fontWeight: fontWeights.medium, fontFamily: fonts.ui,
                      transition: `background ${transitions.fast}`,
                    }}
                    onMouseEnter={e => { if (ollamaStatus !== 'loading') e.currentTarget.style.background = colors.accentHover }}
                    onMouseLeave={e => { if (ollamaStatus !== 'loading') e.currentTarget.style.background = colors.accent }}
                  >
                    {ollamaStatus === 'loading' ? 'Switching...' : ollamaStatus === 'ok' ? 'Active ✓' : `Use Ollama (${ollama.models[0]?.name || '?'})`}
                  </button>
                </div>

                <div style={{ fontSize: fontSizes.caption, color: colors.textQuaternary, marginTop: spacing.xs }}>
                  Running at {ollama.baseUrl}
                </div>
              </>
            )}

            {!ollama.detected && (
              <div style={{ fontSize: fontSizes.caption, color: colors.textQuaternary, marginTop: spacing.xs }}>
                Ollama not found on localhost:11434.{' '}
                <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer"
                  style={{ color: colors.accent, textDecoration: 'none' }}>
                  Download Ollama
                </a>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: colors.separator, margin: `0 ${-spacing.xxl}px` }} />

          {/* External Model Servers */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <LumenZap size={16} strokeWidth={2} color={colors.textSecondary} />
              <span style={{ fontSize: fontSizes.body, fontWeight: fontWeights.semibold, color: colors.text }}>External Model Servers</span>
              <button
                onClick={() => { setAddingServer(true); setEditingServer(emptyServer()) }}
                style={{
                  marginLeft: 'auto', padding: `${spacing.xxs}px ${spacing.md}px`,
                  border: `1px solid ${colors.separator}`, borderRadius: radii.sm,
                  background: 'none', cursor: 'pointer', fontSize: fontSizes.caption,
                  color: colors.textSecondary, fontFamily: fonts.ui,
                  transition: `all ${transitions.fast}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.color = colors.accent }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = colors.separator; e.currentTarget.style.color = colors.textSecondary }}
              >+ Add</button>
            </div>

            {/* Add / Edit form */}
            {(addingServer && editingServer) && (
              <div style={{
                background: colors.bg, borderRadius: radii.md, padding: spacing.lg,
                marginBottom: spacing.md, display: 'flex', flexDirection: 'column', gap: spacing.md,
                boxShadow: shadows.neuInsetSm,
              }}>
                <div style={{ display: 'flex', gap: spacing.md }}>
                  <Field label="Name" style={{ flex: 1 }}>
                    <input value={editingServer.name}
                      onChange={e => setEditingServer(prev => prev ? { ...prev, name: e.target.value } : prev)}
                      placeholder="LM Studio" style={inputStyle} />
                  </Field>
                  <Field label="Type" style={{ flex: 1 }}>
                    <select value={editingServer.type}
                      onChange={e => setEditingServer(prev => prev ? { ...prev, type: e.target.value as ModelServer['type'] } : prev)}
                      style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="openai">OpenAI-compat</option>
                      <option value="ollama">Ollama</option>
                      <option value="llama">llama.cpp</option>
                    </select>
                  </Field>
                </div>
                <div style={{ display: 'flex', gap: spacing.md }}>
                  <Field label="Endpoint" style={{ flex: 2 }}>
                    <input value={editingServer.endpoint}
                      onChange={e => setEditingServer(prev => prev ? { ...prev, endpoint: e.target.value } : prev)}
                      placeholder="http://localhost:1100/v1" style={inputStyle} />
                  </Field>
                  <Field label="Port" style={{ flex: 1 }}>
                    <input type="number" value={editingServer.port}
                      onChange={e => setEditingServer(prev => prev ? { ...prev, port: parseInt(e.target.value) || 1100 } : prev)}
                      style={inputStyle} />
                  </Field>
                </div>
                <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setAddingServer(false); setEditingServer(null) }}
                    style={{ padding: `${spacing.xxs}px ${spacing.lg}px`, border: `1px solid ${colors.separator}`, borderRadius: radii.sm, background: 'none', cursor: 'pointer', fontSize: fontSizes.caption, color: colors.textSecondary, fontFamily: fonts.ui }}>
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!editingServer.name || !editingServer.endpoint) return
                      handleSaveModelServers([...modelServers.servers.filter(s => s.endpoint !== editingServer.endpoint), editingServer])
                      setAddingServer(false)
                      setEditingServer(null)
                    }}
                    style={{ padding: `${spacing.xxs}px ${spacing.lg}px`, border: 'none', borderRadius: radii.sm, background: colors.accent, color: colors.textInverse, cursor: 'pointer', fontSize: fontSizes.caption, fontFamily: fonts.ui }}>
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Server table */}
            {modelServers.servers.length === 0 && !addingServer && (
              <div style={{ fontSize: fontSizes.caption, color: colors.textQuaternary }}>
                No servers configured. Add LM Studio, Jan, llama.cpp or any OpenAI-compatible server.
              </div>
            )}
            {modelServers.servers.map(srv => (
              <div key={srv.endpoint} style={{
                display: 'flex', alignItems: 'center', gap: spacing.md,
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: radii.md, marginBottom: spacing.xs,
                background: colors.bg,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: fontSizes.body, fontWeight: fontWeights.medium, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{srv.name}</div>
                  <div style={{ fontSize: fontSizes.caption, color: colors.textQuaternary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{srv.endpoint}</div>
                </div>
                <span style={{ fontSize: fontSizes.caption, color: colors.textTertiary, flexShrink: 0 }}>{srv.type}</span>
                <button onClick={() => handleUseModelServer(srv)}
                  style={{
                    padding: `${spacing.xxs}px ${spacing.md}px`, border: 'none', borderRadius: radii.sm,
                    background: colors.accent, color: colors.textInverse, cursor: 'pointer',
                    fontSize: fontSizes.caption, fontFamily: fonts.ui, flexShrink: 0,
                  }}>
                  Use
                </button>
                <button onClick={() => handleDeleteServer(srv.endpoint)}
                  style={{
                    padding: `${spacing.xxs}px ${spacing.sm}px`, border: `1px solid ${colors.separator}`,
                    borderRadius: radii.sm, background: 'none', cursor: 'pointer',
                    fontSize: fontSizes.caption, color: colors.textQuaternary, fontFamily: fonts.ui, flexShrink: 0,
                    transition: `all ${transitions.fast}`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = colors.red; e.currentTarget.style.color = colors.red }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = colors.separator; e.currentTarget.style.color = colors.textQuaternary }}
                >✕</button>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: colors.separator, margin: `0 ${-spacing.xxl}px` }} />

          {/* OpenAI Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <LumenGlobe size={16} strokeWidth={2} color={colors.textSecondary} />
            <span style={{ fontSize: fontSizes.body, fontWeight: fontWeights.semibold, color: colors.text }}>OpenAI</span>
          </div>

          <Field label="API Key">
            <input type="password" value={openAIConfig.apiKey} onChange={e => updateOpenAI('apiKey', e.target.value)}
              placeholder="sk-..."
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
              onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
            />
          </Field>

          <div style={{ display: 'flex', gap: spacing.lg }}>
            <Field label="Endpoint" style={{ flex: 2 }}>
              <input value={openAIConfig.endpoint} onChange={e => updateOpenAI('endpoint', e.target.value)}
                placeholder="https://api.openai.com/v1"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
                onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
              />
            </Field>
            <Field label="Model" style={{ flex: 1 }}>
              <input value={openAIConfig.model} onChange={e => updateOpenAI('model', e.target.value)}
                placeholder="gpt-4o"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
                onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
              />
            </Field>
          </div>

          <button onClick={handleOpenAIApply}
            style={{
              width: '100%', padding: `${spacing.md}px ${spacing.lg}px`, border: 'none', borderRadius: radii.md,
              background: colors.accent, color: colors.textInverse, cursor: 'pointer',
              fontSize: fontSizes.body, fontWeight: fontWeights.medium, fontFamily: fonts.ui,
              transition: `background ${transitions.fast}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = colors.accentHover }}
            onMouseLeave={e => { e.currentTarget.style.background = colors.accent }}
          >
            Save &amp; Use OpenAI
          </button>

          {/* Divider */}
          <div style={{ height: 1, background: colors.separator, margin: `0 ${-spacing.xxl}px` }} />

          {/* Yandex GPT Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <LumenCloud size={16} strokeWidth={2} color={colors.textSecondary} />
            <span style={{ fontSize: fontSizes.body, fontWeight: fontWeights.semibold, color: colors.text }}>Yandex GPT</span>
            {yandexStatus === 'ok' && (
              <span style={{ fontSize: fontSizes.caption, color: colors.green, marginLeft: 'auto' }}>Active</span>
            )}
          </div>

          <Field label="API Key">
            <input type="password" value={yandexConfig.apiKey} onChange={e => updateYandex('apiKey', e.target.value)}
              placeholder="Api-Key from Yandex Cloud console"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
              onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
            />
          </Field>

          <Field label="Folder ID">
            <input value={yandexConfig.folderId} onChange={e => updateYandex('folderId', e.target.value)}
              placeholder="Your Yandex Cloud folder ID"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
              onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
            />
          </Field>

          <Field label="Model">
            <input value={yandexConfig.model} onChange={e => updateYandex('model', e.target.value)}
              placeholder="yandexgpt-lite"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.boxShadow = `${shadows.neuInsetSm}, 0 0 0 3px ${colors.accentLight}` }}
              onBlur={e => { e.currentTarget.style.boxShadow = shadows.neuInsetSm }}
            />
          </Field>

          <div style={{ display: 'flex', gap: spacing.md }}>
            <button onClick={handleYandexApply} disabled={yandexStatus === 'loading'}
              style={{
                flex: 1, padding: `${spacing.md}px ${spacing.lg}px`, border: 'none', borderRadius: radii.md,
                background: yandexStatus === 'loading' ? colors.textQuaternary : colors.accent,
                color: colors.textInverse, cursor: yandexStatus === 'loading' ? 'not-allowed' : 'pointer',
                fontSize: fontSizes.body, fontWeight: fontWeights.medium, fontFamily: fonts.ui,
                transition: `background ${transitions.fast}`,
              }}
              onMouseEnter={e => { if (yandexStatus !== 'loading') e.currentTarget.style.background = colors.accentHover }}
              onMouseLeave={e => { if (yandexStatus !== 'loading') e.currentTarget.style.background = colors.accent }}
            >
              {yandexStatus === 'loading' ? 'Switching...' : 'Use Yandex GPT'}
            </button>
            <button onClick={handleUseOpenAI}
              style={{
                padding: `${spacing.md}px ${spacing.lg}px`, border: `1px solid ${colors.separator}`,
                borderRadius: radii.md, background: colors.bg, cursor: 'pointer',
                fontSize: fontSizes.body, fontWeight: fontWeights.medium, fontFamily: fonts.ui,
                color: colors.textSecondary, transition: `all ${transitions.fast}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.color = colors.accent }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = colors.separator; e.currentTarget.style.color = colors.textSecondary }}
            >
              Use OpenAI
            </button>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: `${spacing.lg}px ${spacing.xxl}px`,
          borderTop: `1px solid ${colors.separator}`,
          display: 'flex', justifyContent: 'flex-end', gap: spacing.md,
          background: colors.bg,
        }}>
          {running ? (
            <button onClick={handleStop} disabled={loading}
              style={{
                padding: `${spacing.md}px ${spacing.xxl}px`, border: 'none', borderRadius: radii.md,
                background: loading ? colors.textQuaternary : colors.red, color: colors.textInverse,
                cursor: loading ? 'not-allowed' : 'pointer', fontSize: fontSizes.body,
                fontWeight: fontWeights.medium, fontFamily: fonts.ui,
                transition: `background ${transitions.fast}`,
              }}>
              {loading ? 'Stopping...' : 'Stop Server'}
            </button>
          ) : (
            <button onClick={handleStart} disabled={loading}
              style={{
                padding: `${spacing.md}px ${spacing.xxl}px`, border: 'none', borderRadius: radii.md,
                background: loading ? colors.textQuaternary : colors.accent, color: colors.textInverse,
                cursor: loading ? 'not-allowed' : 'pointer', fontSize: fontSizes.body,
                fontWeight: fontWeights.medium, fontFamily: fonts.ui,
                transition: `background ${transitions.fast}`,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = colors.accentHover }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = colors.accent }}
            >
              {loading ? 'Starting...' : 'Start Server'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <div style={{ fontSize: fontSizes.label, fontWeight: fontWeights.medium, color: colors.textSecondary, marginBottom: spacing.xxs, fontFamily: fonts.ui }}>{label}</div>
      {children}
    </div>
  )
}
