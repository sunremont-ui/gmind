// Панель работы с Markdown-файлами: обзор хранилища, открытие .md как карты,
// сохранение карты обратно в связанный файл и перечитывание внешних правок.
import { useState, useEffect, useCallback } from 'react'
import { markdownApi, type MarkdownFileInfo } from '../../api/markdown'
import { useMindMapStore } from '../../store/mindmap'
import type { ModulePanelProps } from '../../modules/types'
import { LumenFileText, LumenX, LumenDownload, LumenUpload, LumenRedo, LumenChevronLeft } from '../UI/LumenIcon'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, transitions } from '../../styles/tokens'
import { requestWorkbookOpen } from '../../utils/openTopicLink'

export function MarkdownPanel({ workbookId, onClose }: ModulePanelProps) {
  const workbook = useMindMapStore(s => s.workbook)
  const setWorkbook = useMindMapStore(s => s.setWorkbook)

  const [dir, setDir] = useState<string>('')
  const [root, setRoot] = useState<string>('')
  const [files, setFiles] = useState<MarkdownFileInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [saveAs, setSaveAs] = useState('')

  const linkedPath = workbook?.source_path ?? ''

  const load = useCallback(async (target?: string) => {
    setLoading(true)
    setError(null)
    try {
      const listing = await markdownApi.listFiles(target)
      setDir(listing.dir)
      setRoot(listing.root)
      setFiles(listing.files)
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openFile = async (path: string) => {
    setBusy(path)
    setError(null)
    try {
      const wb = await markdownApi.openFile(path)
      if (!requestWorkbookOpen(wb, 'markdown', path)) setWorkbook(wb)
      setStatus(`Открыт ${path}`)
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setBusy(null)
    }
  }

  const save = async (explicitPath?: string) => {
    if (!workbookId) return
    setBusy('save')
    setError(null)
    try {
      const res = await markdownApi.save(workbookId, explicitPath)
      setStatus(`Сохранено: ${res.path} (${res.bytes} Б)`)
      setSaveAs('')
      if (workbook) setWorkbook({ ...workbook, source_path: res.path, source_synced_at: res.synced_at })
      await load(dir)
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setBusy(null)
    }
  }

  const reload = async () => {
    if (!workbookId) return
    setBusy('reload')
    setError(null)
    try {
      const wb = await markdownApi.reload(workbookId)
      setWorkbook(wb)
      setStatus('Карта перечитана из файла')
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setBusy(null)
    }
  }

  const importLocalFile = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown'
    input.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setBusy('import')
      try {
        const content = await file.text()
        const wb = await markdownApi.importContent(content, file.name.replace(/\.(md|markdown)$/i, ''))
        if (!requestWorkbookOpen(wb, 'markdown', wb.source_path)) setWorkbook(wb)
        setStatus(`Импортирован ${file.name}`)
      } catch (err: any) {
        setError(err?.message ?? String(err))
      } finally {
        setBusy(null)
      }
    }
    input.click()
  }

  const goUp = () => {
    const parent = dir.replace(/[\\/][^\\/]+$/, '')
    if (parent && parent !== dir) load(parent)
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, fontSize: fontSizes.body, fontWeight: fontWeights.semibold, color: colors.text }}>
          <LumenFileText size={16} color={colors.accent} /> Markdown
        </span>
        <button onClick={onClose} style={iconButtonStyle} title="Закрыть">
          <LumenX size={16} color={colors.textSecondary} />
        </button>
      </div>

      {/* Связанный файл текущей карты */}
      <div style={{ padding: `${spacing.md}px ${spacing.xl}px`, borderBottom: `1px solid ${colors.separator}` }}>
        <div style={labelStyle}>Файл текущей карты</div>
        <div style={{
          fontSize: fontSizes.caption, color: linkedPath ? colors.text : colors.textTertiary,
          wordBreak: 'break-all', marginBottom: spacing.sm,
        }}>
          {linkedPath || 'не связан — сохраните карту, чтобы создать .md'}
        </div>
        <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
          <button onClick={() => save()} disabled={!workbookId || busy === 'save'} style={primaryButtonStyle}>
            <LumenDownload size={13} color={colors.white} /> {busy === 'save' ? 'Сохранение…' : 'Сохранить в .md'}
          </button>
          <button onClick={reload} disabled={!linkedPath || busy === 'reload'} style={ghostButtonStyle}>
            <LumenRedo size={13} color={colors.textSecondary} /> Перечитать
          </button>
          <button onClick={importLocalFile} disabled={busy === 'import'} style={ghostButtonStyle}>
            <LumenUpload size={13} color={colors.textSecondary} /> Импорт файла
          </button>
        </div>
        <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
          <input
            value={saveAs}
            onChange={e => setSaveAs(e.target.value)}
            placeholder="Сохранить как… (имя.md или полный путь)"
            style={inputStyle}
          />
          <button onClick={() => save(saveAs.trim())} disabled={!saveAs.trim() || !workbookId} style={ghostButtonStyle}>
            OK
          </button>
        </div>
      </div>

      {/* Обзор хранилища */}
      <div style={{ padding: `${spacing.md}px ${spacing.xl}px 0`, flexShrink: 0 }}>
        <div style={labelStyle}>Хранилище</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
          <button onClick={goUp} disabled={dir === root} style={iconButtonStyle} title="На уровень выше">
            <LumenChevronLeft size={14} color={colors.textSecondary} />
          </button>
          <span style={{ fontSize: 11, color: colors.textTertiary, wordBreak: 'break-all' }}>{dir || '…'}</span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `0 ${spacing.xl}px ${spacing.xl}px` }}>
        {loading && <div style={mutedStyle}>Загрузка…</div>}
        {!loading && files.length === 0 && (
          <div style={mutedStyle}>Пусто. Сохраните карту — файл появится здесь.</div>
        )}
        {files.map(f => (
          <button
            key={f.path}
            onClick={() => (f.dir ? load(f.path) : openFile(f.path))}
            disabled={busy === f.path}
            style={{
              ...fileRowStyle,
              background: f.path === linkedPath ? colors.accentLight : 'transparent',
              fontWeight: f.path === linkedPath ? fontWeights.semibold : fontWeights.regular,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}>
              {f.dir
                ? <span style={{ color: colors.textTertiary }}>📁</span>
                : <LumenFileText size={14} color={colors.accent} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
            </span>
            {!f.dir && <span style={{ fontSize: 10, color: colors.textTertiary, flexShrink: 0 }}>{formatSize(f.size)}</span>}
          </button>
        ))}
      </div>

      {(status || error) && (
        <div style={{
          padding: `${spacing.sm}px ${spacing.xl}px`,
          borderTop: `1px solid ${colors.separator}`,
          fontSize: fontSizes.caption,
          color: error ? colors.red : colors.textSecondary,
          wordBreak: 'break-word',
        }}>
          {error ?? status}
        </div>
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

const panelStyle: React.CSSProperties = {
  width: 360,
  background: colors.bgTertiary,
  boxShadow: '-2px 0 24px rgba(15, 15, 25, 0.08), -1px 0 0 rgba(15,15,25,0.06)',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  fontFamily: fonts.ui,
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${spacing.md}px ${spacing.xl}px`,
  borderBottom: `1px solid ${colors.separator}`,
  flexShrink: 0,
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: colors.textTertiary,
  marginBottom: spacing.xs,
}

const mutedStyle: React.CSSProperties = {
  fontSize: fontSizes.caption,
  color: colors.textTertiary,
  padding: `${spacing.md}px 0`,
}

const iconButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: spacing.xs,
  borderRadius: radii.sm,
  display: 'flex',
  alignItems: 'center',
}

const baseButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing.xs,
  padding: `${spacing.xs}px ${spacing.md}px`,
  borderRadius: radii.md,
  fontSize: fontSizes.caption,
  fontFamily: fonts.ui,
  cursor: 'pointer',
  transition: transitions.fast,
}

const primaryButtonStyle: React.CSSProperties = {
  ...baseButton,
  background: colors.accent,
  color: colors.white,
  border: 'none',
}

const ghostButtonStyle: React.CSSProperties = {
  ...baseButton,
  background: 'transparent',
  color: colors.textSecondary,
  border: `1px solid ${colors.separator}`,
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: `${spacing.xs}px ${spacing.sm}px`,
  border: `1px solid ${colors.separator}`,
  borderRadius: radii.sm,
  fontSize: fontSizes.caption,
  fontFamily: fonts.ui,
  background: colors.bgSecondary,
  color: colors.text,
  outline: 'none',
}

const fileRowStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: spacing.sm,
  padding: `${spacing.sm}px ${spacing.md}px`,
  border: 'none',
  borderRadius: radii.sm,
  cursor: 'pointer',
  fontSize: fontSizes.caption,
  fontFamily: fonts.ui,
  color: colors.text,
  textAlign: 'left',
}
