// Таблица «корпусов» видов памяти.
//
// Аналогия из электроники: у резистора функция одна, а корпус может быть 0805
// или выводным — и опытный глаз узнаёт деталь по корпусу, не читая маркировку.
// Здесь так же: вид памяти (memory_kind) получает узнаваемый корпус — форму,
// тип обводки, насыщенность заливки и короткий код-маркировку.
//
// Корпус — это только **значение по умолчанию**. Любая явная настройка узла
// (shape, border_color, node_style) всегда главнее: свобода оформления за
// пользователем, корпус лишь подсказывает смысл.

import { MEMORY_KINDS, normalizeKind, type KarpLayer } from '../components/MindMap/memoryKinds'

/** Тип обводки корпуса — читается как «класс исполнения» детали. */
export type PackageOutline = 'solid' | 'dashed' | 'double'

/** Насыщенность заливки: от прозрачной (летучая память) к плотной (артефакт). */
export type PackageFill = 'ghost' | 'tint' | 'solid'

export interface MemoryPackage {
  /** Значение Topic.memory_kind. */
  kind: string
  /** Человеческое название. */
  label: string
  /** Маркировка на корпусе — как «DIP-8». */
  code: string
  /** id формы из renderer/shapes.ts. */
  shape: string
  /** Слой karp, к которому относится вид. */
  layer: KarpLayer
  /** Цвет акцента (из реестра видов памяти). */
  color: string
  icon: string
  outline: PackageOutline
  fill: PackageFill
  /** Где применяется — текст для таблицы-справочника. */
  hint: string
}

// Форма выбрана осмысленно, а не случайно: корпус должен читаться как смысл.
//
//   note          — лист с загнутым углом: черновик, живёт недолго
//   parallelogram — скос как движение: событие во времени
//   rounded       — спокойный базовый корпус: устойчивое знание
//   hexagon       — как гайка/деталь механизма: процедура, навык
//   rectangle     — коробка: готовый артефакт
//   ellipse       — «мысль»: рассуждение о себе
//   diamond       — ромб блок-схемы: решение, развилка
//   pill          — капсула-реплика: сообщение в диалоге
const RAW: Array<Omit<MemoryPackage, 'color' | 'icon' | 'layer'> & { layer: KarpLayer }> = [
  // ── 6 слоёв karp ──
  { kind: 'working', label: 'Working', code: 'WRK', shape: 'note', layer: 'working',
    outline: 'dashed', fill: 'ghost',
    hint: 'Рабочая память: черновики, текущий контекст. Живёт недолго — корпус пунктирный и прозрачный.' },
  { kind: 'episodic', label: 'Episodic', code: 'EPS', shape: 'parallelogram', layer: 'episodic',
    outline: 'solid', fill: 'tint',
    hint: 'Эпизоды: что произошло и когда. Скос корпуса читается как движение по времени.' },
  { kind: 'semantic', label: 'Semantic', code: 'SEM', shape: 'rounded', layer: 'semantic',
    outline: 'solid', fill: 'tint',
    hint: 'Устойчивое знание: факты, понятия, сущности. Базовый спокойный корпус.' },
  { kind: 'procedural', label: 'Procedural', code: 'PRC', shape: 'hexagon', layer: 'procedural',
    outline: 'solid', fill: 'tint',
    hint: 'Процедуры и навыки: как что-то делать. Корпус-гайка — деталь механизма.' },
  { kind: 'artifact', label: 'Artifact', code: 'ART', shape: 'rectangle', layer: 'artifact',
    outline: 'solid', fill: 'solid',
    hint: 'Артефакты: готовые результаты, файлы, выводы. Корпус-коробка, плотная заливка.' },
  { kind: 'meta', label: 'Meta', code: 'MET', shape: 'ellipse', layer: 'meta',
    outline: 'double', fill: 'tint',
    hint: 'Мета-память: рассуждение системы о себе. Двойная обводка — уровень над остальными.' },

  // ── тонкие типы записей MASys: наследуют корпус своего слоя, различаются кодом ──
  { kind: 'conversation', label: 'Conversation', code: 'CNV', shape: 'pill', layer: 'working',
    outline: 'dashed', fill: 'ghost',
    hint: 'Диалог: реплики сессии. Капсула — форма сообщения.' },
  { kind: 'episode', label: 'Episode', code: 'EPS·1', shape: 'parallelogram', layer: 'episodic',
    outline: 'solid', fill: 'tint',
    hint: 'Отдельный эпизод MASys: одно действие агента с входом, выходом и статусом.' },
  { kind: 'entity', label: 'Entity', code: 'ENT', shape: 'rounded', layer: 'semantic',
    outline: 'solid', fill: 'tint',
    hint: 'Сущность графа знаний без уточнённого типа.' },
  { kind: 'person', label: 'Person', code: 'ENT·P', shape: 'rounded', layer: 'semantic',
    outline: 'solid', fill: 'tint', hint: 'Сущность-человек в графе знаний.' },
  { kind: 'place', label: 'Place', code: 'ENT·L', shape: 'rounded', layer: 'semantic',
    outline: 'solid', fill: 'tint', hint: 'Сущность-место в графе знаний.' },
  { kind: 'org', label: 'Org', code: 'ENT·O', shape: 'rounded', layer: 'semantic',
    outline: 'solid', fill: 'tint', hint: 'Сущность-организация в графе знаний.' },
  { kind: 'concept', label: 'Concept', code: 'ENT·C', shape: 'rounded', layer: 'semantic',
    outline: 'solid', fill: 'tint', hint: 'Понятие: абстрактная сущность графа знаний.' },
  { kind: 'skill', label: 'Skill', code: 'PRC·S', shape: 'hexagon', layer: 'procedural',
    outline: 'solid', fill: 'tint',
    hint: 'Навык: закреплённый способ решения, с успешностью и счётчиком применений.' },
  { kind: 'result', label: 'Result', code: 'ART·R', shape: 'rectangle', layer: 'artifact',
    outline: 'solid', fill: 'solid',
    hint: 'Результат прогона: артефакт с временем жизни.' },
  { kind: 'decision', label: 'Decision', code: 'MET·D', shape: 'diamond', layer: 'meta',
    outline: 'solid', fill: 'tint',
    hint: 'Решение контроллера памяти: что запомнить, что забыть. Ромб — развилка.' },
]

