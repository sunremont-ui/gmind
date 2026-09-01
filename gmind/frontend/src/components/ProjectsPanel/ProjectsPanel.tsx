// Панель «Проекты»: указать каталог проекта — получить его схему картой.
// Путь можно ввести руками, выбрать из недавних или дойти кликами по папкам
// (диалога выбора каталога в вебе нет). Перед импортом показывается сводка:
// сколько будет папок, файлов и сколько внутри .md/.xmind.
import { useState, useEffect, useCallback } from 'react'
import {
  projectsApi, recentProjects, rememberProject, forgetProject,
  type ProjectDirEntry, type ProjectScanResult,
} from '../../api/projects'
import { useMindMapStore } from '../../store/mindmap'
import { requestWorkbookOpen } from '../../utils/openTopicLink'
import type { ModulePanelProps } from '../../modules/types'
import { LumenX, LumenChevronLeft, LumenFolder, LumenSearch, LumenPlus } from '../UI/LumenIcon'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, transitions } from '../../styles/tokens'

export function ProjectsPanel({ onClose }: ModulePanelProps) {
  const setWorkbook = useMindMapStore(s => s.setWorkbook)

  const [path, setPath] = useState('')
  const [browseDir, setBrowseDir] = useState('')
  const [parentDir, setParentDir] = useState('')
  const [dirs, setDirs] = useState<ProjectDirEntry[]>([])
  const [recent, setRecent] = useState<string[]>(() => recentProjects())
  const [docsOnly, setDocsOnly] = useState(false)
  const [maxDepth, setMaxDepth] = useState(6)
  const [preview, setPreview] = useState<ProjectScanResult | null>(null)
  const [busy, setBusy] = useState<'scan' | 'import' | 'browse' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const browse = useCallback(async (target?: string) => {
    setBusy('browse')
    setError(null)
    try {
      const listing = await projectsApi.dirs(target)
      setBrowseDir(listing.path)
      setParentDir(listing.parent)
      setDirs(listing.dirs)
    } catch (err: unknown) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }, [])

  useEffect(() => { browse() }, [browse])

  const options = { docs_only: docsOnly, max_depth: maxDepth }

  const scan = async (target = path) => {
    const dir = target.trim()
    if (!dir) return
    setBusy('scan')
    setError(null)
    setStatus(null)
    try {
      const result = await projectsApi.scan(dir, options)
      setPreview(result)
      setPath(result.path)
    } catch (err: unknown) {
      setPreview(null)
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  const buildMap = async () => {
    const dir = path.trim()
    if (!dir) return
    setBusy('import')
    setError(null)
    try {
      const result = await projectsApi.import(dir, preview?.title, options)
      if (!requestWorkbookOpen(result.workbook, 'project-import', dir)) setWorkbook(result.workbook)
      setRecent(rememberProject(result.workbook.source_path || dir))
      setStatus(`Карта построена: ${result.stats.nodes} узлов`
        + (result.stats.truncated ? ' (схема усечена — увеличьте потолок или сузьте глубину)' : ''))
    } catch (err: unknown) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  const stats = preview?.stats

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>
          <LumenFolder size={16} color={colors.accent} /> Проекты
        </span>
        <button onClick={onClose} style={iconButtonStyle} title="Закрыть">
          <LumenX size={16} color={colors.textSecondary} />
        </button>
      </div>

      {/* Путь к проекту */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Каталог проекта</div>
        <div style={{ display: 'flex', gap: spacing.sm }}>
          <input
            value={path}
            onChange={e => setPath(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') scan() }}
            placeholder="D:\\мой-проект"
            aria-label="Путь к каталогу проекта"
            style={inputStyle}
          />
          <button onClick={() => scan()} disabled={!path.trim() || busy === 'scan'} style={ghostButtonStyle}>
            <LumenSearch size={13} color={colors.textSecondary} /> {busy === 'scan' ? '…' : 'Обзор'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center', marginTop: spacing.sm, flexWrap: 'wrap' }}>
          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={docsOnly} onChange={e => setDocsOnly(e.target.checked)} />
            только .md и .xmind
          </label>
          <label style={checkboxLabelStyle}>
            глубина
            <input
              type="number"
              min={1}
              max={12}
              value={maxDepth}
              onChange={e => setMaxDepth(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
              aria-label="Глубина обхода"
              style={{ ...inputStyle, width: 52, flex: 'none' }}
            />
          </label>
        </div>

        {stats && (
          <div style={statsStyle}>
            <b>{preview?.title}</b>
            <div>
              папок: {stats.dirs} · файлов: {stats.files} · узлов: {stats.nodes}
            </div>
            <div>
              .md: {stats.markdown} · .xmind: {stats.xmind}
              {stats.truncated && <span style={{ color: colors.orange }}> · схема усечена</span>}
            </div>
          </div>
        )}

        <button
          onClick={buildMap}
          disabled={!path.trim() || busy === 'import'}
          style={{ ...primaryButtonStyle, marginTop: spacing.sm }}
        >
          <LumenPlus size={13} color={colors.white} />
          {busy === 'import' ? 'Строю карту…' : 'Построить карту проекта'}
        </button>
      </div>

      {/* Недавние проекты */}
      {recent.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Недавние</div>
          {recent.map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
              <button onClick={() => { setPath(item); scan(item) }} style={rowButtonStyle} title={item}>
                {shortPath(item)}
              </button>
              <button
                onClick={() => setRecent(forgetProject(item))}
                style={iconButtonStyle}
                title="Убрать из списка"
                aria-label={`Убрать ${item} из недавних`}
              >
                <LumenX size={12} color={colors.textTertiary} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Навигация по каталогам */}
      <div style={{ ...sectionStyle, flex: 1, minHeight: 0, overflow: 'auto', borderBottom: 'none' }}>
        <div style={labelStyle}>Выбрать папку</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
          <button
            onClick={() => parentDir && browse(parentDir)}
            disabled={!parentDir}
            style={iconButtonStyle}
            title="На уровень выше"
            aria-label="На уровень выше"
          >
            <LumenChevronLeft size={14} color={colors.textSecondary} />
          </button>
          <span style={{ fontSize: 11, color: colors.textTertiary, wordBreak: 'break-all' }}>{browseDir || '…'}</span>
        </div>
        <button onClick={() => { setPath(browseDir); scan(browseDir) }} disabled={!browseDir} style={ghostButtonStyle}>
          Взять этот каталог
        </button>
        <div style={{ marginTop: spacing.sm }}>
          {dirs.length === 0 && <div style={mutedStyle}>Подпапок нет</div>}
          {dirs.map(d => (
            <button key={d.path} onClick={() => browse(d.path)} style={rowButtonStyle} title={d.path}>
              📁 {d.name}
            </button>
          ))}
        </div>
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

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Длинный путь в списке недавних: показываем хвост, он информативнее корня. */
function shortPath(path: string): string {
  if (path.length <= 34) return path
  return `…${path.slice(-33)}`
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

const titleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.sm,
  fontSize: fontSizes.body,
  fontWeight: fontWeights.semibold,
  color: colors.text,
}

const sectionStyle: React.CSSProperties = {
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
  padding: `${spacing.sm}px 0`,
}

const statsStyle: React.CSSProperties = {
  marginTop: spacing.sm,
  padding: spacing.sm,
  borderRadius: radii.sm,
  background: colors.bgSecondary,
  fontSize: fontSizes.caption,
  color: colors.textSecondary,
  lineHeight: 1.5,
  wordBreak: 'break-word',
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
  width: '100%',
  justifyContent: 'center',
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

const checkboxLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing.xs,
  fontSize: fontSizes.caption,
  color: colors.textSecondary,
}

const rowButtonStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: `${spacing.xs}px ${spacing.sm}px`,
  border: 'none',
  borderRadius: radii.sm,
  background: 'transparent',
  cursor: 'pointer',
  fontSize: fontSizes.caption,
  fontFamily: fonts.ui,
  color: colors.text,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
