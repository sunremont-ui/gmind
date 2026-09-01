// Библиотека визуальных компонентов — «каталог деталей» для холста.
//
// Корпус (memoryPackages) отвечает на вопрос «как выглядит этот вид памяти».
// Компонент отвечает на вопрос «что я сейчас кладу на холст»: это готовая
// заготовка — узел с преднастроенным оформлением и, при необходимости, с
// поддеревом. Аналогия та же, электронная: корпус — это исполнение детали,
// а компонент — позиция в каталоге, которую берут и ставят на плату.
//
// Реестр расширяемый по тому же принципу, что и корпуса: встроенные компоненты
// описаны в коде, пользовательские внедряются извне (стор с persist), поэтому
// функции здесь чистые и синхронные.

import type { Topic } from '../types'
import { memoryPackage, topicShape } from './memoryPackages'

export type ComponentCategory = 'memory' | 'structure' | 'task' | 'note'

/** Заготовка узла: то, что компонент кладёт на холст. */
export interface ComponentNodeSpec {
  title: string
  body?: string
  notes?: string
  memory_kind?: string
  shape?: string
  icon?: string
  border_color?: string
  node_style?: string
  /** Раскладка, которую получит узел (в т.ч. радиальные виды). */
  structure_class?: string
  children?: ComponentNodeSpec[]
}

export interface VisualComponent {
  id: string
  label: string
  category: ComponentCategory
  /** Короткое описание: что это и когда брать. */
  hint: string
  /** Заготовка, которая ляжет на холст. */
  spec: ComponentNodeSpec
}

export const COMPONENT_CATEGORIES: Array<{ id: ComponentCategory; label: string }> = [
  { id: 'memory', label: 'Память' },
  { id: 'structure', label: 'Структуры' },
  { id: 'task', label: 'Задачи' },
  { id: 'note', label: 'Заметки' },
]

// Компоненты памяти строятся из корпусов: вид памяти уже несёт форму, цвет и
// обводку, поэтому здесь достаточно указать kind — оформление подтянется.
function memoryComponent(kind: string, label: string, hint: string): VisualComponent {
  return {
    id: `mem-${kind}`,
    label,
    category: 'memory',
    hint,
    spec: { title: label, memory_kind: kind },
  }
}

const BUILTIN: VisualComponent[] = [
  // ── Память: по одному компоненту на слой karp ──
  memoryComponent('working', 'Рабочая память', 'Черновик, текущий контекст. Живёт недолго.'),
  memoryComponent('episodic', 'Эпизод', 'Что произошло и когда.'),
  memoryComponent('semantic', 'Знание', 'Устойчивый факт или понятие.'),
  memoryComponent('procedural', 'Навык', 'Как что-то делать: процедура.'),
  memoryComponent('artifact', 'Артефакт', 'Готовый результат, файл, вывод.'),
  memoryComponent('meta', 'Мета', 'Рассуждение системы о себе.'),
  memoryComponent('decision', 'Решение', 'Развилка: что запомнить, что забыть.'),
  memoryComponent('concept', 'Понятие', 'Сущность графа знаний.'),

  // ── Структуры: готовые ветвления ──
  {
    id: 'struct-radial-hub',
    label: 'Радиальный хаб',
    category: 'structure',
    hint: 'Центр с ветками по кругу: секторы делятся по габариту, узлы не перекрываются.',
    spec: {
      title: 'Хаб',
      structure_class: 'radial-packed',
      children: [
        { title: 'Ветка 1' }, { title: 'Ветка 2' },
        { title: 'Ветка 3' }, { title: 'Ветка 4' },
      ],
    },
  },
  {
    id: 'struct-clock',
    label: 'Циферблат',
    category: 'structure',
    hint: 'Двенадцать фиксированных позиций — узлы всегда «на часах».',
    spec: {
      title: 'Циферблат',
      structure_class: 'radial-clock',
      children: Array.from({ length: 6 }, (_, i) => ({ title: `${i + 1}` })),
    },
  },
  {
    id: 'struct-decision',
    label: 'Дерево решения',
    category: 'structure',
    hint: 'Ромб-развилка с двумя исходами.',
    spec: {
      title: 'Развилка',
      memory_kind: 'decision',
      structure_class: 'tree-right',
      children: [
        { title: 'Да', memory_kind: 'artifact' },
        { title: 'Нет', memory_kind: 'artifact' },
      ],
    },
  },
  {
    id: 'struct-timeline',
    label: 'Линия времени',
    category: 'structure',
    hint: 'Цепочка эпизодов вниз: скошенные корпуса читаются как ход времени.',
    spec: {
      title: 'Линия времени',
      structure_class: 'tree-down',
      children: [
        { title: 'Шаг 1', memory_kind: 'episodic' },
        { title: 'Шаг 2', memory_kind: 'episodic' },
        { title: 'Шаг 3', memory_kind: 'episodic' },
      ],
    },
  },
  {
    id: 'struct-matrix',
    label: 'Матрица 2×2',
    category: 'structure',
    hint: 'Четыре квадранта вокруг центра — веером по кругу.',
    spec: {
      title: 'Матрица',
      structure_class: 'radial-even',
      children: [
        { title: 'Важно · срочно' }, { title: 'Важно · не срочно' },
        { title: 'Не важно · срочно' }, { title: 'Не важно · не срочно' },
      ],
    },
  },

  // ── Задачи ──
  {
    id: 'task-masys',
    label: 'Задача MASys',
    category: 'task',
    hint: 'Узел под постановку работы: запустите по нему пайплайн во вкладке «Узел».',
    spec: {
      title: 'Задача',
      memory_kind: 'procedural',
      body: 'Что нужно сделать',
    },
  },
  {
    id: 'task-checklist',
    label: 'Чек-лист',
    category: 'task',
    hint: 'Список шагов с отметками о выполнении.',
    spec: {
      title: 'Чек-лист',
      structure_class: 'tree-right',
      children: [
        { title: '☐ Шаг 1' }, { title: '☐ Шаг 2' }, { title: '☐ Шаг 3' },
      ],
    },
  },

  // ── Заметки ──
  {
    id: 'note-plain',
    label: 'Заметка',
    category: 'note',
    hint: 'Голова + тело: заголовок и текст под ним.',
    spec: { title: 'Заметка', body: 'Текст заметки', shape: 'note' },
  },
  {
    id: 'note-question',
    label: 'Вопрос',
    category: 'note',
    hint: 'Открытый вопрос, к которому вернутся.',
    spec: { title: 'Вопрос?', shape: 'ellipse', icon: 'Lightbulb' },
  },
]