/** Встроенные корпуса; цвет и иконка берутся из реестра видов памяти. */
export const BUILTIN_PACKAGES: MemoryPackage[] = RAW.map(p => {
  const def = MEMORY_KINDS[p.kind]
  return {
    ...p,
    color: def?.color ?? '#8E8E93',
    icon: def?.icon ?? '•',
  }
})

// Пользовательские корпуса. Реестр расширяемый: таблица корпусов может
// добавлять свои виды и переопределять встроенные. Данные приходят снаружи
// (из стора с persist), поэтому функции ниже остаются чистыми и синхронными —
// их можно вызывать из рендера узла и покрывать тестами без React.
let customPackages: MemoryPackage[] = []
let index = new Map<string, MemoryPackage>()

function rebuildIndex() {
  index = new Map<string, MemoryPackage>()
  for (const p of BUILTIN_PACKAGES) index.set(p.kind, p)
  // Пользовательский корпус с тем же kind перекрывает встроенный.
  for (const p of customPackages) index.set(p.kind, p)
}
rebuildIndex()

/** Заменяет набор пользовательских корпусов (вызывает стор при изменении). */
export function setCustomPackages(list: MemoryPackage[]) {
  customPackages = list.slice()
  rebuildIndex()
}

export function getCustomPackages(): MemoryPackage[] {
  return customPackages.slice()
}

/** Все корпуса: встроенные + пользовательские, с учётом переопределений. */
export function allPackages(): MemoryPackage[] {
  return Array.from(index.values())
}

/** Корпус описан в коде и не переопределён пользователем. */
export function isBuiltinKind(kind: string): boolean {
  return BUILTIN_PACKAGES.some(p => p.kind === kind)
}

/** Встроенный корпус перекрыт пользовательским — можно предложить сброс. */
export function isOverridden(kind: string): boolean {
  return isBuiltinKind(kind) && customPackages.some(p => p.kind === kind)
}

/** Встроенное определение — для кнопки «сбросить». */
export function builtinPackage(kind: string): MemoryPackage | null {
  return BUILTIN_PACKAGES.find(p => p.kind === kind) ?? null
}

/** Корпус для вида памяти; неизвестный вид → null (узел оформляется темой). */
export function memoryPackage(kind?: string): MemoryPackage | null {
  const k = normalizeKind(kind)
  return k ? index.get(k) ?? null : null
}

/**
 * Итоговая форма узла: явный выбор пользователя → форма корпуса вида памяти
 * → базовая. Единый источник для рендера и для layout: если layout мерит
 * узел как прямоугольник, а рисуется ромб, текст обрезается врезкой формы.
 */
export function topicShape(t?: { shape?: string; memory_kind?: string } | null): string {
  return t?.shape || memoryPackage(t?.memory_kind)?.shape || 'rounded'
}

/**
 * Проверяет пользовательский корпус перед сохранением.
 * Возвращает текст ошибки или null, если корпус пригоден.
 */
