// Markdown как рабочий формат карты — паритет с backend/internal/markdown.
//
// Заголовок → «голова» узла (title), абзацы под ним → «тело» (body),
// цитата → notes, комментарий `<!-- gmind: {...} -->` → визуальные свойства.
// Глубже шестого уровня дерево продолжается вложенными списками.

export const MAX_HEADING_LEVEL = 6

/**
 * Форма записи узла в файле. Хранится на узле (Topic.md_form), чтобы
 * сохранение не переписывало авторские списки в заголовки и наоборот.
 */
export const FORM_HEADING = 'heading'
export const FORM_LIST = 'list'

/**
 * Свойства узла, которые невыразимы синтаксисом Markdown.
 *
 * Поле, которого здесь нет, при сохранении карты пропадает молча. Замер
 * map-roundtrip-loss на настоящих книгах показал цену умолчания: из свойств
 * формы доходило 32.9%, а гиперссылки узлов терялись полностью. Список ведётся
 * по модели Topic, а не по тому, что казалось важным.
 *
 * Не входят сюда: id (meta под каждым узлом сделала бы файл нечитаемым),
 * comment_count (производное от таблицы комментариев) и md_form
 * (восстанавливается из самой формы записи).
 */
export interface MdMeta {
  shape?: string
  icon?: string
  node_style?: string
  font_color?: string
  border_color?: string
  memory_kind?: string
  masys_ref?: { namespace: string; kind: string; key: string }
  markers?: string[]
  labels?: string[]
  progress?: number
  priority?: number
  folded?: boolean
  image?: string
  position?: { x: number; y: number }
  child_dir?: string
  structure_class?: string
  rich_text?: string

  /** Ссылка узла: ею записи мастера ссылаются на свои вложения. */
  hyperlink?: string

  /** Геометрия и шрифт. */
  node_width?: number
  node_height?: number
  font_size?: number
  font_family?: string
  font_weight?: number
  text_align?: string
  border_width?: number
  padding?: number
  opacity?: number
  shadow_type?: string

  /** Раскладка и ребро к родителю. */
  branch_side?: string
  parent_anchor?: string
  edge_style?: string
  edge_dash?: string
  edge_weight?: number
  level_gap?: number
  sibling_gap?: number
  folded_sides?: string[]
  fold_icon?: string

  /** Прочее, что иначе теряется. */
  connection_color?: string
  show_child_count?: boolean
  comment_icon?: string
  masys_run_id?: string
}

export interface MdTopic {
  title: string
  body?: string
  notes?: string
  meta?: MdMeta
  /** 'heading' | 'list' — как узел записан в файле. */
  md_form?: string
  children: MdTopic[]
}

