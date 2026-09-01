import { describe, it, expect } from 'vitest'
import { afterEach } from 'vitest'
import {
  BUILTIN_PACKAGES,
  memoryPackage,
  nodeRole,
  roleStyle,
  resolveNodeSkin,
  HUB_CHILD_THRESHOLD,
  setCustomPackages,
  getCustomPackages,
  allPackages,
  isBuiltinKind,
  isOverridden,
  builtinPackage,
  validatePackage,
  type MemoryPackage,
} from './memoryPackages'
import { MEMORY_KINDS } from '../components/MindMap/memoryKinds'
import { shapeDef, NODE_SHAPES } from './shapes'

// Реестр — модульное состояние: после каждого теста возвращаем его в исходное.
afterEach(() => setCustomPackages([]))

describe('таблица корпусов', () => {
  it('покрывает все виды памяти из реестра', () => {
    const covered = new Set(BUILTIN_PACKAGES.map(p => p.kind))
    for (const kind of Object.keys(MEMORY_KINDS)) {
      expect(covered.has(kind)).toBe(true)
    }
  })

  it('коды корпусов уникальны — маркировка должна читаться однозначно', () => {
    const codes = BUILTIN_PACKAGES.map(p => p.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('каждый корпус ссылается на существующую форму', () => {
    for (const p of BUILTIN_PACKAGES) {
      expect(shapeDef(p.shape).id).toBe(p.shape)
    }
  })

  it('цвет корпуса совпадает с цветом слоя из реестра видов', () => {
    for (const p of BUILTIN_PACKAGES) {
      expect(p.color).toBe(MEMORY_KINDS[p.kind].color)
    }
  })

  it('у каждого корпуса есть подсказка «где применяется»', () => {
    for (const p of BUILTIN_PACKAGES) {
      expect(p.hint.length).toBeGreaterThan(10)
    }
  })

  it('тонкие типы MASys наследуют форму своего слоя', () => {
    expect(memoryPackage('skill')!.shape).toBe(memoryPackage('procedural')!.shape)
    expect(memoryPackage('result')!.shape).toBe(memoryPackage('artifact')!.shape)
    expect(memoryPackage('episode')!.shape).toBe(memoryPackage('episodic')!.shape)
    expect(memoryPackage('person')!.shape).toBe(memoryPackage('semantic')!.shape)
  })

  it('решение — ромб, как развилка в блок-схеме', () => {
    expect(memoryPackage('decision')!.shape).toBe('diamond')
  })

  it('рабочая память визуально летучая: пунктир + прозрачная заливка', () => {
    const wrk = memoryPackage('working')!
    expect(wrk.outline).toBe('dashed')
    expect(wrk.fill).toBe('ghost')
  })

  it('неизвестный вид не даёт корпуса — узел остаётся на оформлении темы', () => {
    expect(memoryPackage('нет-такого')).toBeNull()
    expect(memoryPackage(undefined)).toBeNull()
  })

  it('регистр вида памяти не важен', () => {
    expect(memoryPackage('SEMANTIC')?.kind).toBe('semantic')
  })
})

describe('пользовательские корпуса', () => {
  const own: MemoryPackage = {
    kind: 'my_kind', label: 'Мой вид', code: 'MY', shape: 'cloud', layer: 'semantic',
    color: '#123456', icon: '🌟', outline: 'dashed', fill: 'solid', hint: 'проверка своего корпуса',
  }

  it('добавленный корпус находится по своему виду', () => {
    setCustomPackages([own])
    expect(memoryPackage('my_kind')).toMatchObject({ shape: 'cloud', code: 'MY' })
    expect(allPackages().some(p => p.kind === 'my_kind')).toBe(true)
  })

  it('свой корпус применяется к узлу как встроенный', () => {
    setCustomPackages([own])
    const skin = resolveNodeSkin({ baseStrokeWidth: 1.5, memoryKind: 'my_kind' })
    expect(skin.shape).toBe('cloud')
    expect(skin.stroke).toBe('#123456')
    expect(skin.dashArray).toBe('5 3')
  })

  it('свой корпус может переопределить встроенный вид', () => {
    expect(memoryPackage('semantic')!.shape).toBe('rounded')
    setCustomPackages([{ ...own, kind: 'semantic', shape: 'diamond' }])
    expect(memoryPackage('semantic')!.shape).toBe('diamond')
    expect(isOverridden('semantic')).toBe(true)
    // Встроенное определение остаётся доступным для сброса.
    expect(builtinPackage('semantic')!.shape).toBe('rounded')
  })

  it('снятие переопределения возвращает встроенный корпус', () => {
    setCustomPackages([{ ...own, kind: 'semantic', shape: 'diamond' }])
    setCustomPackages([])
    expect(memoryPackage('semantic')!.shape).toBe('rounded')
    expect(isOverridden('semantic')).toBe(false)
  })

  it('переопределение не плодит дублей в таблице', () => {
    setCustomPackages([{ ...own, kind: 'semantic' }])
    expect(allPackages().filter(p => p.kind === 'semantic')).toHaveLength(1)
  })

  it('различает свой вид и встроенный', () => {
    setCustomPackages([own])
    expect(isBuiltinKind('semantic')).toBe(true)
    expect(isBuiltinKind('my_kind')).toBe(false)
  })

  it('getCustomPackages отдаёт копию — реестр не портится извне', () => {
    setCustomPackages([own])
    getCustomPackages().push({ ...own, kind: 'hack' })
    expect(memoryPackage('hack')).toBeNull()
  })
})

describe('validatePackage', () => {
  const shapes = NODE_SHAPES.map(s => s.id)
  const valid: MemoryPackage = {
    kind: 'ok_kind', label: 'Ок', code: 'OK', shape: 'rounded', layer: 'meta',
    color: '#aabbcc', icon: '•', outline: 'solid', fill: 'tint', hint: '',
  }

  it('пропускает корректный корпус', () => {
    expect(validatePackage(valid, shapes)).toBeNull()
  })

  it.each([
    ['без ключа', { ...valid, kind: '' }],
    ['ключ с пробелом', { ...valid, kind: 'my kind' }],
    ['без названия', { ...valid, label: '' }],
    ['без маркировки', { ...valid, code: '' }],
    ['с неизвестной формой', { ...valid, shape: 'нет-такой' }],
    ['с некорректным цветом', { ...valid, color: 'red' }],
  ])('отклоняет корпус %s', (_name, pkg) => {
    expect(validatePackage(pkg as MemoryPackage, shapes)).not.toBeNull()
  })
})

describe('роль узла', () => {
  it('лист — без детей, ветвление — с детьми, хаб — от порога', () => {
    expect(nodeRole(0)).toBe('leaf')
    expect(nodeRole(1)).toBe('branch')
    expect(nodeRole(HUB_CHILD_THRESHOLD)).toBe('hub')
  })

  it('корень всегда хаб, даже без детей', () => {
    expect(nodeRole(0, true)).toBe('hub')
  })

  it('выводы есть у ветвлений и хабов, у листа — нет', () => {
    expect(roleStyle('leaf').pins).toBe(false)
    expect(roleStyle('branch').pins).toBe(true)
    expect(roleStyle('hub').pins).toBe(true)
  })

  it('чем связнее узел, тем крепче обводка', () => {
    expect(roleStyle('hub').strokeScale).toBeGreaterThan(roleStyle('branch').strokeScale)
    expect(roleStyle('branch').strokeScale).toBeGreaterThan(roleStyle('leaf').strokeScale)
  })
})

describe('resolveNodeSkin — приоритет настроек', () => {
  const base = { baseStrokeWidth: 1.5 }

  it('вид памяти задаёт форму, обводку и маркировку', () => {
    const skin = resolveNodeSkin({ ...base, memoryKind: 'procedural' })
    expect(skin.shape).toBe('hexagon')
    expect(skin.stroke).toBe(MEMORY_KINDS.procedural.color)
    expect(skin.code).toBe('PRC')
  })

  it('явная форма пользователя главнее корпуса', () => {
    const skin = resolveNodeSkin({ ...base, memoryKind: 'procedural', shape: 'cloud' })
    expect(skin.shape).toBe('cloud')
  })

  it('явный цвет рамки главнее корпуса', () => {
    const skin = resolveNodeSkin({ ...base, memoryKind: 'semantic', borderColor: '#ff0000' })
    expect(skin.stroke).toBe('#ff0000')
  })

  it('явный стиль узла отменяет заливку корпуса', () => {
    expect(resolveNodeSkin({ ...base, memoryKind: 'artifact' }).fill).not.toBeNull()
    expect(resolveNodeSkin({ ...base, memoryKind: 'artifact', nodeStyle: 'glass' }).fill).toBeNull()
  })

  it('без вида памяти оформление остаётся за темой', () => {
    const skin = resolveNodeSkin({ ...base })
    expect(skin.shape).toBe('rounded')
    expect(skin.stroke).toBeNull()
    expect(skin.fill).toBeNull()
    expect(skin.code).toBeNull()
  })

  it('пунктирный корпус отдаёт dash-array, сплошной — нет', () => {
    expect(resolveNodeSkin({ ...base, memoryKind: 'working' }).dashArray).toBe('5 3')
    expect(resolveNodeSkin({ ...base, memoryKind: 'semantic' }).dashArray).toBeUndefined()
  })

  it('роль усиливает обводку, но заданную вручную толщину не трогает', () => {
    const leaf = resolveNodeSkin({ ...base, childCount: 0 })
    const hub = resolveNodeSkin({ ...base, childCount: 9 })
    expect(hub.strokeWidth).toBeGreaterThan(leaf.strokeWidth)

    const manual = resolveNodeSkin({ ...base, childCount: 9, borderWidth: 3 })
    expect(manual.strokeWidth).toBe(3)
  })
})
