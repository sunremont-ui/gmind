/**
 * Сколько стоит отдать агенту один узел через нынешнее API холста.
 *
 * Повод — первая возможность: адресуемое чтение узла и поддерева. Замер
 * `node-addressing-cost` показал избыточность 23–33x, но мерил Markdown-файлы —
 * то есть чужой носитель. Этот замер задаёт тот же вопрос родному носителю
 * Gmind: настоящим книгам из настоящей базы, отдаваемым тем самым JSON, который
 * возвращает `GET /workbooks/{id}`.
 *
 * ⚠️ Разница принципиальная. Про Markdown можно было возразить: «это ограничение
 * формата, наш собственный носитель устроен лучше». Здесь возражения нет —
 * меряется то, что API отдаёт сегодня.
 *
 * Три носителя — три способа отдать один узел:
 *   книга     — как сегодня: `GET /workbooks/{id}` возвращает книгу целиком,
 *               нужный узел выбирается уже в полученном;
 *   поддерево — узел со всеми потомками: «дай эту ветку»;
 *   узел+путь — узел плюс цепочка предков без их прочих детей: минимум, при
 *               котором видно, частью чего узел является.
 *
 * ⚠️ Мерятся байты сериализованного JSON — ровно то, что уходит по проводу. Не
 * «логический размер узла»: у узла Gmind 40 полей, и накладные расходы самой
 * сериализации входят в цену честно, для всех трёх носителей одинаково.
 *
 * ⚠️ `GET /workbooks/{id}` отдаёт всю книгу со всеми листами; замер считает по
 * листу, к которому принадлежит узел. Это ЗАНИЖЕНИЕ цены нынешнего носителя —
 * настоящий ответ API не меньше посчитанного. Занижать в пользу проверяемого
 * тезиса правильнее, чем завышать.
 *
 * Что замер НЕ говорит: как адресовать узел (путь, id, запрос) и сколько стоит
 * такая адресация в реализации. Он называет только выигрыш, ради которого её
 * стоило бы делать.
 *
 * Запуск: node lab-run.mjs labs/canvas-read-cost.lab.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';

/**
 * Базы — ДАННЫЕ: те же три, что в map-roundtrip-loss. Книги берутся из всех и
 * раскладываются по размеру: замер о том, как цена зависит от величины книги, а
 * не о том, в какой базе книга лежит.
 */
const DATABASES = [
  'C:/Users/PollStakana/AppData/Roaming/gmind/gmind.db',
  'C:/Users/PollStakana/AppData/Roaming/com.gmind.app/gmind.db',
  'D:/Gmind/gmind/frontend/src-tauri/gmind.db',
];

/**
 * Разряды книг по числу узлов. Разряд, а не отдельная книга: имена книг
 * машинно-локальны и завтра будут другими, а зависимость цены от величины
 * останется. Границы выбраны по фактическому распределению: 15 книг этой машины
 * лежат от 1 до 341 узла.
 */
const CASES = [
  { id: 'до-10', min: 1, max: 9, purpose: 'заметка на несколько узлов' },
  { id: '10-50', min: 10, max: 49, purpose: 'рабочая карта' },
  { id: '50-200', min: 50, max: 199, purpose: 'проработанная тема' },
  { id: '200+', min: 200, max: Infinity, purpose: 'крупная карта: 341 узел — максимум на этой машине' },
];

const VARIANTS = [
  { id: 'книга', mode: 'sheet' },
  { id: 'поддерево', mode: 'subtree' },
  { id: 'узел+путь', mode: 'node+path' },
];

const bytes = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');

/** Узел без потомков — то, что осталось бы от него в ответе «дай узел». */
function bare(topic) {
  const { children, ...rest } = topic;
  return rest;
}

/**
 * Обход листа: для каждого узла — три величины в байтах. Путь предков строится
 * по ходу спуска, поэтому обход один.
 */
function measureSheet(root, out) {
  const sheetBytes = bytes(root);
  const walk = (topic, ancestors) => {
    const own = bytes(bare(topic));
    const path = ancestors.reduce((sum, a) => sum + a, 0);
    out.sheet.push(sheetBytes);
    out.subtree.push(bytes(topic));
    out['node+path'].push(own + path);
    out.own.push(own);
    for (const child of (topic.children ?? [])) walk(child, [...ancestors, own]);
  };
  walk(root, []);
}

function countNodes(topic) {
  return 1 + (topic.children ?? []).reduce((sum, c) => sum + countNodes(c), 0);
}

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const kb = (value) => (value / 1024).toFixed(2);

