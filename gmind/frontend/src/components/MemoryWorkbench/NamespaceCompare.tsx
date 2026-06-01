// V6.1 phase C — Cross-namespace comparison.
// Lets the user pick several MASys namespaces and compares their memory layer
// counts side by side, highlighting the leading namespace per layer.
import { useState } from 'react'
import { useMASysMemoryStore } from '../../store/masysMemory'
import { masysApi } from '../../api/masys'
import { buildComparison, type NsCounts } from './nsCompare'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows } from '../../styles/tokens'

async function fetchCounts(ns: string): Promise<NsCounts> {
  const safe = <T,>(p: Promise<T[]>) => p.then(a => (Array.isArray(a) ? a.length : 0)).catch(() => 0)
  const [episodes, entities, skills, conversations, wiki, results] = await Promise.all([
    safe(masysApi.listEpisodes(ns)),
    safe(masysApi.listEntities(ns)),
    safe(masysApi.listSkills(ns)),
    safe(masysApi.listConversations(ns)),
    safe(masysApi.listWiki(ns)),
    safe(masysApi.listResults(ns)),
  ])
  return { episodes, entities, skills, conversations, wiki, results }
}

export function NamespaceCompare() {
  const namespaces = useMASysMemoryStore(s => s.namespaces)
  const activeNamespace = useMASysMemoryStore(s => s.activeNamespace)

  const allNs = Array.from(new Set(['default', activeNamespace, ...namespaces]))
  const [selected, setSelected] = useState<string[]>([activeNamespace])
  const [data, setData] = useState<Record<string, NsCounts>>({})
  const [comparedNs, setComparedNs] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (ns: string) => {
    setSelected(prev => prev.includes(ns) ? prev.filter(n => n !== ns) : [...prev, ns])
  }

  const compare = async () => {
    if (selected.length === 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const entries = await Promise.all(selected.map(async ns => [ns, await fetchCounts(ns)] as const))
      setData(Object.fromEntries(entries))
      setComparedNs([...selected])
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  const comparison = comparedNs.length > 0 ? buildComparison(comparedNs, data) : null

  return (
    <div style={{ padding: spacing.lg, fontFamily: fonts.ui, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      {/* Namespace picker */}
      <div>
        <div style={{ fontSize: fontSizes.caption, color: colors.textSecondary, marginBottom: spacing.xs }}>
          Namespaces для сравнения:
        </div>
        <div style={{ display: 'flex', gap: spacing.xs, flexWrap: 'wrap' }}>
          {allNs.map(ns => {
            const on = selected.includes(ns)
            return (
              <button
                key={ns}
                onClick={() => toggle(ns)}
                style={{
                  padding: `${spacing.xxs}px ${spacing.sm}px`,
                  background: colors.bgTertiary,
                  boxShadow: on ? shadows.neuInsetSm : shadows.neuSm,
                  border: 'none', borderRadius: radii.sm,
                  color: on ? colors.accent : colors.text,
                  fontSize: fontSizes.caption, fontFamily: fonts.mono,
                  fontWeight: on ? fontWeights.semibold : fontWeights.regular,
                  cursor: 'pointer',
                }}
              >{on ? '✓ ' : ''}{ns}</button>
            )
          })}
        </div>
      </div>

      <button
        onClick={compare}
        disabled={selected.length === 0 || busy}
        style={{
          alignSelf: 'flex-start',
          padding: `${spacing.xs}px ${spacing.md}px`,
          background: selected.length === 0 ? colors.bgTertiary : colors.accent,
          color: selected.length === 0 ? colors.textQuaternary : '#fff',
          boxShadow: selected.length === 0 ? shadows.neuSm : 'none',
          border: 'none', borderRadius: radii.sm,
          fontSize: fontSizes.caption, fontWeight: fontWeights.medium, fontFamily: fonts.ui,
          cursor: selected.length === 0 || busy ? 'not-allowed' : 'pointer',
        }}
      >{busy ? 'Сравниваю…' : `Сравнить (${selected.length})`}</button>

      {error && <span style={{ fontSize: fontSizes.caption, color: '#ef4444' }}>✗ {error}</span>}

      {comparison && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: fontSizes.caption }}>
            <thead>
              <tr>
                <th style={cellHead('left')}>Layer</th>
                {comparedNs.map(ns => (
                  <th key={ns} style={cellHead('right')}>{ns}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map(row => (
                <tr key={row.key}>
                  <td style={cell('left', false)}>{row.label}</td>
                  {comparedNs.map(ns => {
                    const isLeader = row.leaders.includes(ns) && comparedNs.length > 1
                    return (
                      <td key={ns} style={cell('right', isLeader)}>{row.counts[ns]}</td>
                    )
                  })}
                </tr>
              ))}
              <tr>
                <td style={{ ...cell('left', false), fontWeight: fontWeights.bold, borderTop: `1px solid ${colors.separator}` }}>Σ total</td>
                {comparedNs.map(ns => (
                  <td key={ns} style={{ ...cell('right', false), fontWeight: fontWeights.bold, borderTop: `1px solid ${colors.separator}` }}>
                    {comparison.totals[ns]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function cellHead(align: 'left' | 'right'): React.CSSProperties {
  return {
    textAlign: align, padding: `${spacing.xs}px ${spacing.sm}px`,
    color: colors.textTertiary, fontWeight: fontWeights.semibold,
    fontFamily: fonts.mono, fontSize: 10, whiteSpace: 'nowrap',
    borderBottom: `1px solid ${colors.separator}`,
  }
}

function cell(align: 'left' | 'right', leader: boolean): React.CSSProperties {
  return {
    textAlign: align, padding: `${spacing.xs}px ${spacing.sm}px`,
    color: leader ? colors.accent : colors.text,
    fontWeight: leader ? fontWeights.bold : fontWeights.regular,
    fontFamily: align === 'right' ? fonts.mono : fonts.ui,
    background: leader ? `${colors.accent}14` : 'transparent',
    whiteSpace: 'nowrap',
  }
}
