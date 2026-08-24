import { describe, it, expect } from 'vitest'
import {
  parseMarkdownToTopics,
  parseMarkdownDocument,
  serializeTopicsToMarkdown,
  type MdTopic,
} from './markdown'

describe('parseMarkdownToTopics', () => {
  it('строит дерево из заголовков', () => {
    const roots = parseMarkdownToTopics('# Root\n\n## A\n\n## B\n\n### B1\n')
    expect(roots).toHaveLength(1)
    expect(roots[0].title).toBe('Root')
    expect(roots[0].children.map(c => c.title)).toEqual(['A', 'B'])
    expect(roots[0].children[1].children[0].title).toBe('B1')
  })

  it('абзацы под заголовком становятся телом узла', () => {
    const [root] = parseMarkdownToTopics('# Root\n\nпервая\nвторая\n\n## Child\n')
    expect(root.body).toBe('первая\nвторая')
    expect(root.children[0].title).toBe('Child')
    expect(root.children[0].body).toBeUndefined()
  })

  it('цитата становится заметкой', () => {
    const [root] = parseMarkdownToTopics('# Root\n\n> заметка\n> вторая строка\n')
    expect(root.notes).toBe('заметка\nвторая строка')
  })

  it('списки вкладываются относительно последнего заголовка', () => {
    const [root] = parseMarkdownToTopics('# Root\n\n## Section\n\n- one\n- two\n  - two-a\n')
    const section = root.children[0]
    expect(section.children.map(c => c.title)).toEqual(['one', 'two'])
    expect(section.children[1].children[0].title).toBe('two-a')
  })

  it('нумерованные списки читаются как узлы', () => {
    const [root] = parseMarkdownToTopics('# Root\n\n1. первый\n2. второй\n')
    expect(root.children.map(c => c.title)).toEqual(['первый', 'второй'])
  })

  it('код в тройных кавычках не превращается в узлы', () => {
    const [root] = parseMarkdownToTopics('# Root\n\n```go\n// # not a heading\n- not a node\n```\n')
    expect(root.children).toHaveLength(0)
    expect(root.body).toContain('- not a node')
  })

  it('YAML-преамбула отбрасывается', () => {
    const [root] = parseMarkdownToTopics('---\ntitle: X\n---\n\n# Root\n')
    expect(root.title).toBe('Root')
  })

  it('gmind-комментарий применяет свойства узла', () => {
    const [root] = parseMarkdownToTopics(
      '# Root\n\n<!-- gmind: {"shape":"hexagon","icon":"Star","memory_kind":"semantic"} -->\n',
    )
    expect(root.meta).toMatchObject({ shape: 'hexagon', icon: 'Star', memory_kind: 'semantic' })
  })

  it('битый gmind-комментарий не роняет разбор', () => {
    const [root] = parseMarkdownToTopics('# Root\n\n<!-- gmind: {сломано} -->\n\n## Child\n')
    expect(root.children).toHaveLength(1)
  })
})

describe('parseMarkdownDocument', () => {
  it('несколько корней заворачиваются в синтетический корень', () => {
    const root = parseMarkdownDocument('# One\n\n# Two\n', 'Мой файл')
    expect(root.title).toBe('Мой файл')
    expect(root.children).toHaveLength(2)
  })

  it('единственный корень остаётся корнем', () => {
    const root = parseMarkdownDocument('# Один\n\n## A\n', 'fallback')
    expect(root.title).toBe('Один')
  })
})

describe('serializeTopicsToMarkdown', () => {
  const tree: MdTopic = {
    title: 'Корень',
    body: 'тело корня',
    notes: 'заметка',
    meta: { shape: 'hexagon' },
    children: [
      { title: 'Ребёнок', body: 'тело ребёнка', children: [] },
      { title: 'Второй', children: [{ title: 'Внук', meta: { memory_kind: 'episodic' }, children: [] }] },
    ],
  }

  it('round-trip сохраняет голову, тело, заметку и свойства', () => {
    const back = parseMarkdownDocument(serializeTopicsToMarkdown(tree), 'fallback')
    expect(back.title).toBe('Корень')
    expect(back.body).toBe('тело корня')
    expect(back.notes).toBe('заметка')
    expect(back.meta?.shape).toBe('hexagon')
    expect(back.children[0].body).toBe('тело ребёнка')
    expect(back.children[1].children[0].meta?.memory_kind).toBe('episodic')
  })

  it('второй проход даёт тот же текст', () => {
    const once = serializeTopicsToMarkdown(parseMarkdownDocument('# Root\n\nтело\n\n## A\n\n- l1\n  - l2\n', 'x'))
    const twice = serializeTopicsToMarkdown(parseMarkdownDocument(once, 'x'))
    expect(twice).toBe(once)
  })

  it('тело с markdown-синтаксисом не распадается на узлы', () => {
    const node: MdTopic = { title: 'Root', body: '- не узел, а строка тела\n# тоже не заголовок', children: [] }
    const back = parseMarkdownDocument(serializeTopicsToMarkdown(node), 'x')
    expect(back.children).toHaveLength(0)
    expect(back.body).toBe(node.body)
  })

  it('ниже шестого уровня используются списки', () => {
    let node: MdTopic = { title: 'L8', children: [] }
    for (let i = 7; i >= 1; i--) node = { title: `L${i}`, children: [node] }
    const md = serializeTopicsToMarkdown(node)
    expect(md).toContain('###### L6')
    expect(md).toContain('- L7')
    expect(md).toContain('  - L8')

    let depth = 0
    let cur: MdTopic | undefined = parseMarkdownDocument(md, 'x')
    while (cur && cur.children.length > 0) {
      cur = cur.children[0]
      depth++
    }
    expect(depth).toBe(7)
  })

  it('списки остаются списками при сохранении', () => {
    const out = serializeTopicsToMarkdown(parseMarkdownDocument('# Root\n\n## Раздел\n\n- один\n- два\n  - два-а\n', 'x'))
    expect(out).not.toContain('### один')
    expect(out).toContain('## Раздел')
    expect(out).toContain('- один')
    expect(out).toContain('  - два-а')
  })

  it('новый узел под пунктом списка не рвёт список заголовком', () => {
    const root = parseMarkdownDocument('# Root\n\n- пункт\n', 'x')
    root.children[0].children.push({ title: 'новый', children: [] })
    const out = serializeTopicsToMarkdown(root)
    expect(out).not.toContain('### новый')
    expect(out).toContain('  - новый')
  })

  it('лишние пустые строки схлопываются', () => {
    const out = serializeTopicsToMarkdown(
      parseMarkdownDocument('# Root\n\nтело\n\n> заметка\n\n## A\n\n## B\n', 'x'),
    )
    expect(out).not.toContain('\n\n\n')
  })

  it('пустые свойства не попадают в файл', () => {
    const md = serializeTopicsToMarkdown({ title: 'X', meta: { shape: '', progress: 0 }, children: [] })
    expect(md).not.toContain('gmind:')
  })
})

