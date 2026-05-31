// V6.0 Phase 2 — modal showing recent items for a karp layer.
import { useEffect } from 'react'
import { useMASysMemoryStore } from '../../store/masysMemory'
import type { KarpLayer } from './layerMapping'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'

interface Props {
  layerKey: KarpLayer
  onClose: () => void
}

const LAYER_TITLES: Record<KarpLayer, string> = {
  working: '💭 Working — Active conversations',
  episodic: '⏱ Episodic — Recent episodes',
  semantic: '📚 Semantic — Entities & Wiki',
  procedural: '⚡ Procedural — Skills',
  artifact: '📦 Artifact — Results store',
  meta: '🧠 Meta — Decisions & Pending',
}

export function LayerDrillDown({ layerKey, onClose }: Props) {
  const s = useMASysMemoryStore()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '80vh',
          background: colors.bgTertiary,
          borderRadius: radii.xl,
          boxShadow: shadows.lg,
          fontFamily: fonts.ui,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: `${spacing.md}px ${spacing.lg}px`,
        }}>
          <div style={{
            fontSize: fontSizes.headline,
            fontWeight: fontWeights.semibold,
            color: colors.text,
          }}>{LAYER_TITLES[layerKey]}</div>
          <button onClick={onClose} style={btnClose()}>✕</button>
        </div>
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: `0 ${spacing.lg}px ${spacing.lg}px`,
        }}>
          {layerKey === 'working' && <ListConversations data={s.conversations} />}
          {layerKey === 'episodic' && <ListEpisodes data={s.episodes} />}
          {layerKey === 'semantic' && <ListSemantic entities={s.entities} wiki={s.wiki} />}
          {layerKey === 'procedural' && <ListSkills data={s.skills} />}
          {layerKey === 'artifact' && <ListResults data={s.results} />}
          {layerKey === 'meta' && <ListMeta decisions={s.decisions} pending={s.pending} />}
        </div>
      </div>
    </div>
  )
}

function btnClose(): React.CSSProperties {
  return {
    background: 'none', border: 'none', cursor: 'pointer',
    color: colors.textQuaternary, fontSize: fontSizes.body, padding: 4,
  }
}

function rowStyle(): React.CSSProperties {
  return {
    padding: `${spacing.sm}px ${spacing.md}px`,
    background: colors.bgTertiary,
    boxShadow: shadows.neuInsetSm,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
    fontSize: fontSizes.caption,
    color: colors.textSecondary,
    fontFamily: fonts.ui,
  }
}

function Empty({ label }: { label: string }) {
  return (
    <div style={{
      padding: spacing.xl,
      textAlign: 'center',
      color: colors.textQuaternary,
      fontSize: fontSizes.label,
    }}>{label}</div>
  )
}