export function validatePackage(p: Partial<MemoryPackage>, knownShapes: string[]): string | null {
  const kind = (p.kind ?? '').trim().toLowerCase()
  if (!kind) return 'Укажите ключ вида памяти (kind)'
  if (!/^[a-z0-9_:-]+$/.test(kind)) return 'Ключ: только латиница, цифры, _ : -'
  if (!(p.label ?? '').trim()) return 'Укажите название'
  if (!(p.code ?? '').trim()) return 'Укажите маркировку (код)'
  if (!p.shape || !knownShapes.includes(p.shape)) return 'Выберите форму из списка'
  if (!/^#[0-9a-fA-F]{6}$/.test(p.color ?? '')) return 'Цвет — в формате #RRGGBB'
  return null
}

// ─────────────────── роль узла в дереве ───────────────────

/**
 * Роль узла: ветвление или простое отображение.
 *
 * У корпуса микросхемы есть выводы — по их числу видно, насколько деталь
 * «связная». Так же и здесь: узел-ветвление получает выводы, лист — нет.
 */
export type NodeRole = 'hub' | 'branch' | 'leaf'

/** Порог, с которого ветвление считается узлом-хабом. */
export const HUB_CHILD_THRESHOLD = 5

export function nodeRole(childCount: number, isRoot = false): NodeRole {
  if (isRoot || childCount >= HUB_CHILD_THRESHOLD) return 'hub'
  return childCount > 0 ? 'branch' : 'leaf'
}

export interface RoleStyle {
  /** Множитель толщины обводки: хаб «крепче» листа. */
  strokeScale: number
  /** Рисовать выводы по сторонам, где есть дети. */
  pins: boolean
  /** Длина вывода в px. */
  pinLength: number
}

const ROLE_STYLES: Record<NodeRole, RoleStyle> = {
  hub: { strokeScale: 1.6, pins: true, pinLength: 7 },
  branch: { strokeScale: 1.25, pins: true, pinLength: 5 },
  leaf: { strokeScale: 1, pins: false, pinLength: 0 },
}

export function roleStyle(role: NodeRole): RoleStyle {
  return ROLE_STYLES[role]
}

// ─────────────────── применение корпуса ───────────────────

export interface ResolvedNodeSkin {
  shape: string
  /** Цвет обводки; null → оставить цвет темы. */
  stroke: string | null
  /** Цвет заливки; null → оставить заливку темы. */
  fill: string | null
  outline: PackageOutline
  /** Пунктир для SVG stroke-dasharray (undefined = сплошная). */
  dashArray?: string
  strokeWidth: number
  /** Код-маркировка корпуса; null → не показывать. */
  code: string | null
}

/** Прозрачность заливки корпуса по её насыщенности. */
const FILL_ALPHA: Record<PackageFill, string> = {
  ghost: '14', // ~8 %
  tint: '24',  // ~14 %
  solid: '3d', // ~24 %
}

export interface SkinInput {
  memoryKind?: string
  /** Явная форма узла — всегда важнее корпуса. */
  shape?: string
  /** Явный цвет рамки — всегда важнее корпуса. */
  borderColor?: string
  /** Явная толщина рамки. */
  borderWidth?: number
  /** Стиль заливки узла: 'solid' | 'gradient' | 'glass' | 'outline'. */
  nodeStyle?: string
  childCount?: number
  isRoot?: boolean
  /** Базовая толщина обводки из темы. */
  baseStrokeWidth: number
}

/**
 * Сводит корпус вида памяти и роль узла в конкретное оформление.
 *
 * Приоритет: явная настройка пользователя → корпус вида памяти → тема.
 * Поэтому смена `memory_kind` не затирает то, что человек настроил руками.
 */
export function resolveNodeSkin(o: SkinInput): ResolvedNodeSkin {
  const pkg = memoryPackage(o.memoryKind)
  const role = nodeRole(o.childCount ?? 0, o.isRoot)
  const rs = roleStyle(role)

  const outline: PackageOutline = pkg?.outline ?? 'solid'
  const explicitWidth = o.borderWidth
  const baseWidth = explicitWidth ?? o.baseStrokeWidth
  // Роль усиливает обводку только когда толщина не задана вручную.
  const strokeWidth = explicitWidth !== undefined
    ? explicitWidth
    : round2(baseWidth * rs.strokeScale)

  return {
    shape: topicShape({ shape: o.shape, memory_kind: o.memoryKind }),
    stroke: o.borderColor || pkg?.color || null,
    // Заливку корпуса не навязываем, если пользователь выбрал свой стиль узла.
    fill: pkg && !o.nodeStyle ? pkg.color + FILL_ALPHA[pkg.fill] : null,
    outline,
    dashArray: outline === 'dashed' ? '5 3' : undefined,
    strokeWidth,
    code: pkg?.code ?? null,
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
