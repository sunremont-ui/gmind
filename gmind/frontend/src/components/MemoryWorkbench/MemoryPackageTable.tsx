// Таблица корпусов памяти — одновременно «datasheet», пикер и редактор.
//
// В строке видно, каким силуэтом вид памяти выглядит на холсте и чем он
// оформлен. Пользователь может добавить свой корпус или переопределить
// встроенный: визуальный язык расширяется без правки кода.
import { useState } from 'react'
import {
  BUILTIN_PACKAGES,
  allPackages,
  isBuiltinKind,
  isOverridden,
  validatePackage,
  roleStyle,
  type MemoryPackage,
  type PackageFill,
  type PackageOutline,
} from '../../renderer/memoryPackages'
import { NODE_SHAPES, shapePath } from '../../renderer/shapes'
import { KARP_LAYERS, type KarpLayer } from '../MindMap/memoryKinds'
import { useMemoryPackagesStore } from '../../store/memoryPackages'
import { useMindMapStore } from '../../store/mindmap'
import { api } from '../../api/client'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, transitions } from '../../styles/tokens'

const OUTLINE_LABEL: Record<PackageOutline, string> = {
  solid: 'сплошная',
  dashed: 'пунктир',
  double: 'двойная',
}

const FILL_LABEL: Record<PackageFill, string> = {
  ghost: 'прозрачная',
  tint: 'лёгкая',
  solid: 'плотная',
}

const SHAPE_IDS = NODE_SHAPES.map(s => s.id)

interface Props {
  workbookId?: string | null
}

export function MemoryPackageTable({ workbookId }: Props) {
  // Подписываемся на custom, чтобы таблица перерисовывалась после правок.
  const custom = useMemoryPackagesStore(s => s.custom)
  const savePackage = useMemoryPackagesStore(s => s.savePackage)
  const removePackage = useMemoryPackagesStore(s => s.removePackage)

  const selectedTopicId = useMindMapStore(s => s.selectedTopicId)
  const updateTopicInTree = useMindMapStore(s => s.updateTopicInTree)

  const [editing, setEditing] = useState<MemoryPackage | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const packages = allPackages()
  void custom // список пересобирается из реестра, но реагируем на изменения стора

  const applyKind = async (kind: string) => {
    if (!selectedTopicId) return
    updateTopicInTree(selectedTopicId, { memory_kind: kind })
    setNotice(`Вид «${kind}» применён к выделенному узлу`)
    if (!workbookId) return
    try {
      await api.updateTopic(workbookId, selectedTopicId, { memory_kind: kind })
    } catch (err) {
      setNotice(`Не удалось сохранить вид узла: ${String(err)}`)
    }
  }

  const startNew = () => {
    setEditing({
      kind: '',
      label: '',
      code: '',
      shape: 'rounded',
      layer: 'semantic',
      color: '#5B6CFF',
      icon: '📦',
      outline: 'solid',
      fill: 'tint',
      hint: '',
    })
  }

  const layerRows = packages.filter(p => KARP_LAYERS.includes(p.kind as KarpLayer))
  const builtinKinds = new Set(BUILTIN_PACKAGES.map(p => p.kind))
  const recordRows = packages.filter(p => !KARP_LAYERS.includes(p.kind as KarpLayer) && builtinKinds.has(p.kind))
  const ownRows = packages.filter(p => !builtinKinds.has(p.kind))

  return (
    <div style={{ padding: spacing.lg, fontFamily: fonts.ui }}>
      <p style={{ fontSize: fontSizes.caption, color: colors.textSecondary, margin: `0 0 ${spacing.md}px` }}>
        Корпус — узнаваемый силуэт узла, как у детали в электронике. Он задаёт
        оформление по умолчанию; любая ручная настройка узла его перекрывает.
        {selectedTopicId
          ? ' Клик по строке применяет вид памяти к выделенному узлу.'
          : ' Выделите узел на холсте, чтобы применять виды кликом.'}
      </p>

      <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md }}>
        <button onClick={startNew} style={primaryBtn}>+ Добавить корпус</button>
        {custom.length > 0 && (
          <span style={{ fontSize: 10, color: colors.textTertiary, alignSelf: 'center' }}>
            своих корпусов: {custom.length}
          </span>
        )}
      </div>

      {editing && (
        <PackageEditor
          draft={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={pkg => {
            const err = validatePackage(pkg, SHAPE_IDS)
            if (err) {
              setNotice(err)
              return
            }
            savePackage(pkg)
            setEditing(null)
            setNotice(`Корпус «${pkg.label}» сохранён`)
          }}
        />
      )}

      {notice && (
        <div style={{
          margin: `${spacing.sm}px 0`,
          fontSize: fontSizes.caption,
          color: colors.textSecondary,
        }}>
          {notice}
        </div>
      )}

      {ownRows.length > 0 && (
        <>
          <Section title="Свои корпуса" />
          <Table rows={ownRows} onPick={applyKind} pickable={!!selectedTopicId}
            onEdit={setEditing} onRemove={removePackage} />
        </>
      )}

      <Section title="Слои памяти (модель karp)" />
      <Table rows={layerRows} onPick={applyKind} pickable={!!selectedTopicId}
        onEdit={setEditing} onRemove={removePackage} />

      <Section title="Типы записей MASys" />
      <Table rows={recordRows} onPick={applyKind} pickable={!!selectedTopicId}
        onEdit={setEditing} onRemove={removePackage} />

      <Section title="Роль узла в дереве" />
      <RoleLegend />
    </div>
  )
}

