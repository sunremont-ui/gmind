// Модель «голова + тело»: заголовок узла (title/rich_text) + длинный текст
// (body, plain text с \n). Сплит выполняется при сохранении инлайн-редактора,
// обратная сборка — при входе в редактирование (единый поток текста).

// Первая строка длиннее этого порога переливается в тело.
export const HEAD_MAX_CHARS = 100
// Целевая длина головы при разрезе длинной строки.
const HEAD_CUT_TARGET = 80

export interface HeadBody {
  title: string
  /** HTML головы, если в ней есть форматирование; иначе ''. */
  richText: string
  /** Plain text тела с \n; '' если тела нет. */
  body: string
}

function stripTags(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent || '').trim()
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// contentEditable выдаёт «инлайн-хвост + <div>-блоки» (+ списки). Разбираем
// HTML на сегменты-строки, сохраняя HTML каждого сегмента.
function htmlSegments(html: string): string[] {
  const div = document.createElement('div')
  div.innerHTML = html
  const segs: string[] = []
  let inline = ''
  const flushInline = () => {
    if (stripTags(inline)) segs.push(inline)
    inline = ''
  }
  div.childNodes.forEach(n => {
    const el = n as HTMLElement
    if (n.nodeType === 1 && el.tagName === 'BR') {
      segs.push(inline)
      inline = ''
      return
    }
    if (n.nodeType === 1 && /^(DIV|P|UL|OL)$/.test(el.tagName)) {
      flushInline()
      if (/^(UL|OL)$/.test(el.tagName)) {
        el.querySelectorAll('li').forEach(li => segs.push(li.innerHTML))
      } else {
        segs.push(el.innerHTML)
      }
      return
    }
    inline += n.nodeType === 1 ? el.outerHTML : (n.textContent ?? '')
  })
  flushInline()
  return segs
}

// Точка разреза длинной первой строки: конец предложения в первых 100
// символах, иначе последний пробел до 80-го, иначе жёсткий срез.
function findCut(s: string): number {
  const win = s.slice(0, HEAD_MAX_CHARS)
  const sentence = Math.max(win.lastIndexOf('. '), win.lastIndexOf('! '), win.lastIndexOf('? '))
  if (sentence >= 20) return sentence + 1
  const space = win.slice(0, HEAD_CUT_TARGET).lastIndexOf(' ')
  if (space >= 20) return space
  return HEAD_CUT_TARGET
}

export function splitHeadBody(html: string): HeadBody {
  const segs = htmlSegments(html)
  const plain = segs.map(stripTags)
  while (plain.length && !plain[0]) { plain.shift(); segs.shift() }
  while (plain.length && !plain[plain.length - 1]) { plain.pop(); segs.pop() }
  if (plain.length === 0) return { title: '', richText: '', body: '' }

  let headHtml = segs[0]
  let headPlain = plain[0]
  let bodyParts = plain.slice(1)

  if (headPlain.length > HEAD_MAX_CHARS) {
    const cut = findCut(headPlain)
    bodyParts = [headPlain.slice(cut).trim(), ...bodyParts]
    headPlain = headPlain.slice(0, cut).trim()
    headHtml = '' // при разрезе внутри строки форматирование головы не сохраняем
  }

  const richText = /<[a-z][^>]*>/i.test(headHtml) ? headHtml : ''
  return { title: headPlain, richText, body: bodyParts.join('\n').trim() }
}

/** Собирает HTML для инлайн-редактора из головы и тела (единый поток). */
export function composeEditHtml(topic: { title: string; rich_text?: string; body?: string }): string {
  const head = topic.rich_text || escapeHtml(topic.title)
  if (!topic.body) return head
  const bodyHtml = topic.body
    .split('\n')
    .map(l => `<div>${escapeHtml(l) || '<br>'}</div>`)
    .join('')
  return `<div>${head}</div>${bodyHtml}`
}