export default {
  id: 'canvas-read-cost',
  question:
    'Сколько байт уходит по проводу, чтобы отдать один узел карты, когда единственный '
    + 'способ чтения — забрать книгу целиком, и как это меняется с величиной книги. '
    + 'Ответ «да» — по каждому разряду книг названа медианная цена узла на трёх носителях '
    + 'и кратность избыточности нынешнего.',

  cases: CASES,
  variants: VARIANTS,
  order: 'case-major',
  columns: [
    { key: 'книг', title: 'книг', width: 6 },
    { key: 'узлов', title: 'узлов', width: 7 },
    { key: 'медиана', title: 'медиана', width: 9 },
    { key: 'изб.', title: 'изб.', width: 7 },
    { key: 'на узел', title: 'на 100 узлов', width: 13 },
  ],
  needsBackend: false,
  gate: false,

  async setup(ctx) {
    const buckets = new Map(CASES.map((c) => [c.id, {
      books: 0, sheet: [], subtree: [], 'node+path': [], own: [],
    }]));
    let booksTotal = 0;
    let missing = 0;

    for (const db of DATABASES) {
      if (!existsSync(db)) { missing++; continue; }
      const conn = new DatabaseSync(db, { readOnly: true });
      let rows;
      try {
        rows = conn.prepare('select data from workbooks').all();
      } finally {
        conn.close();
      }
      for (const row of rows) {
        const book = JSON.parse(row.data);
        for (const sheet of (book.sheets ?? [])) {
          const root = sheet.root_topic;
          if (!root) continue;
          const nodes = countNodes(root);
          const kase = CASES.find((c) => nodes >= c.min && nodes <= c.max);
          if (!kase) continue;
          const bucket = buckets.get(kase.id);
          bucket.books++;
          booksTotal++;
          measureSheet(root, bucket);
        }
      }
    }

    for (const kase of CASES) {
      const bucket = buckets.get(kase.id);
      if (!bucket.sheet.length) {
        ctx.log(`  ${kase.id}: книг этого разряда на машине нет`);
        continue;
      }
      ctx.log(
        `  ${kase.id}: ${bucket.books} листов · ${bucket.sheet.length} узлов · `
        + `медиана узла ${kb(median(bucket.own))} КБ · медиана листа ${kb(median(bucket.sheet))} КБ`,
      );
    }
    if (missing) ctx.log(`  баз не найдено: ${missing} из ${DATABASES.length}`);
    ctx.log(`  всего листов в замере: ${booksTotal}`);
    return { buckets };
  },

  async run(kase, variant, ctx) {
    const bucket = ctx.buckets.get(kase.id);
    if (!bucket || !bucket.sheet.length) {
      return {
        ok: true,
        note: 'книг этого разряда нет',
        metrics: { 'книг': 0, 'узлов': 0, 'медиана': '—', 'изб.': '—', 'на узел': '—' },
        keep: { median: null, ratio: null },
      };
    }
    const med = median(bucket[variant.mode]);
    // Основание — медиана САМОГО узла без потомков и без предков: то, что
    // требовалось отдать. Носитель «узел+путь» от неё отличается ценой контекста.
    const baseline = median(bucket.own);
    const ratio = baseline ? med / baseline : 0;
    return {
      ok: true,
      note: `${bucket.books} листов, узел без обвязки — ${kb(baseline)} КБ`,
      metrics: {
        'книг': bucket.books,
        'узлов': bucket.sheet.length,
        'медиана': `${kb(med)} КБ`,
        'изб.': `${ratio.toFixed(1)}x`,
        'на узел': `${((med * 100) / 1024).toFixed(0)} КБ`,
      },
      keep: { median: med, ratio: Number(ratio.toFixed(2)), baseline, mode: variant.mode },
    };
  },

  /**
   * Судится только носитель «книга» — тот, что работает сегодня. Порог тот же,
   * что в node-addressing-cost: двукратная избыточность. Одинаковый порог на
   * обоих замерах не совпадение и не лень — вопрос один и тот же («дороже ли
   * прочитать лишнее, чем сходить ещё раз»), и разные пороги сделали бы замеры
   * несравнимыми.
   */
  async oracle(result, kase, variant, ctx) {
    if (result.keep.median === null) {
      return { matched: null, note: 'вердикта нет: книг этого разряда на машине нет' };
    }
    if (variant.mode !== 'sheet') {
      return { matched: null, note: 'носитель задаёт шкалу, вердикт выносится только по «книге»' };
    }
    const cheap = result.keep.ratio <= 2;
    return {
      matched: cheap ? 1 : 0,
      expected: 1,
      note: cheap
        ? `книга целиком обходится в ${result.keep.ratio}x от нужного узла`
        : `чтобы отдать узел, по проводу уходит в ${result.keep.ratio}x больше`,
    };
  },

  /**
   * Итог — то, ради чего разряды и заведены: избыточность растёт вместе с
   * книгой. Это превращает вопрос из «сколько мы теряем сейчас» в «во что это
   * обойдётся, когда карты вырастут», а замер code-symbol-granularity назвал
   * величину роста: 131 693 узла только от кода рабочего поля.
   */
  async teardown(ctx) {
    const PROJECTED_NODES = 131693;
    let ownAll = [];
    for (const kase of CASES) {
      const bucket = ctx.buckets.get(kase.id);
      if (!bucket?.sheet.length) continue;
      ownAll = ownAll.concat(bucket.own);
      ctx.log(
        `  ${kase.id.padEnd(8)} узел ${kb(median(bucket.own)).padStart(6)} КБ · `
        + `+путь ${kb(median(bucket['node+path'])).padStart(6)} КБ · `
        + `поддерево ${kb(median(bucket.subtree)).padStart(8)} КБ · `
        + `книга ${kb(median(bucket.sheet)).padStart(8)} КБ`,
      );
    }
    const perNode = median(ownAll);
    ctx.log(
      `  проекция: книга из ${PROJECTED_NODES} узлов (весь код рабочего поля по code-symbol-granularity) `
      + `весила бы ${((perNode * PROJECTED_NODES) / 1048576).toFixed(0)} МБ — столько уходило бы на каждое чтение одного узла`,
    );
  },
};
