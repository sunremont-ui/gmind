// Панель «Лаба»: как идёт работа в проектах, у которых есть трек.
//
// Вид один на уровень: портфель (все треки рядом) → трек (граф записей) →
// замеры проекта → матрица одного замера. Реестр правится здесь же.
import { useCallback, useEffect, useState } from 'react'
import { labApi } from '../../api/lab'
import type { LabProject } from '../../types/lab'
import type { ModulePanelProps } from '../../modules/types'
import { LabPortfolio } from './LabPortfolio'
import { LabTrackView } from './LabTrackView'
import { LabRunsView } from './LabRunsView'
import { LabProjectView } from './LabProjectView'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'

type View =
  | { mode: 'portfolio' }
  | { mode: 'project'; project: LabProject }
  | { mode: 'track'; project: LabProject }
  | { mode: 'runs'; project: LabProject }

export function LabPanel({ onClose }: ModulePanelProps) {
  const [projects, setProjects] = useState<LabProject[]>([])
  const [view, setView] = useState<View>({ mode: 'portfolio' })
  const [adding, setAdding] = useState(false)
  const [newPath, setNewPath] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setProjects(await labApi.projects())
      setError(null)
    } catch (e) {
      setError(String((e as Error).message ?? e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const addProject = async () => {
    const path = newPath.trim()
    if (!path) return
    try {
      setProjects(await labApi.addProject(path))
      setNewPath('')
      setAdding(false)
      setError(null)
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }

  const removeProject = async (p: LabProject) => {
    try {
      setProjects(await labApi.removeProject(p.path))
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }

  const title =
    view.mode === 'portfolio' ? 'Лаба · портфель'
    : view.mode === 'project' ? view.project.label
    : view.mode === 'track' ? `Трек ${view.project.track}`
    : `Замеры · ${view.project.label}`

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: colors.bgTertiary,
      boxShadow: shadows.lg,
      borderTopLeftRadius: radii.xl,
      borderBottomLeftRadius: radii.xl,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing.sm,
        padding: `${spacing.md}px ${spacing.lg}px`, flexShrink: 0,
      }}>
        {view.mode !== 'portfolio' && (
          <button
            onClick={() => setView(
              view.mode === 'project' ? { mode: 'portfolio' } : { mode: 'project', project: view.project }
            )}
            title={view.mode === 'project' ? 'К портфелю' : 'К проекту'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: colors.textSecondary, fontSize: fontSizes.body, padding: 0,
            }}
          >←</button>
        )}
        <div style={{
          fontSize: fontSizes.headline, fontWeight: fontWeights.semibold,
          color: colors.text, fontFamily: fonts.ui,
        }}>
          🧪 {title}
        </div>
        <span style={{ flex: 1 }} />
        {view.mode === 'portfolio' && (
          <button
            onClick={() => setAdding(v => !v)}
            title="Добавить проект в реестр"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: colors.textSecondary, fontSize: fontSizes.body,
            }}
          >＋</button>
        )}
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: colors.textQuaternary, fontSize: fontSizes.body,
          }}
        >✕</button>
      </div>

      {adding && view.mode === 'portfolio' && (
        <div style={{
          margin: `0 ${spacing.lg}px`, display: 'flex', gap: spacing.sm, alignItems: 'center',
        }}>
          <input
            value={newPath}
            onChange={e => setNewPath(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void addProject() }}
            placeholder="D:\ИмяПроекта — каталог с lab.config.json"
            style={{
              flex: 1,
              padding: `${spacing.xs}px ${spacing.sm}px`,
              background: colors.bgTertiary,
              boxShadow: shadows.neuInsetSm,
              border: 'none', borderRadius: radii.sm,
              color: colors.text, fontSize: fontSizes.label, fontFamily: fonts.ui,
            }}
          />
          <button
            onClick={() => void addProject()}
            style={{
              padding: `${spacing.xs}px ${spacing.md}px`,
              background: colors.bgTertiary, boxShadow: shadows.neuSm,
              border: 'none', borderRadius: radii.sm,
              color: colors.text, fontSize: fontSizes.caption,
              fontFamily: fonts.ui, cursor: 'pointer',
            }}
          >Добавить</button>
        </div>
      )}

      {error && (
        <div style={{
          margin: `${spacing.sm}px ${spacing.lg}px 0`,
          fontSize: fontSizes.caption, color: colors.red, fontFamily: fonts.ui,
        }}>{error}</div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && view.mode === 'portfolio' ? (
          <div style={{
            padding: spacing.lg, color: colors.textTertiary,
            fontSize: fontSizes.label, fontFamily: fonts.ui,
          }}>читаю реестр…</div>
        ) : view.mode === 'portfolio' ? (
          <LabPortfolio
            projects={projects}
            onOpenProject={p => setView({ mode: 'project', project: p })}
            onOpenTrack={p => setView({ mode: 'track', project: p })}
            onOpenRuns={p => setView({ mode: 'runs', project: p })}
            onRemove={p => void removeProject(p)}
          />
        ) : view.mode === 'project' ? (
          <LabProjectView
            project={view.project}
            onOpenTrack={() => setView({ mode: 'track', project: view.project })}
            onOpenRuns={() => setView({ mode: 'runs', project: view.project })}
          />
        ) : view.mode === 'track' ? (
          <LabTrackView project={view.project} />
        ) : (
          <LabRunsView project={view.project} />
        )}
      </div>
    </div>
  )
}
