/**
 * Сколько лишнего приходится прочесть, чтобы добраться до одного узла, когда
 * единицей хранения является файл, а не узел.
 *
 * Повод — вторая половина заявки: «свои форматы файлов для построения структур,
 * более удобных для быстрой памяти агентов». Замер `workspace-reach` показал, что
 * структурно Gmind открывает фактически один формат — Markdown. Этот замер
 * спрашивает о том же Markdown другое: годится ли ФАЙЛ как единица памяти агента,
 * или единицей обязан стать узел.
 *
 * Величина — избыточность чтения: во сколько раз больше байт нужно взять, чем
 * весит сам искомый узел. Она реальная с обеих сторон: и размер файла, и размер
 * узла извлекаются из тех же файлов на диске тем же разбором заголовков, каким
 * карту строит `internal/markdown`. Ничего гипотетического здесь не измеряется.
 *
 * ⚠️ Три носителя — три способа отдать агенту ОДИН И ТОТ ЖЕ узел:
 *   файл        — как сегодня: `/md/open` читает .md целиком, узел выбирается
 *                 уже внутри прочитанного;
 *   узел+предки — узел плюс цепочка заголовков над ним: минимум, при котором
 *                 ответ остаётся осмысленным (видно, частью чего он является);
 *   узел        — только собственный текст узла, без всякого контекста.
 * Разница между вторым и третьим — цена контекста, и она отдельно интересна:
 * если она мала, адресация по узлам ничего не теряет.
 *
 * ⚠️ Меряются БАЙТЫ, не токены: токенизатор в этом контуре не запускается, а
 * подстановка коэффициента «байт на токен» превратила бы замер в пересчёт
 * догадки. Для русско-английской смеси порядок величины сохраняется, отношение
 * между носителями — тем более: оно от единицы измерения не зависит.
 *
 * Что замер НЕ говорит: каким должен быть новый формат. Он называет цену
 * нынешней единицы хранения — то есть сколько выиграет любая адресация по узлам,
 * чем бы она ни была реализована.
 *
 * Запуск: node lab-run.mjs labs/node-addressing-cost.lab.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

/**
 * Корпуса — ДАННЫЕ: каталоги, где Markdown является рабочим материалом, а не
 * побочным README. Взяты те, что в `workspace-reach` показали заметную долю
 * уровня «карта»: мерить избыточность там, где Markdown почти нет, нечего.
 */
const CASES = [
  { id: 'karp', dir: 'D:/karp', purpose: 'исследование памяти: 911 .md, 80.8% корпуса' },
  { id: 'gmind-wiki', dir: 'D:/Gmind/wikiAlgoritm', purpose: 'вики самого холста' },
  { id: 'ai-platform', dir: 'D:/treiding', purpose: 'платформа модулей: .skills и wiki' },
  { id: 'masys-docs', dir: 'E:/MASys/docs', purpose: 'документация системы агентов' },
  { id: 'projectService', dir: 'D:/projectService', purpose: 'записи мастера, пришедшие из поля' },
];

const VARIANTS = [
  { id: 'файл', mode: 'file' },
  { id: 'узел+предки', mode: 'node+path' },
  { id: 'узел', mode: 'node' },
];

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'target', 'dist', 'build', '.next', 'venv', '.venv',
  '__pycache__', '.cache', 'vendor', 'coverage', '.turbo', 'out', '.idea', '.vs',
]);

const MD_EXT = new Set(['.md', '.markdown']);

/** Файл великоват для памяти узла — но именно такие и создают избыточность. */
const MAX_FILE_BYTES = 2 << 20;

async function collectMarkdown(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await collectMarkdown(join(dir, entry.name), acc);
      continue;
    }
    if (entry.isFile() && MD_EXT.has(extname(entry.name).toLowerCase())) {
      acc.push(join(dir, entry.name));
    }
  }
  return acc;
}

