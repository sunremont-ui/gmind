// Работа с памятью MASys для выделенного узла холста.
//
// До этого мост был односторонним: память можно было смотреть и удалять записи,
// но ручная доработка на холсте в MASys не возвращалась. Здесь узел можно
// запомнить, отправить в граф знаний и поставить по нему задачу.
import { useEffect, useState } from 'react'
import { masysApi } from '../../api/masys'
import { useMASysMemoryStore } from '../../store/masysMemory'
import { useMindMapStore } from '../../store/mindmap'
import { useAgentStore } from '../../store/agent'
import { memoryPackage } from '../../renderer/memoryPackages'
import { colors, fonts, fontSizes, fontWeights, spacing, radii } from '../../styles/tokens'

interface Props {
  workbookId: string | null
}

export function NodeMemoryActions({ workbookId }: Props) {
  const selectedTopicId = useMindMapStore(s => s.selectedTopicId)
  const selectedTopicIds = useMindMapStore(s => s.selectedTopicIds)
  const getTopic = useMindMapStore(s => s.getTopic)
  const activeNamespace = useMASysMemoryStore(s => s.activeNamespace)
  const health = useMASysMemoryStore(s => s.health)
  const refreshAll = useMASysMemoryStore(s => s.refreshAll)

  const masysPipelines = useAgentStore(s => s.masysPipelines)
  const fetchMasysPipelines = useAgentStore(s => s.fetchMasysPipelines)

  const [busy, setBusy] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [pipelineId, setPipelineId] = useState('')

  useEffect(() => {
    if (health?.reachable) fetchMasysPipelines()
  }, [health?.reachable, fetchMasysPipelines])

  const topic = selectedTopicId ? getTopic(selectedTopicId) : null
  const reachable = !!health?.reachable
  const note = (s: string) => setLog(prev => [s, ...prev].slice(0, 6))

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    try {
      await fn()
    } catch (err: unknown) {
      note(`✗ ${label}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(null)
    }
  }

  const remember = () => run('remember', async () => {
    if (!topic) return
    const content = [topic.title, topic.body, topic.notes].filter(Boolean).join('\n\n')
    await masysApi.remember({
      content,
      title: topic.title,
      namespace: activeNamespace,
      tags: ['gmind', ...(topic.labels ?? [])],
      source: 'gmind-canvas',
    })
    note(`✓ Запомнено: «${topic.title}»`)
    await refreshAll()
  })

  const pushEntity = () => run('entity', async () => {
    if (!topic) return
    const kind = topic.memory_kind || 'concept'
    await masysApi.upsertEntity({
      name: topic.title,
      type: kind,
      namespace: activeNamespace,
      description: [topic.body, topic.notes].filter(Boolean).join('\n\n'),
      attributes: { gmind_memory_kind: kind, gmind_topic_id: topic.id },
    })
    note(`✓ В графе знаний: «${topic.title}»`)
    await refreshAll()
  })

  const logEpisode = () => run('episode', async () => {
    if (!topic) return
    await masysApi.logEpisode({
      action: `Ручная правка на холсте: ${topic.title}`,
      namespace: activeNamespace,
      status: 'success',
      tags: ['gmind', 'canvas'],
      input: { topic_id: topic.id, kind: topic.memory_kind || null },
      output: { title: topic.title, body: topic.body ?? '' },
    })
    note(`✓ Эпизод записан: «${topic.title}»`)
    await refreshAll()
  })

  const pushSelection = () => run('push', async () => {
    if (!workbookId) return
    const ids = selectedTopicIds?.length ? selectedTopicIds : (selectedTopicId ? [selectedTopicId] : [])
    const res = await masysApi.push({
      workbook_id: workbookId,
      namespace: activeNamespace,
      topic_ids: ids.length ? ids : undefined,
    })
    note(`✓ Отправлено: сущностей ${res.entities_pushed}, связей ${res.relations_pushed}` +
      (res.skipped ? `, пропущено без вида памяти ${res.skipped}` : ''))
    for (const e of res.errors ?? []) note(`✗ ${e}`)
    await refreshAll()
  })

  const startTask = () => run('task', async () => {
    if (!pipelineId) return
    const res = await masysApi.startRun({
      pipeline_id: pipelineId,
      inputs: topic ? { text: [topic.title, topic.body].filter(Boolean).join('\n\n') } : undefined,
      workbook_id: workbookId ?? undefined,
      topic_id: selectedTopicId ?? undefined,
    })
    note(`✓ Задача поставлена: run ${res.runId ?? '—'}`)
  })

  return (
    <div style={{ padding: spacing.lg, fontFamily: fonts.ui }}>
      <p style={{ fontSize: fontSizes.caption, color: colors.textSecondary, margin: `0 0 ${spacing.md}px` }}>
        Холст остаётся холстом — здесь то, что связывает его с памятью MASys.
        Ручная доработка узла возвращается в память, а не остаётся только в Gmind.
      </p>

      {!reachable && (
        <div style={{ fontSize: fontSizes.caption, color: colors.red, marginBottom: spacing.md }}>
          MASys недоступен — запись невозможна. Проверьте связь в панели MASys.
        </div>
      )}

      <Block title="Выделенный узел">
        {topic ? (
          <div style={{ fontSize: fontSizes.caption, color: colors.text }}>
            {topic.title}
            {(() => {
              const pkg = memoryPackage(topic.memory_kind)
              return pkg
                ? <code style={{ marginLeft: spacing.sm, fontSize: 10, color: pkg.color }}>{pkg.code}</code>
                : <span style={{ marginLeft: spacing.sm, fontSize: 10, color: colors.textTertiary }}>
                    без вида памяти
                  </span>
            })()}
            {topic.masys_run_id && (
              <span style={{ display: 'block', fontSize: 10, color: colors.textTertiary }}>
                задача: {topic.masys_run_id}
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: fontSizes.caption, color: colors.textTertiary }}>
            Выделите узел на холсте
          </span>
        )}
      </Block>

      <Block title="Записать в память">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
          <button onClick={remember} disabled={!topic || !reachable || !!busy} style={btn}>
            {busy === 'remember' ? '…' : '🧠 Запомнить'}
          </button>
          <button onClick={pushEntity} disabled={!topic || !reachable || !!busy} style={btn}>
            {busy === 'entity' ? '…' : '🕸 В граф знаний'}
          </button>
          <button onClick={logEpisode} disabled={!topic || !reachable || !!busy} style={btn}>
            {busy === 'episode' ? '…' : '⏱ Записать эпизод'}
          </button>
        </div>
        <div style={hintStyle}>
          «Запомнить» отдаёт текст контроллеру памяти — он сам выберет слой.
          «В граф знаний» создаёт сущность по виду памяти узла.
        </div>
      </Block>

      <Block title="Отправить выделение в граф">
        <button onClick={pushSelection} disabled={!workbookId || !reachable || !!busy} style={primaryBtn}>
          {busy === 'push' ? 'Отправка…' : '⇪ Отправить узлы и связи'}
        </button>
        <div style={hintStyle}>
          Уходят только узлы с видом памяти и связи между ними. Идентичность — по
          привязке (masys_ref), поэтому повторная отправка не плодит дубли.
        </div>
      </Block>

      <Block title="Поставить задачу">
        <div style={{ display: 'flex', gap: spacing.sm }}>
          <select
            value={pipelineId}
            onChange={e => setPipelineId(e.target.value)}
            disabled={!reachable}
            style={{ ...input, flex: 1 }}
          >
            <option value="">— пайплайн MASys —</option>
            {(masysPipelines ?? []).map((p: { id: string; name?: string }) => (
              <option key={p.id} value={p.id}>{p.name ?? p.id}</option>
            ))}
          </select>
          <button onClick={startTask} disabled={!pipelineId || !reachable || !!busy} style={primaryBtn}>
            {busy === 'task' ? '…' : '▶ Запустить'}
          </button>
        </div>
        <div style={hintStyle}>
          Текст узла уходит на вход пайплайна, id прогона сохраняется на узле —
          карта помнит, где была поставлена работа.
        </div>
      </Block>

      {log.length > 0 && (
        <Block title="Журнал">
          {log.map((l, i) => (
            <div key={i} style={{
              fontSize: 10,
              color: l.startsWith('✗') ? colors.red : colors.textSecondary,
              wordBreak: 'break-word',
            }}>
              {l}
            </div>
          ))}
        </Block>
      )}
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: spacing.lg }}>
      <div style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
        color: colors.textTertiary, marginBottom: spacing.xs,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

const hintStyle: React.CSSProperties = {
  fontSize: 10,
  color: colors.textQuaternary,
  marginTop: spacing.xs,
  lineHeight: 1.4,
}

const btn: React.CSSProperties = {
  padding: `${spacing.xs}px ${spacing.md}px`,
  border: `1px solid ${colors.separator}`,
  borderRadius: radii.sm,
  background: 'transparent',
  color: colors.textSecondary,
  fontSize: fontSizes.caption,
  fontFamily: fonts.ui,
  cursor: 'pointer',
}

const primaryBtn: React.CSSProperties = {
  padding: `${spacing.xs}px ${spacing.md}px`,
  border: 'none',
  borderRadius: radii.sm,
  background: colors.accent,
  color: colors.white,
  fontSize: fontSizes.caption,
  fontWeight: fontWeights.medium,
  fontFamily: fonts.ui,
  cursor: 'pointer',
}

const input: React.CSSProperties = {
  padding: `${spacing.xs}px ${spacing.sm}px`,
  border: `1px solid ${colors.separator}`,
  borderRadius: radii.sm,
  background: colors.bgTertiary,
  color: colors.text,
  fontSize: fontSizes.caption,
  fontFamily: fonts.ui,
  outline: 'none',
  minWidth: 0,
}