function ListEpisodes({ data }: { data: import('../../types/masys').MASysEpisode[] }) {
  if (data.length === 0) return <Empty label="Эпизодов нет" />
  return <div>
    {data.slice(0, 50).map(ep => (
      <div key={ep.id} style={rowStyle()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong style={{ color: colors.text }}>{ep.action}</strong>
          <span style={{ color: ep.status === 'error' ? colors.red : colors.green }}>
            {ep.status ?? 'ok'}
          </span>
        </div>
        <div style={{ fontSize: 10, marginTop: 2 }}>
          {ep.timestamp} · {ep.agentId ?? '—'} · {ep.tags?.join(', ') || ''}
        </div>
      </div>
    ))}
  </div>
}

function ListConversations({ data }: { data: import('../../types/masys').MASysConversation[] }) {
  if (data.length === 0) return <Empty label="Активных сессий нет" />
  return <div>
    {data.slice(0, 50).map(c => (
      <div key={c.sessionId} style={rowStyle()}>
        <strong style={{ color: colors.text }}>{c.sessionId.slice(0, 16)}</strong>
        <div style={{ fontSize: 10, marginTop: 2 }}>
          {c.algorithm ?? 'buffer'} · {c.messageCount ?? 0} msg
          {c.summary ? ` · compressed (${c.summaryTokens ?? '?'} t)` : ''}
        </div>
        {c.summary && (
          <div style={{ marginTop: 4, fontSize: 11, fontStyle: 'italic' }}>
            {c.summary.slice(0, 200)}{c.summary.length > 200 ? '…' : ''}
          </div>
        )}
      </div>
    ))}
  </div>
}

function ListSemantic({ entities, wiki }: {
  entities: import('../../types/masys').MASysMemoryEntity[]
  wiki: import('../../types/masys').MASysWikiPage[]
}) {
  if (entities.length === 0 && wiki.length === 0) return <Empty label="Нет фактов" />
  return <div>
    {entities.length > 0 && <>
      <h4 style={{ margin: `${spacing.sm}px 0`, fontSize: fontSizes.label, color: colors.text }}>Entities</h4>
      {entities.slice(0, 30).map(e => (
        <div key={e.id} style={rowStyle()}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong style={{ color: colors.text }}>{e.name}</strong>
            <span>{e.type}</span>
          </div>
          {e.description && <div style={{ marginTop: 2, fontSize: 11 }}>{e.description}</div>}
          <div style={{ fontSize: 10, marginTop: 2 }}>
            mentions: {e.mentions ?? 0} · last: {e.lastSeen ?? '—'}
          </div>
        </div>
      ))}
    </>}
    {wiki.length > 0 && <>
      <h4 style={{ margin: `${spacing.sm}px 0`, fontSize: fontSizes.label, color: colors.text }}>Wiki</h4>
      {wiki.slice(0, 20).map(w => (
        <div key={w.slug} style={rowStyle()}>
          <strong style={{ color: colors.text }}>{w.title}</strong>
          <div style={{ fontSize: 10 }}>{w.slug} · v{w.version ?? 1}</div>
        </div>
      ))}
    </>}
  </div>
}

function ListSkills({ data }: { data: import('../../types/masys').MASysSkill[] }) {
  if (data.length === 0) return <Empty label="Навыков нет" />
  return <div>
    {data.slice(0, 30).map(sk => {
      const rate = (sk.successRate ?? 0) * 100
      return (
        <div key={sk.id} style={rowStyle()}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong style={{ color: colors.text }}>{sk.name}</strong>
            <span style={{ color: rate > 70 ? colors.green : rate > 40 ? colors.orange : colors.red }}>
              {rate.toFixed(0)}%
            </span>
          </div>
          <div style={{ fontSize: 10, marginTop: 2 }}>
            {sk.trigger ?? '—'} · used {sk.usageCount ?? 0}× · success {sk.successCount ?? 0}
          </div>
        </div>
      )
    })}
  </div>
}

function ListResults({ data }: { data: import('../../types/masys').MASysResult[] }) {
  if (data.length === 0) return <Empty label="Артефактов нет" />
  return <div>
    {data.slice(0, 30).map(r => (
      <div key={r.id} style={rowStyle()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong style={{ color: colors.text }}>{r.name}</strong>
          <span>{r.type}</span>
        </div>
        <div style={{ fontSize: 10, marginTop: 2 }}>
          {r.namespace} · expires: {r.expiresAt ?? '∞'} · tags: {r.tags?.join(', ') || '—'}
        </div>
      </div>
    ))}
  </div>
}

function ListMeta({ decisions, pending }: {
  decisions: import('../../types/masys').MASysDecision[]
  pending: import('../../types/masys').MASysPendingWrite[]
}) {
  if (decisions.length === 0 && pending.length === 0) return <Empty label="Записей нет" />
  return <div>
    {decisions.length > 0 && <>
      <h4 style={{ margin: `${spacing.sm}px 0`, fontSize: fontSizes.label, color: colors.text }}>Recent decisions</h4>
      {decisions.slice(0, 20).map(d => (
        <div key={d.id} style={rowStyle()}>
          <strong style={{ color: colors.text }}>{d.op}</strong>
          <span style={{ marginLeft: 8 }}>{d.ts}</span>
        </div>
      ))}
    </>}
    {pending.length > 0 && <>
      <h4 style={{ margin: `${spacing.sm}px 0`, fontSize: fontSizes.label, color: colors.text }}>Pending queue</h4>
      {pending.slice(0, 20).map(p => (
        <div key={p.id} style={rowStyle()}>
          <strong style={{ color: colors.text }}>{p.type}</strong>
          <span style={{ marginLeft: 8 }}>{p.createdAt}</span>
          <div style={{ fontSize: 10, marginTop: 2 }}>
            {typeof p.value === 'string' ? p.value : JSON.stringify(p.value).slice(0, 120)}
          </div>
        </div>
      ))}
    </>}
  </div>
}