/**
 * Разбор файла на узлы по ATX-заголовкам — та же модель «голова + тело», по
 * которой карту строит бэкенд: заголовок становится головой узла, строки до
 * следующего заголовка ЛЮБОГО уровня — его телом. Текст под вложенным
 * заголовком телом родителя не считается: это отдельный узел, и приписать его
 * родителю значило бы занизить избыточность ровно на величину вложенности.
 *
 * ⚠️ Заголовки внутри ``` не заголовки. Без этого любой файл с фрагментом
 * shell-кода (`# комментарий`) разваливается на десятки фиктивных узлов, а
 * средний узел искусственно мельчает — то есть замер завысил бы выигрыш от
 * адресации, причём тем сильнее, чем техничнее корпус.
 */
function parseNodes(text) {
  const lines = text.split(/\r?\n/);
  const nodes = [];
  let current = null;
  let inFence = false;
  let fenceMark = '';
  // Путь заголовков над текущим узлом: [{level, bytes}] для уровней 1..6.
  const stack = [];

  const close = () => {
    if (current) nodes.push(current);
  };

  for (const line of lines) {
    const fence = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      if (!inFence) { inFence = true; fenceMark = fence[1]; }
      else if (line.trimStart().startsWith(fenceMark)) { inFence = false; }
    }
    const heading = !inFence && /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      close();
      const level = heading[1].length;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      const pathBytes = stack.reduce((sum, h) => sum + h.bytes, 0);
      const headBytes = Buffer.byteLength(line, 'utf8') + 1;
      stack.push({ level, bytes: headBytes });
      current = { level, ownBytes: headBytes, pathBytes };
      continue;
    }
    if (current) current.ownBytes += Buffer.byteLength(line, 'utf8') + 1;
  }
  close();

  // Преамбула до первого заголовка узлом не считается: у неё нет головы, и
  // адресовать её по имени всё равно нельзя — это свойство самого Markdown.
  return nodes;
}

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const kb = (bytes) => (bytes / 1024).toFixed(2);