export const BUILTIN_COMPONENTS: VisualComponent[] = BUILTIN

let customComponents: VisualComponent[] = []
let index = new Map<string, VisualComponent>()

function rebuildIndex() {
  index = new Map<string, VisualComponent>()
  for (const c of BUILTIN_COMPONENTS) index.set(c.id, c)
  // Пользовательский компонент с тем же id перекрывает встроенный.
  for (const c of customComponents) index.set(c.id, c)
}
rebuildIndex()

/** Заменяет набор пользовательских компонентов (вызывает стор при изменении). */
export function setCustomComponents(list: VisualComponent[]) {
  customComponents = list.slice()
  rebuildIndex()
}

export function getCustomComponents(): VisualComponent[] {
  return customComponents.slice()
}

/** Все компоненты: встроенные + свои, с учётом переопределений. */
export function allComponents(): VisualComponent[] {
  return Array.from(index.values())
}

export function componentById(id: string): VisualComponent | null {
  return index.get(id) ?? null
}

export function isBuiltinComponent(id: string): boolean {
  return BUILTIN_COMPONENTS.some(c => c.id === id)
}

export function componentsByCategory(category: ComponentCategory): VisualComponent[] {
  return allComponents().filter(c => c.category === category)
}

/**
 * Форма, которой компонент отрисуется на холсте: своя, иначе от корпуса вида
 * памяти, иначе базовая. Тот же порядок, что и в rendering узла.
 */
export function componentShape(spec: ComponentNodeSpec): string {
  return topicShape(spec)
}

/** Цвет-акцент компонента для превью в палитре. */
export function componentColor(spec: ComponentNodeSpec): string | null {
  return spec.border_color ?? memoryPackage(spec.memory_kind)?.color ?? null
}

/** Сколько узлов появится на холсте — полезно предупредить в палитре. */
export function componentNodeCount(spec: ComponentNodeSpec): number {
  return 1 + (spec.children ?? []).reduce((sum, c) => sum + componentNodeCount(c), 0)
}

/**
 * Превращает узел карты в компонент — «сохранить как компонент».
 * Берём только оформление и структуру, без id и позиций: компонент — заготовка,
 * а не копия конкретного узла.
 */
export function componentFromTopic(topic: Topic, label: string, category: ComponentCategory = 'note'): VisualComponent {
  const toSpec = (t: Topic): ComponentNodeSpec => {
    const spec: ComponentNodeSpec = { title: t.title }
    if (t.body) spec.body = t.body
    if (t.notes) spec.notes = t.notes
    if (t.memory_kind) spec.memory_kind = t.memory_kind
    if (t.shape) spec.shape = t.shape
    if (t.icon) spec.icon = t.icon
    if (t.border_color) spec.border_color = t.border_color
    if (t.node_style) spec.node_style = t.node_style
    if (t.structure_class) spec.structure_class = t.structure_class
    const kids = (t.children ?? []).map(toSpec)
    if (kids.length) spec.children = kids
    return spec
  }
  return {
    id: `own-${slug(label)}-${uniqueSuffix()}`,
    label,
    category,
    hint: 'Свой компонент, сохранённый с холста.',
    spec: toSpec(topic),
  }
}

// Метки времени недостаточно: два компонента, сохранённых в одну миллисекунду,
// получили бы один id, и один молча перекрыл бы другой в реестре.
let idCounter = 0
function uniqueSuffix(): string {
  idCounter += 1
  return `${Date.now().toString(36)}${idCounter.toString(36)}`
}

function slug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9а-я]+/gi, '-').replace(/^-|-$/g, '') || 'component'
}

/** Проверка перед сохранением своего компонента. */
export function validateComponent(c: Partial<VisualComponent>): string | null {
  if (!c.id || !c.id.trim()) return 'Пустой идентификатор компонента'
  if (!c.label || !c.label.trim()) return 'Укажите название'
  if (!c.category) return 'Укажите категорию'
  if (!c.spec || !c.spec.title?.trim()) return 'У заготовки должен быть заголовок'
  return null
}