// ───────── сторожа сохранности: паритет с backend/internal/markdown ─────────

describe('узел без заголовка переживает цикл', () => {
  it('не исчезает при сохранении и перечитывании', () => {
    // Регрессия, стоившая 34 узлов из 791 на настоящих книгах: рендер писал
    // «## », разбор обрезал хвостовой пробел, «##» переставало быть заголовком.
    const tree: MdTopic = {
      title: 'Корень',
      children: [
        { title: '', children: [] },
        { title: 'После пустого', children: [] },
      ],
    }

    const back = parseMarkdownDocument(serializeTopicsToMarkdown(tree), 'x')

    expect(back.children).toHaveLength(2)
    expect(back.children[0].title).toBe('')
    expect(back.children[1].title).toBe('После пустого')
    expect(back.children[1].body ?? '').not.toContain('#')
  })

  it('пункт списка без текста тоже не исчезает', () => {
    const tree: MdTopic = {
      title: 'Корень',
      children: [{
        title: 'Раздел',
        md_form: 'list',
        children: [
          { title: '', md_form: 'list', children: [] },
          { title: 'второй', md_form: 'list', children: [] },
        ],
      }],
    }

    const back = parseMarkdownDocument(serializeTopicsToMarkdown(tree), 'x')

    expect(back.children[0].children).toHaveLength(2)
  })

  it('послабление образца не делает заголовком «#хэштег», а пунктом — «---»', () => {
    // Эти две строки и есть причина, по которой необязательной сделана связка
    // «пробел + текст», а не пробел отдельно.
    const root = parseMarkdownDocument('# Root\n\n#хэштег\n\n---\n\nтекст\n', 'x')
    expect(root.children).toHaveLength(0)
    expect(root.body ?? '').toContain('#хэштег')
  })
})

describe('строка тела, похожая на разметку', () => {
  it('не превращается в узел даже с возвратом каретки на конце', () => {
    // Расхождение сторон: рендер видел «+\r» и маркера не находил, разбор после
    // обрезки видел «+» и заводил лишний узел. На книгах машины — один узел.
    const tree: MdTopic = { title: 'Корень', body: 'строка\n+\r\nещё', children: [] }

    const back = parseMarkdownDocument(serializeTopicsToMarkdown(tree), 'x')

    expect(back.children).toHaveLength(0)
    expect(back.body).toContain('+')
  })
})

describe('свойства узла переживают цикл', () => {
  it('доходят все поля meta, а не только прежние', () => {
    // Список полей здесь намеренно широкий: молчаливое отсутствие поля в meta и
    // было дефектом — свойство добавляли в модель, забывали в сериализации, и
    // сохранение начинало его терять, не ломая ни одного теста.
    const meta = {
      shape: 'hexagon',
      memory_kind: 'episodic',
      hyperlink: 'http://localhost:1010/api/v1/files/notes/N-1/a.jpg',
      node_width: 340,
      node_height: 280,
      font_size: 22,
      font_family: 'Georgia, serif',
      font_weight: 700,
      text_align: 'right',
      border_width: 5,
      padding: 28,
      opacity: 0.85,
      shadow_type: 'strong',
      branch_side: 'right',
      parent_anchor: 'top',
      edge_style: 'angled',
      edge_dash: 'dotted',
      edge_weight: 5,
      level_gap: 180,
      sibling_gap: 72,
      folded_sides: ['top'],
      fold_icon: 'chevron',
      connection_color: '#ff0000',
      show_child_count: true,
      comment_icon: 'bubble',
      masys_run_id: 'run-42',
    }

    const back = parseMarkdownDocument(
      serializeTopicsToMarkdown({ title: 'Узел', meta, children: [] }),
      'x',
    )

    expect(back.meta).toEqual(meta)
  })
})