export default {
  id: 'node-addressing-cost',
  question:
    'Во сколько раз больше байт приходится прочесть, чтобы отдать агенту один узел, '
    + 'когда единица хранения — Markdown-файл, а не узел. Ответ «да» — по каждому корпусу '
    + 'названы медианный размер узла, медианный размер читаемого куска на каждом из трёх '
    + 'носителей и кратность избыточности.',

  cases: CASES,
  variants: VARIANTS,
  // Разбор корпуса — единственная дорогая часть; три носителя читают один разбор.
  order: 'case-major',
  columns: [
    { key: 'узлов', title: 'узлов', width: 7 },
    { key: 'медиана', title: 'медиана', width: 9 },
    { key: 'среднее', title: 'среднее', width: 9 },
    { key: 'изб.', title: 'изб.', width: 7 },
    { key: 'на 1000', title: 'на 1000 узлов', width: 14 },
  ],
  needsBackend: false,
  gate: false,

  /** Разбор всех корпусов — здесь, по одному разу. */
  async setup(ctx) {
    const corpora = new Map();
    for (const kase of CASES) {
      const startedAt = Date.now();
      const files = await collectMarkdown(kase.dir);
      // Для каждого узла — три величины в байтах: сам узел, узел с путём
      // заголовков и файл, из которого его пришлось бы читать целиком.
      const samples = { node: [], 'node+path': [], file: [] };
      let skippedBig = 0;
      let emptyFiles = 0;
      for (const path of files) {
        let text;
        try { text = await readFile(path, 'utf8'); } catch { continue; }
        const fileBytes = Buffer.byteLength(text, 'utf8');
        if (fileBytes > MAX_FILE_BYTES) { skippedBig++; continue; }
        const nodes = parseNodes(text);
        if (!nodes.length) { emptyFiles++; continue; }
        for (const node of nodes) {
          samples.node.push(node.ownBytes);
          samples['node+path'].push(node.ownBytes + node.pathBytes);
          samples.file.push(fileBytes);
        }
      }
      corpora.set(kase.id, { samples, files: files.length, skippedBig, emptyFiles });
      ctx.log(
        `  ${kase.id}: ${files.length} файлов .md → ${samples.node.length} узлов за `
        + `${((Date.now() - startedAt) / 1000).toFixed(1)}с`
        + `${emptyFiles ? ` · без заголовков ${emptyFiles}` : ''}`
        + `${skippedBig ? ` · пропущено крупных ${skippedBig}` : ''}`,
      );
    }
    return { corpora };
  },

  async run(kase, variant, ctx) {
    const corpus = ctx.corpora.get(kase.id);
    const values = corpus?.samples[variant.mode] ?? [];
    if (!values.length) {
      return {
        ok: true,
        note: 'узлов не нашлось: в корпусе нет Markdown с заголовками',
        metrics: { 'узлов': 0, 'медиана': '—', 'среднее': '—', 'изб.': '—', 'на 1000': '—' },
        keep: { median: null, ratio: null },
      };
    }
    const med = median(values);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    // Избыточность считается от медианы САМОГО узла — от того, что реально
    // требовалось. Для носителя «узел» она равна 1 по построению, и это не
    // тавтология, а нижняя граница шкалы, к которой относятся два остальных.
    const baseline = median(corpus.samples.node);
    const ratio = baseline ? med / baseline : 0;
    return {
      ok: true,
      note: `${corpus.files} файлов .md в корпусе`,
      metrics: {
        'узлов': values.length,
        'медиана': `${kb(med)} КБ`,
        'среднее': `${kb(mean)} КБ`,
        'изб.': `${ratio.toFixed(1)}x`,
        'на 1000': `${((med * 1000) / 1048576).toFixed(1)} МБ`,
      },
      keep: { median: med, mean, ratio: Number(ratio.toFixed(2)), mode: variant.mode },
    };
  },

  /**
   * Судится ровно одно и только на носителе «файл»: остаётся ли избыточность в
   * пределах двукратной. Порог не взят с потолка — это граница, за которой
   * попытка набрать контекст из нескольких узлов начинает стоить агенту больше,
   * чем сами узлы, и выбор «прочесть лишнее» перестаёт быть дешевле выбора
   * «сходить ещё раз». Носители «узел» и «узел+предки» — шкала, к которой
   * относится вердикт, и своего вердикта не получают.
   */
  async oracle(result, kase, variant, ctx) {
    if (result.keep.median === null) {
      return { matched: null, note: 'вердикта нет: узлов в корпусе не найдено' };
    }
    if (variant.mode !== 'file') {
      return { matched: null, note: 'носитель задаёт шкалу, вердикт выносится только по «файлу»' };
    }
    const cheap = result.keep.ratio <= 2;
    return {
      matched: cheap ? 1 : 0,
      expected: 1,
      note: cheap
        ? `чтение файла целиком обходится в ${result.keep.ratio}x от нужного узла`
        : `чтобы отдать узел, читается в ${result.keep.ratio}x больше: файл как единица памяти дорог`,
    };
  },

  /**
   * Итог: цена контекста отдельно от цены файла. Если «узел+предки» почти равен
   * «узлу», то весь проигрыш носителя «файл» — чистые накладные расходы, и
   * адресация по узлам не теряет ничего, кроме них.
   */
  async teardown(ctx) {
    for (const kase of CASES) {
      const corpus = ctx.corpora.get(kase.id);
      if (!corpus?.samples.node.length) continue;
      const node = median(corpus.samples.node);
      const withPath = median(corpus.samples['node+path']);
      const file = median(corpus.samples.file);
      ctx.log(
        `  ${kase.id.padEnd(16)} узел ${kb(node).padStart(7)} КБ · с предками ${kb(withPath).padStart(7)} КБ `
        + `(+${(((withPath - node) / node) * 100).toFixed(0)}%) · файл ${kb(file).padStart(8)} КБ `
        + `(${(file / node).toFixed(1)}x)`,
      );
    }
    ctx.log('  цена контекста — надбавка «с предками»; всё, что сверх неё в носителе «файл», выигрывается адресацией по узлам');
  },
};
