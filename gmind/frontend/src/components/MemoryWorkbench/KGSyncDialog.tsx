// V6.0 Phase 3 — KG Sync dialog.
// User selects namespace + workbook title, kicks off /api/v1/masys/kg-sync.
// After sync: shows summary (topics created, relationships created) and link
// to switch to the new workbook in the Mindmap view.
import { useEffect, useState } from 'react'
import { masysApi } from '../../api/masys'
import { useMASysMemoryStore } from '../../store/masysMemory'
import { useMindMapStore } from '../../store/mindmap'
import { useShellStore } from '../../store/shell'
import { api } from '../../api/client'
import type { KGSyncResponse } from '../../types/masys'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'

interface Props {
  onClose: () => void
}

export function KGSyncDialog({ onClose }: Props) {
  const activeNamespace = useMASysMemoryStore(s => s.activeNamespace)
  const namespaces = useMASysMemoryStore(s => s.namespaces)
  const [namespace, setNamespace] = useState(activeNamespace || 'default')
  const [title, setTitle] = useState(`MASys KG: ${activeNamespace || 'default'}`)
  const [limit, setLimit] = useState(200)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<KGSyncResponse | null>(null)
  const setActiveModule = useShellStore(s => s.setActiveModule)

  useEffect(() => {
    setTitle(`MASys KG: ${namespace}`)
  }, [namespace])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSync = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const resp = await masysApi.kgSync({
        namespace,
        workbook_title: title,
        limit: limit > 0 ? limit : undefined,
      })
      setResult(resp)
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  const openInMindmap = async () => {
    if (!result) return
    try {
      const wb = await api.getWorkbook(result.workbook_id)
      if (wb) {
        useMindMapStore.getState().setWorkbook(wb)
      }
      setActiveModule(null) // close memory workbench panel; mindmap canvas is the default view
      onClose()
    } catch (err) {
      console.error('open workbook in mindmap:', err)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: spacing.xl,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: colors.bgTertiary,
          borderRadius: radii.xl,
          boxShadow: shadows.lg,
          fontFamily: fonts.ui,
          padding: spacing.lg,
          display: 'flex', flexDirection: 'column', gap: spacing.md,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{
            fontSize: fontSizes.headline,
            fontWeight: fontWeights.semibold,
            color: colors.text,
          }}>🌐 Sync Knowledge Graph from MASys</div>
          <button onClick={onClose} style={closeBtn()}>✕</button>
        </div>

        <div style={{ fontSize: fontSizes.caption, color: colors.textSecondary, lineHeight: 1.5 }}>
          Импортирует <strong>entities</strong> и <strong>relations</strong> из MASys в новый Gmind workbook.
          Каждая entity → topic; каждое отношение → V5.0 relationship (с авто-маппингом predicate → type).
        </div>

        {!result && (
          <>
            <label style={fieldStyle()}>
              <span style={labelStyle()}>Namespace</span>
              <select
                value={namespace}
                onChange={e => setNamespace(e.target.value)}
                style={inputStyle()}
              >
                <option value="default">default</option>
                {namespaces.filter(n => n !== 'default').map(n =>
                  <option key={n} value={n}>{n}</option>
                )}
              </select>
            </label>

            <label style={fieldStyle()}>
              <span style={labelStyle()}>Workbook title</span>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={inputStyle()}
              />
            </label>

            <label style={fieldStyle()}>
              <span style={labelStyle()}>Max nodes (limit)</span>
              <input
                type="number"
                value={limit}
                min={1} max={1000}
                onChange={e => setLimit(parseInt(e.target.value) || 200)}
                style={inputStyle()}
              />
            </label>

            {error && (
              <div style={{
                padding: spacing.sm,
                background: '#fee2e2',
                color: colors.red,
                borderRadius: radii.sm,
                fontSize: fontSizes.caption,
              }}>✗ {error}</div>
            )}

            <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.xs }}>
              <button onClick={onClose} style={btnStyle()}>Отмена</button>
              <button onClick={handleSync} disabled={busy} style={btnStyle(true)}>
                {busy ? 'Синхронизация…' : 'Синхронизировать'}
              </button>
            </div>
          </>
        )}

        {result && (
          <div style={{
            padding: spacing.md,
            background: colors.bgTertiary,
            boxShadow: shadows.neuInsetSm,
            borderRadius: radii.md,
            display: 'flex', flexDirection: 'column', gap: spacing.xs,
          }}>
            <div style={{ color: colors.green, fontWeight: fontWeights.semibold }}>
              ✓ Sync complete
            </div>
            <div style={{ fontSize: fontSizes.caption, color: colors.textSecondary }}>
              <div>📍 Workbook: <code style={{fontSize:10}}>{result.workbook_id.slice(0,12)}…</code></div>
              <div>➕ Топиков создано: <strong>{result.topics_created}</strong> / {result.nodes_total}</div>
              <div>🔗 Связей создано: <strong>{result.relationships_created}</strong> / {result.edges_total}</div>
            </div>
            <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
              <button onClick={() => setResult(null)} style={btnStyle()}>Ещё одну?</button>
              <button onClick={openInMindmap} style={btnStyle(true)}>📖 Открыть в Mindmap</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function closeBtn(): React.CSSProperties {
  return {
    background: 'none', border: 'none', cursor: 'pointer',
    color: colors.textQuaternary, fontSize: fontSizes.body, padding: 4,
  }
}

function fieldStyle(): React.CSSProperties {
  return { display: 'flex', flexDirection: 'column', gap: spacing.xs }
}

function labelStyle(): React.CSSProperties {
  return { fontSize: fontSizes.caption, color: colors.textSecondary }
}

function inputStyle(): React.CSSProperties {
  return {
    padding: `${spacing.xs}px ${spacing.sm}px`,
    background: colors.bgTertiary,
    boxShadow: shadows.neuInsetSm,
    border: 'none',
    borderRadius: radii.sm,
    color: colors.text,
    fontSize: fontSizes.label,
    fontFamily: fonts.ui,
  }
}

function btnStyle(primary = false): React.CSSProperties {
  return {
    flex: 1,
    padding: `${spacing.xs}px ${spacing.md}px`,
    background: primary ? colors.accent : colors.bgTertiary,
    color: primary ? '#fff' : colors.text,
    boxShadow: primary ? 'none' : shadows.neuSm,
    border: 'none',
    borderRadius: radii.sm,
    fontSize: fontSizes.label,
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.ui,
    cursor: 'pointer',
  }
}
