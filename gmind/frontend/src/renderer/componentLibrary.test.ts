import { describe, it, expect, afterEach } from 'vitest'
import {
  BUILTIN_COMPONENTS,
  COMPONENT_CATEGORIES,
  allComponents,
  componentById,
  componentsByCategory,
  componentShape,
  componentColor,
  componentNodeCount,
  componentFromTopic,
  validateComponent,
  setCustomComponents,
  getCustomComponents,
  isBuiltinComponent,
  type VisualComponent,
} from './componentLibrary'
import { memoryPackage } from './memoryPackages'
import { shapeDef } from './shapes'
import type { Topic } from '../types'

// Реестр — модульное состояние: возвращаем в исходное после каждого теста.
afterEach(() => setCustomComponents([]))

describe('встроенные компоненты', () => {
  it('id уникальны', () => {
    const ids = BUILTIN_COMPONENTS.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('у каждого есть название, подсказка и заголовок заготовки', () => {
    for (const c of BUILTIN_COMPONENTS) {
      expect(c.label.trim().length).toBeGreaterThan(2)
      expect(c.hint.length).toBeGreaterThan(10)
      expect(c.spec.title.trim().length).toBeGreaterThan(0)
    }
  })

  it('категория каждого компонента объявлена в списке категорий', () => {
    const known = new Set(COMPONENT_CATEGORIES.map(c => c.id))
    for (const c of BUILTIN_COMPONENTS) expect(known.has(c.category)).toBe(true)
  })

  it('каждая категория непустая — в палитре не будет пустых вкладок', () => {
    for (const cat of COMPONENT_CATEGORIES) {
      expect(componentsByCategory(cat.id).length).toBeGreaterThan(0)
    }
  })

  it('все формы заготовок существуют в реестре форм', () => {
    const check = (spec: { shape?: string; children?: unknown[] }) => {
      if (spec.shape) expect(shapeDef(spec.shape).id).toBe(spec.shape)
      for (const ch of (spec.children ?? []) as Array<{ shape?: string }>) check(ch)
    }
    for (const c of BUILTIN_COMPONENTS) check(c.spec)
  })

  it('все виды памяти в заготовках имеют корпус', () => {
    const check = (spec: { memory_kind?: string; children?: unknown[] }) => {
      if (spec.memory_kind) expect(memoryPackage(spec.memory_kind)).not.toBeNull()
      for (const ch of (spec.children ?? []) as Array<{ memory_kind?: string }>) check(ch)
    }
    for (const c of BUILTIN_COMPONENTS) check(c.spec)
  })
})

describe('оформление компонента', () => {
  it('форма берётся от корпуса вида памяти, если своя не задана', () => {
    expect(componentShape({ title: 'x', memory_kind: 'procedural' }))
      .toBe(memoryPackage('procedural')!.shape)
  })

  it('своя форма важнее корпуса', () => {
    expect(componentShape({ title: 'x', memory_kind: 'procedural', shape: 'cloud' })).toBe('cloud')
  })

  it('без вида памяти и формы — базовый корпус', () => {
    expect(componentShape({ title: 'x' })).toBe('rounded')
  })

  it('цвет берётся от корпуса, свой важнее', () => {
    expect(componentColor({ title: 'x', memory_kind: 'meta' })).toBe(memoryPackage('meta')!.color)
    expect(componentColor({ title: 'x', memory_kind: 'meta', border_color: '#abcdef' })).toBe('#abcdef')
    expect(componentColor({ title: 'x' })).toBeNull()
  })
})

describe('componentNodeCount', () => {
  it('одиночный узел считается за один', () => {
    expect(componentNodeCount({ title: 'a' })).toBe(1)
  })

  it('считает всё поддерево', () => {
    expect(componentNodeCount({
      title: 'a',
      children: [{ title: 'b', children: [{ title: 'c' }] }, { title: 'd' }],
    })).toBe(4)
  })

  it('радиальный хаб кладёт больше одного узла', () => {
    const hub = componentById('struct-radial-hub')!
    expect(componentNodeCount(hub.spec)).toBeGreaterThan(1)
  })
})

describe('пользовательские компоненты', () => {
  const own: VisualComponent = {
    id: 'own-test', label: 'Свой', category: 'note',
    hint: 'проверка своего компонента', spec: { title: 'Свой узел' },
  }

  it('добавленный компонент находится и попадает в список', () => {
    setCustomComponents([own])
    expect(componentById('own-test')?.label).toBe('Свой')
    expect(allComponents().some(c => c.id === 'own-test')).toBe(true)
    expect(isBuiltinComponent('own-test')).toBe(false)
  })

  it('свой компонент попадает в свою категорию', () => {
    setCustomComponents([own])
    expect(componentsByCategory('note').some(c => c.id === 'own-test')).toBe(true)
  })

  it('свой id может перекрыть встроенный без дублей', () => {
    setCustomComponents([{ ...own, id: 'note-plain', label: 'Моя заметка' }])
    expect(componentById('note-plain')?.label).toBe('Моя заметка')
    expect(allComponents().filter(c => c.id === 'note-plain')).toHaveLength(1)
  })

  it('снятие переопределения возвращает встроенный', () => {
    setCustomComponents([{ ...own, id: 'note-plain', label: 'Моя заметка' }])
    setCustomComponents([])
    expect(componentById('note-plain')?.label).toBe('Заметка')
  })

  it('getCustomComponents отдаёт копию — реестр не портится извне', () => {
    setCustomComponents([own])
    getCustomComponents().push({ ...own, id: 'hack' })
    expect(componentById('hack')).toBeNull()
  })
})

describe('componentFromTopic', () => {
  const topic = {
    id: 't1', title: 'Узел', body: 'тело', notes: 'заметка',
    memory_kind: 'semantic', shape: 'hexagon', structure_class: 'radial-packed',
    children: [
      { id: 't2', title: 'Ребёнок', memory_kind: 'artifact' },
      { id: 't3', title: 'Второй', children: [{ id: 't4', title: 'Внук' }] },
    ],
  } as unknown as Topic

  it('переносит оформление и структуру', () => {
    const c = componentFromTopic(topic, 'Мой шаблон', 'structure')
    expect(c.label).toBe('Мой шаблон')
    expect(c.category).toBe('structure')
    expect(c.spec).toMatchObject({
      title: 'Узел', body: 'тело', notes: 'заметка',
      memory_kind: 'semantic', shape: 'hexagon', structure_class: 'radial-packed',
    })
  })

  it('сохраняет всё поддерево', () => {
    const c = componentFromTopic(topic, 'Шаблон')
    expect(componentNodeCount(c.spec)).toBe(4)
    expect(c.spec.children?.[1].children?.[0].title).toBe('Внук')
  })

  it('не тащит id узлов — компонент это заготовка, а не копия', () => {
    const c = componentFromTopic(topic, 'Шаблон')
    expect(JSON.stringify(c.spec)).not.toContain('t1')
    expect(JSON.stringify(c.spec)).not.toContain('t4')
  })

  it('id компонента уникален для одинаковых названий', () => {
    const a = componentFromTopic(topic, 'Шаблон')
    const b = componentFromTopic({ ...topic, title: 'Другой' } as Topic, 'Шаблон')
    expect(a.id).not.toBe(b.id)
  })

  it('пустые поля не попадают в заготовку', () => {
    const bare = { id: 'x', title: 'Только заголовок' } as unknown as Topic
    const c = componentFromTopic(bare, 'Пустой')
    expect(c.spec).toEqual({ title: 'Только заголовок' })
  })
})

describe('validateComponent', () => {
  const valid: VisualComponent = {
    id: 'ok', label: 'Ок', category: 'note', hint: '', spec: { title: 'Узел' },
  }

  it('пропускает корректный компонент', () => {
    expect(validateComponent(valid)).toBeNull()
  })

  it.each([
    ['без id', { ...valid, id: '' }],
    ['без названия', { ...valid, label: '  ' }],
    ['без заголовка заготовки', { ...valid, spec: { title: '' } }],
  ])('отклоняет компонент %s', (_name, c) => {
    expect(validateComponent(c as VisualComponent)).not.toBeNull()
  })
})