function Section({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
      color: colors.textTertiary, margin: `${spacing.lg}px 0 ${spacing.sm}px`,
    }}>
      {title}
    </div>
  )
}

interface TableProps {
  rows: MemoryPackage[]
  onPick: (kind: string) => void
  pickable: boolean
  onEdit: (pkg: MemoryPackage) => void
  onRemove: (kind: string) => void
}

function Table({ rows, onPick, pickable, onEdit, onRemove }: TableProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rows.map(p => {
        const overridden = isOverridden(p.kind)
        const own = !isBuiltinKind(p.kind)
        return (
          <div
            key={p.kind}
            style={{
              display: 'grid',
              gridTemplateColumns: '76px 56px 1fr auto',
              alignItems: 'center',
              gap: spacing.sm,
              padding: `${spacing.xs}px ${spacing.sm}px`,
              border: `1px solid ${overridden || own ? p.color + '66' : colors.separator}`,
              borderRadius: radii.sm,
            }}
          >
            <PackageThumb pkg={p} />
            <code style={{
              fontSize: 10, fontFamily: fonts.mono,
              color: p.color, fontWeight: fontWeights.semibold,
            }}>
              {p.code}
            </code>
            <button
              type="button"
              onClick={() => onPick(p.kind)}
              disabled={!pickable}
              title={p.hint || 'Применить к выделенному узлу'}
              style={{
                background: 'none', border: 'none', padding: 0, textAlign: 'left',
                cursor: pickable ? 'pointer' : 'default', minWidth: 0,
                fontFamily: fonts.ui, transition: transitions.fast,
              }}
            >
              <span style={{ fontSize: fontSizes.caption, color: colors.text }}>
                {p.icon} {p.label}
                {own && <Tag color={p.color}>свой</Tag>}
                {overridden && <Tag color={p.color}>изменён</Tag>}
              </span>
              <span style={{ display: 'block', fontSize: 10, color: colors.textTertiary }}>
                {p.kind} · {p.shape} · {OUTLINE_LABEL[p.outline]} · {FILL_LABEL[p.fill]} · слой {p.layer}
              </span>
              {p.hint && (
                <span style={{ display: 'block', fontSize: 10, color: colors.textQuaternary, marginTop: 1 }}>
                  {p.hint}
                </span>
              )}
            </button>
            <span style={{ display: 'flex', gap: 2 }}>
              <button onClick={() => onEdit({ ...p })} style={miniBtn} title="Править корпус">✎</button>
              {(own || overridden) && (
                <button
                  onClick={() => onRemove(p.kind)}
                  style={miniBtn}
                  title={own ? 'Удалить свой корпус' : 'Вернуть встроенный корпус'}
                >
                  {own ? '🗑' : '↺'}
                </button>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      marginLeft: spacing.xs, padding: '0 4px', borderRadius: 3,
      fontSize: 9, background: color + '22', color,
    }}>
      {children}
    </span>
  )
}

/** Миниатюра корпуса — тем же контуром и оформлением, что и настоящий узел. */
function PackageThumb({ pkg }: { pkg: MemoryPackage }) {
  const w = 62
  const h = 26
  const alpha = pkg.fill === 'solid' ? '3d' : pkg.fill === 'tint' ? '24' : '14'
  return (
    <svg width={w + 8} height={h + 10} viewBox={`-4 -5 ${w + 8} ${h + 10}`} aria-hidden>
      {pkg.outline === 'double' && (
        <path
          d={shapePath(pkg.shape, w, h, 6)}
          fill="none" stroke={pkg.color} strokeWidth={0.8} opacity={0.5}
          transform={`translate(${w / 2} ${h / 2}) scale(1.1) translate(${-w / 2} ${-h / 2})`}
        />
      )}
      <path
        d={shapePath(pkg.shape, w, h, 6)}
        fill={pkg.color + alpha}
        stroke={pkg.color}
        strokeWidth={1.2}
        strokeDasharray={pkg.outline === 'dashed' ? '4 2.5' : undefined}
      />
    </svg>
  )
}

interface EditorProps {
  draft: MemoryPackage
  onChange: (p: MemoryPackage) => void
  onSave: (p: MemoryPackage) => void
  onCancel: () => void
}

function PackageEditor({ draft, onChange, onSave, onCancel }: EditorProps) {
  const set = <K extends keyof MemoryPackage>(key: K, value: MemoryPackage[K]) =>
    onChange({ ...draft, [key]: value })

  const locked = isBuiltinKind(draft.kind)

  return (
    <div style={{
      padding: spacing.md,
      border: `1px solid ${colors.accent}55`,
      borderRadius: radii.md,
      background: colors.bgSecondary,
      display: 'flex', flexDirection: 'column', gap: spacing.sm,
      marginBottom: spacing.md,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
        <PackageThumb pkg={draft} />
        <span style={{ fontSize: fontSizes.caption, fontWeight: fontWeights.semibold, color: colors.text }}>
          {locked ? `Переопределение встроенного вида «${draft.kind}»` : 'Новый корпус'}
        </span>
      </div>

      <Row>
        <Field label="Ключ (kind)">
          <input value={draft.kind} onChange={e => set('kind', e.target.value)}
            disabled={locked} placeholder="my_kind" style={input} />
        </Field>
        <Field label="Название">
          <input value={draft.label} onChange={e => set('label', e.target.value)}
            placeholder="Мой вид" style={input} />
        </Field>
        <Field label="Маркировка">
          <input value={draft.code} onChange={e => set('code', e.target.value)}
            placeholder="MY" style={input} />
        </Field>
      </Row>

      <Row>
        <Field label="Форма">
          <select value={draft.shape} onChange={e => set('shape', e.target.value)} style={input}>
            {NODE_SHAPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Обводка">
          <select value={draft.outline} onChange={e => set('outline', e.target.value as PackageOutline)} style={input}>
            {(['solid', 'dashed', 'double'] as PackageOutline[]).map(o =>
              <option key={o} value={o}>{OUTLINE_LABEL[o]}</option>)}
          </select>
        </Field>
        <Field label="Заливка">
          <select value={draft.fill} onChange={e => set('fill', e.target.value as PackageFill)} style={input}>
            {(['ghost', 'tint', 'solid'] as PackageFill[]).map(f =>
              <option key={f} value={f}>{FILL_LABEL[f]}</option>)}
          </select>
        </Field>
      </Row>

      <Row>
        <Field label="Цвет">
          <input type="color" value={draft.color} onChange={e => set('color', e.target.value)}
            style={{ ...input, padding: 0, height: 26 }} />
        </Field>
        <Field label="Иконка">
          <input value={draft.icon} onChange={e => set('icon', e.target.value)}
            maxLength={4} style={input} />
        </Field>
        <Field label="Слой">
          <select value={draft.layer} onChange={e => set('layer', e.target.value as KarpLayer)} style={input}>
            {KARP_LAYERS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
      </Row>

      <Field label="Где применяется">
        <input value={draft.hint} onChange={e => set('hint', e.target.value)}
          placeholder="Короткая подсказка для таблицы" style={input} />
      </Field>

      <div style={{ display: 'flex', gap: spacing.sm }}>
        <button onClick={() => onSave(draft)} style={primaryBtn}>Сохранить</button>
        <button onClick={onCancel} style={ghostBtn}>Отмена</button>
      </div>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.sm }}>{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 9, color: colors.textTertiary, marginBottom: 2 }}>{label}</span>
      {children}
    </label>
  )
}

/** Легенда роли: сколько выводов у листа, ветвления и хаба. */
function RoleLegend() {
  const roles: Array<{ role: 'leaf' | 'branch' | 'hub'; label: string; pins: number; hint: string }> = [
    { role: 'leaf', label: 'Лист', pins: 0, hint: 'Узел без детей — выводов нет.' },
    { role: 'branch', label: 'Ветвление', pins: 2, hint: 'Есть дети: короткие выводы со сторон, куда уходят ветки.' },
    { role: 'hub', label: 'Хаб', pins: 4, hint: 'Корень или ≥5 детей: выводы длиннее, обводка крепче.' },
  ]
  const w = 62
  const h = 26

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {roles.map(r => {
        const rs = roleStyle(r.role)
        return (
          <div key={r.role} title={r.hint} style={{
            display: 'grid', gridTemplateColumns: '76px 1fr', alignItems: 'center',
            gap: spacing.sm, padding: `${spacing.xs}px ${spacing.sm}px`,
            border: `1px solid ${colors.separator}`, borderRadius: radii.sm,
          }}>
            <svg width={w + 20} height={h + 16} viewBox={`-10 -8 ${w + 20} ${h + 16}`} aria-hidden>
              <path d={shapePath('rounded', w, h, 6)} fill="transparent"
                stroke={colors.textTertiary} strokeWidth={1.2 * rs.strokeScale} />
              {rs.pins && Array.from({ length: r.pins }).map((_, i) => {
                const y = (h * (i + 1)) / (r.pins + 1)
                return (
                  <line key={i} x1={w} y1={y} x2={w + rs.pinLength} y2={y}
                    stroke={colors.textTertiary} strokeWidth={1.2} strokeLinecap="round" opacity={0.75} />
                )
              })}
            </svg>
            <span>
              <span style={{ fontSize: fontSizes.caption, color: colors.text }}>{r.label}</span>
              <span style={{ display: 'block', fontSize: 10, color: colors.textTertiary }}>{r.hint}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: `${spacing.xxs}px ${spacing.sm}px`,
  border: `1px solid ${colors.separator}`, borderRadius: radii.sm,
  background: colors.bgTertiary, color: colors.text,
  fontSize: fontSizes.caption, fontFamily: fonts.ui, outline: 'none',
}

const primaryBtn: React.CSSProperties = {
  padding: `${spacing.xs}px ${spacing.md}px`,
  border: 'none', borderRadius: radii.sm,
  background: colors.accent, color: colors.white,
  fontSize: fontSizes.caption, fontFamily: fonts.ui, cursor: 'pointer',
}

const ghostBtn: React.CSSProperties = {
  padding: `${spacing.xs}px ${spacing.md}px`,
  border: `1px solid ${colors.separator}`, borderRadius: radii.sm,
  background: 'transparent', color: colors.textSecondary,
  fontSize: fontSizes.caption, fontFamily: fonts.ui, cursor: 'pointer',
}

const miniBtn: React.CSSProperties = {
  width: 22, height: 22,
  border: `1px solid ${colors.separator}`, borderRadius: radii.sm,
  background: 'transparent', color: colors.textSecondary,
  fontSize: 11, cursor: 'pointer', lineHeight: 1,
}