// Текст после маркера НЕОБЯЗАТЕЛЕН — паритет с backend/internal/markdown, где
// это исправление потери данных: узел с пустым заголовком рендерился в «## »,
// разбор обрезал хвостовой пробел, и «##» переставало быть заголовком — узел
// исчезал, а решётки оседали в теле соседа.
//
// Необязательна именно связка «пробел + текст», а не пробел отдельно: образец
// /^(#{1,6})\s*(.*)$/ сделал бы заголовком любой «#хэштег», а
// /^(\s*)([-*+])\s*(.*)$/ — строку «---» пунктом списка.
const HEADING_RE = /^(#{1,6})(?:[ \t]+(.*))?$/
const LIST_ITEM_RE = /^(\s*)(?:[-*+]|\d+[.)])(?:[ \t]+(.*))?$/
const META_RE = /^<!--\s*gmind:\s*(\{.*\})\s*-->$/
const FENCE_RE = /^\s*(```|~~~)/
const FRONT_DELIM_RE = /^---\s*$/

interface ParsedNode {
  level: number
  topic: MdTopic
  bodyLines: string[]
  noteLines: string[]
  inList: boolean
}

/** Разбирает документ и возвращает узлы верхнего уровня. */
export function parseMarkdownToTopics(markdown: string): MdTopic[] {
  const lines = stripFrontMatter(String(markdown).replace(/\r\n/g, '\n').split('\n'))

  const roots: ParsedNode[] = []
  const stack: ParsedNode[] = []
  const all: ParsedNode[] = []
  // Уровень последнего заголовка: от него отсчитывается вложенность списков.
  let headingBase = 0
  let inFence = false

  const current = (): ParsedNode | null => (stack.length ? stack[stack.length - 1] : null)

  const attach = (n: ParsedNode) => {
    all.push(n)
    while (stack.length > 0 && stack[stack.length - 1].level >= n.level) stack.pop()
    if (stack.length === 0) roots.push(n)
    else stack[stack.length - 1].topic.children.push(n.topic)
    stack.push(n)
  }

  for (const raw of lines) {
    const line = raw.replace(/[ \t\r]+$/, '')

    if (FENCE_RE.test(line)) {
      inFence = !inFence
      current()?.bodyLines.push(line)
      continue
    }
    if (inFence) {
      current()?.bodyLines.push(line)
      continue
    }

    if (!line.trim()) {
      const cur = current()
      if (cur && cur.bodyLines.length > 0) cur.bodyLines.push('')
      continue
    }

    const metaMatch = line.trim().match(META_RE)
    if (metaMatch) {
      const cur = current()
      if (cur) {
        try {
          cur.topic.meta = { ...(cur.topic.meta ?? {}), ...JSON.parse(metaMatch[1]) }
        } catch {
          // повреждённый комментарий игнорируем — текст карты важнее
        }
      }
      continue
    }

    const heading = line.match(HEADING_RE)
    if (heading) {
      headingBase = heading[1].length
      const n = newNode(headingBase, (heading[2] ?? '').trim(), false)
      n.topic.md_form = FORM_HEADING
      attach(n)
      continue
    }

    const item = line.match(LIST_ITEM_RE)
    if (item) {
      const level = headingBase + 1 + Math.floor(indentWidth(item[1]) / 2)
      const [title, body] = splitListItem((item[2] ?? '').trim())
      const n = newNode(level, title, true)
      n.topic.md_form = FORM_LIST
      if (body) n.bodyLines.push(body)
      attach(n)
      continue
    }

    if (line.trim().startsWith('>')) {
      current()?.noteLines.push(line.trim().replace(/^>\s?/, ''))
      continue
    }

    const cur = current()
    if (cur) {
      cur.bodyLines.push(cur.inList ? line.trim() : line)
      continue
    }
    // Текст до первого заголовка становится узлом верхнего уровня.
    attach(newNode(1, line.trim(), false))
  }

  for (const n of all) {
    const body = n.bodyLines.map(unescapeBodyLine).join('\n').trim()
    if (body) n.topic.body = body
    const notes = n.noteLines.join('\n').trim()
    if (notes) n.topic.notes = notes
  }

  return roots.map(n => n.topic)
}

/**
 * Разбирает документ в один корневой узел: если верхний уровень один — он и
 * есть корень, иначе создаётся корень с заголовком fallbackTitle.
 */
export function parseMarkdownDocument(markdown: string, fallbackTitle = 'Untitled'): MdTopic {
  const roots = parseMarkdownToTopics(markdown)
  if (roots.length === 1) return roots[0]
  return { title: fallbackTitle, children: roots }
}

/** Собирает Markdown-документ из дерева узлов (обратная операция к parse). */
export function serializeTopicsToMarkdown(root: MdTopic): string {
  const out: string[] = []
  renderNode(out, root, 1)
  return collapseBlankLines(out.join('').replace(/^\n+/, ''))
}

function renderNode(out: string[], t: MdTopic, level: number) {
  if (!t) return
  // Корень всегда заголовок: файл, начинающийся с «- пункт», читался бы как
  // список без названия. Ниже форма узла решает, заголовок это или пункт.
  if (level <= MAX_HEADING_LEVEL && (level === 1 || t.md_form !== FORM_LIST)) {
    // Пустой заголовок пишется одними решётками: висячий пробел всё равно
    // потеряется при разборе, и лучше сразу писать то, что будет прочитано.
    out.push(`\n${`${'#'.repeat(level)} ${oneLine(t.title)}`.replace(/ +$/, '')}\n\n`)
    writeAttachments(out, t, '')
    for (const c of t.children ?? []) renderNode(out, c, level + 1)
    return
  }
  // Внутри списка заголовков быть не может — вся ветка идёт пунктами.
  renderListItem(out, t, 0)
}

// Схлопывает подряд идущие пустые строки: блоки склеиваются независимо,
// и без этого файл «разъезжается» лишними отбивками.
function collapseBlankLines(s: string): string {
  const out: string[] = []
  let blank = 0
  for (const line of s.split('\n')) {
    if (!line.trim()) {
      blank++
      if (blank > 1) continue
    } else {
      blank = 0
    }
    out.push(line)
  }
  return out.join('\n').replace(/\n+$/, '') + '\n'
}

function renderListItem(out: string[], t: MdTopic, depth: number) {
  const pad = '  '.repeat(depth)
  let title = oneLine(t.title)
  const body = oneLine(t.body ?? '')
  if (body) title += `<br>${body}`
  // Как и у заголовка: пункт без текста пишется одним маркером.
  out.push(`${`${pad}- ${title}`.replace(/ +$/, '')}\n`)
  writeAttachments(out, t, pad + '  ')
  for (const c of t.children ?? []) renderListItem(out, c, depth + 1)
}

function writeAttachments(out: string[], t: MdTopic, pad: string) {
  const inList = pad !== ''
  const body = (t.body ?? '').trim()
  if (!inList && body) {
    out.push(body.split('\n').map(escapeBodyLine).join('\n') + '\n\n')
  }
  const notes = (t.notes ?? '').trim()
  if (notes) {
    for (const l of notes.split('\n')) out.push(`${pad}> ${l}\n`)
    out.push('\n')
  }
  const meta = compactMeta(t.meta)
  if (meta) out.push(`${pad}<!-- gmind: ${JSON.stringify(meta)} -->\n\n`)
}

/** Убирает пустые ключи, чтобы в файл не попадали `"shape":""`. */
function compactMeta(meta: MdMeta | undefined): MdMeta | null {
  if (!meta) return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null || v === '' || v === 0 || v === false) continue
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return Object.keys(out).length ? (out as MdMeta) : null
}

function newNode(level: number, title: string, inList: boolean): ParsedNode {
  return {
    level,
    // Заголовок сохраняется как есть, включая пустой: узел без имени —
    // законное состояние карты, и подстановка имени была бы подменой данных.
    topic: { title: title.trim(), children: [] },
    bodyLines: [],
    noteLines: [],
    inList,
  }
}

function splitListItem(s: string): [string, string] {
  const i = s.indexOf('<br>')
  if (i >= 0) return [s.slice(0, i).trim(), s.slice(i + 4).split('<br>').join('\n').trim()]
  return [s, '']
}

function stripFrontMatter(lines: string[]): string[] {
  let i = 0
  while (i < lines.length && !lines[i].trim()) i++
  if (i >= lines.length || !FRONT_DELIM_RE.test(lines[i])) return lines
  for (let j = i + 1; j < lines.length; j++) {
    if (FRONT_DELIM_RE.test(lines[j])) return lines.slice(j + 1)
  }
  return lines
}

function indentWidth(s: string): number {
  let w = 0
  for (const ch of s) w += ch === '\t' ? 2 : 1
  return w
}

// Строка тела, похожая на заголовок/пункт/цитату, экранируется — иначе при
// повторном открытии файла тело узла распалось бы на отдельные узлы.
/**
 * Прочитает ли разбор эту строку как разметку, а не как текст.
 *
 * Хвостовые пробелы и возврат каретки снимаются намеренно: разбор начинает с
 * обрезки /[ \t\r]+$/, а экранирование проверяло строку как есть — на строке
 * «+\r» стороны расходились, и разбор заводил лишний узел там, где рендер
 * маркера не увидел. Одна проверка на обе стороны закрывает класс таких
 * расхождений: сравнивается ровно то, что увидит разбор.
 */
function looksLikeMarkup(s: string): boolean {
  const t = s.replace(/[ \t\r]+$/, '')
  return HEADING_RE.test(t) || LIST_ITEM_RE.test(t) || t.startsWith('>')
}

function escapeBodyLine(l: string): string {
  const t = l.replace(/^[ \t]+/, '')
  if (looksLikeMarkup(t)) {
    return l.slice(0, l.length - t.length) + '\\' + t
  }
  return l
}

function unescapeBodyLine(l: string): string {
  const t = l.replace(/^[ \t]+/, '')
  if (!t.startsWith('\\')) return l
  const rest = t.slice(1)
  if (looksLikeMarkup(rest)) {
    return l.slice(0, l.length - t.length) + rest
  }
  return l
}

function oneLine(s: string): string {
  return String(s ?? '').trim().replace(/\r\n/g, '\n').split('\n').join('<br>')
}
