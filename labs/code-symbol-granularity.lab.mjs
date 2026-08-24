/**
 * Годится ли исходный код источником узлов холста — и какой ценой.
 *
 * Повод — вторая возможность: расширить структурный вход за пределы Markdown.
 * Замер `workspace-reach` показал, что слепое пятно концентрированное: пять
 * расширений (.ts, .json, .rs, .tsx, .py) дают 80% его объёма. Но «уметь читать
 * файл» и «получить пригодные узлы» — разные вещи, и разница здесь численная:
 * узел кода должен лечь на холст в том же порядке величины, что узел Markdown
 * (0.2–0.7 КБ по замеру node-addressing-cost), иначе холст получит либо простыни
 * текста, либо пыль из сотен крошек на файл.
 *
 * Два носителя — два ответа на «во что превращается файл кода»:
 *   файл   — как сегодня, если бы Gmind просто открыл его текстом: один узел;
 *   символ — объявление верхнего уровня со своим телом: функция, тип, класс.
 *
 * ⚠️ Разбор — по объявлениям НУЛЕВОГО ОТСТУПА, а не полноценным AST. Это
 * сознательное упрощение с известной ценой: вложенные методы класса в один
 * узел с классом попадут, а объявление, перенесённое на отступ (продолжение
 * строки, код внутри условной компиляции), будет пропущено. Строить настоящий
 * разбор четырёх языков внутри замера значило бы писать четыре парсера, каждый
 * со своими дефектами, и проверять их было бы нечем.
 *
 * ⚠️ Поэтому замер меряет СЕБЯ: `покрытие` — доля непустых строк файла, попавших
 * хоть в какой-нибудь символ. Это прямая оценка качества разбора: при 90%+
 * объявления найдены и цифрам можно верить, при 40% регулярка прошла мимо и
 * медиана символа говорит о дефекте разбора, а не о коде. Без этой колонки
 * замер выдавал бы уверенные числа неизвестной осмысленности.
 *
 * ⚠️ .json в разбор НЕ включён, хотя он второй по объёму в слепом пятне: у него
 * нет объявлений, его структура — само дерево, и он требует не этого разбора, а
 * прямого отображения. Записать его сюда значило бы мерить одно, а называть другим.
 *
 * Что замер НЕ говорит: полезны ли такие узлы человеку. Он отвечает только на
 * вопрос размера — влезает ли код в ту же гранулярность, что уже работает.
 *
 * Запуск: node lab-run.mjs labs/code-symbol-granularity.lab.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

/** Те же рабочие каталоги, что в workspace-reach: замер о том же поле. */
const ROOTS = [
  'D:/Gmind', 'E:/MASys', 'D:/projectService', 'D:/karp', 'D:/treiding', 'D:/newAiInstruments',
];

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'target', 'dist', 'build', '.next', 'venv', '.venv',
  '__pycache__', '.cache', 'vendor', 'coverage', '.turbo', 'out', 'bin', 'obj',
  '.gradle', '.idea', '.vs', '.svelte-kit', 'site-packages', '.pnpm-store',
]);

/**
 * Языки — ДАННЫЕ: расширение, счёт файлов из workspace-reach на 2026-08-24 и
 * образец объявления верхнего уровня. Счёт записан здесь, чтобы расхождение с
 * найденным сейчас было видно в одной строке: замер и предыдущий замер должны
 * говорить об одном и том же поле.
 */
const CASES = [
  {
    id: 'typescript',
    exts: ['.ts'],
    knownFiles: 9015,
    purpose: 'крупнейший класс слепого пятна',
    decl: /^(export\s+)?(default\s+)?(declare\s+)?(abstract\s+)?(async\s+)?(function|class|interface|type|const|let|var|enum|namespace|module)\s/,
  },
  {
    id: 'tsx',
    exts: ['.tsx'],
    knownFiles: 2793,
    purpose: 'компоненты интерфейса',
    decl: /^(export\s+)?(default\s+)?(declare\s+)?(abstract\s+)?(async\s+)?(function|class|interface|type|const|let|var|enum|namespace|module)\s/,
  },
  {
    id: 'rust',
    /**
     * ⚠️ `use` и `#[…]` из образца ИСКЛЮЧЕНЫ, и это исправление по результату
     * первого прогона, а не изначальная осторожность. С ними Rust дал 29.5
     * «символов» на файл при медиане 0.05 КБ: каждая строка импорта и каждый
     * атрибут становились отдельным узлом, и замер описывал не код, а собственный
     * разбор. Атрибут вдобавок не объявление, а его предисловие — начиная на нём
     * новый символ, разбор отрывал `#[derive(…)]` от структуры, к которой он относится.
     *
     * Урок шире одного языка: колонка `покрытие` ловит разбор, прошедший МИМО
     * объявлений, но передробление в пыль она не ловит — там покрытие как раз
     * стопроцентное. Вторым сторожем работает проверка медианы в оракуле.
     */
    exts: ['.rs'],
    knownFiles: 3661,
    purpose: 'десктопная обёртка и системный код',
    decl: /^(pub(\([^)]*\))?\s+)?(async\s+)?(unsafe\s+)?(fn|struct|enum|impl|trait|mod|const|static|type|macro_rules!)\b/,
  },
  {
    id: 'python',
    exts: ['.py'],
    knownFiles: 1179,
    purpose: 'модули платформы и скрипты',
    decl: /^(@|def\s|class\s|async\s+def\s)/,
  },
  {
    id: 'go',
    exts: ['.go'],
    knownFiles: 100,
    purpose: 'бэкенд самого Gmind — язык, где разбор нулевого отступа точнее всего',
    decl: /^(func|type|var|const)\s/,
  },
];

const VARIANTS = [
  { id: 'файл', mode: 'file' },
  { id: 'символ', mode: 'symbol' },
];

/** Файлы крупнее этого в разбор не идут: сгенерированные простыни исказят медиану. */
const MAX_FILE_BYTES = 512 * 1024;

async function collect(dir, exts, acc) {
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
      await collect(join(dir, entry.name), exts, acc);
      continue;
    }
    if (entry.isFile() && exts.includes(extname(entry.name).toLowerCase())) {
      acc.push(join(dir, entry.name));
    }
  }
  return acc;
}

/**
 * Разбор файла на символы. Символ начинается на строке объявления нулевого
 * отступа и тянется до следующего такого объявления. Строки до первого
 * объявления (импорты, шапка) символом не считаются — они и не адресуемы.
 *
 * Строки внутри ``` и /* … *\/ игнорируются как источники объявлений: комментарий
 * с примером кода иначе порождает фиктивные символы и мельчит медиану.
 */
function parseSymbols(text, decl) {
  const lines = text.split(/\r?\n/);
  const symbols = [];
  let current = null;
  let inBlockComment = false;
  let covered = 0;
  let nonEmpty = 0;

  for (const line of lines) {
    const trimmedEnd = line.trimEnd();
    if (trimmedEnd) nonEmpty++;

    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      if (current) { current.bytes += Buffer.byteLength(line, 'utf8') + 1; if (trimmedEnd) covered++; }
      continue;
    }
    if (/^\s*\/\*/.test(line) && !line.includes('*/')) inBlockComment = true;

    const zeroIndent = line.length > 0 && line[0] !== ' ' && line[0] !== '\t';
    if (zeroIndent && decl.test(line)) {
      if (current) symbols.push(current);
      current = { bytes: Buffer.byteLength(line, 'utf8') + 1 };
      if (trimmedEnd) covered++;
      continue;
    }
    if (current) {
      current.bytes += Buffer.byteLength(line, 'utf8') + 1;
      if (trimmedEnd) covered++;
    }
  }
  if (current) symbols.push(current);
  return { symbols, covered, nonEmpty };
}

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const kb = (bytes) => (bytes / 1024).toFixed(2);

export default {
  id: 'code-symbol-granularity',
  question:
    'Ложится ли исходный код на холст в той же гранулярности, что Markdown: сколько '
    + 'узлов даёт файл кода, каков медианный размер такого узла и сколько узлов появится '
    + 'на всём рабочем поле. Ответ «да» — по каждому языку названы медиана символа, '
    + 'символов на файл и доля строк, которую разбор вообще увидел.',

  cases: CASES,
  variants: VARIANTS,
  order: 'case-major',
  columns: [
    { key: 'файлов', title: 'файлов', width: 7 },
    { key: 'узлов', title: 'узлов', width: 8 },
    { key: 'на файл', title: 'на файл', width: 8 },
    { key: 'медиана', title: 'медиана', width: 9 },
    { key: 'покрытие', title: 'покрытие', width: 9 },
  ],
  needsBackend: false,
  gate: false,

  async setup(ctx) {
    const langs = new Map();
    for (const kase of CASES) {
      const startedAt = Date.now();
      const files = [];
      for (const root of ROOTS) await collect(root, kase.exts, files);

      const symbolSizes = [];
      const fileSizes = [];
      let symbolsTotal = 0;
      let covered = 0;
      let nonEmpty = 0;
      let skippedBig = 0;
      let noSymbols = 0;

      for (const path of files) {
        let text;
        try { text = await readFile(path, 'utf8'); } catch { continue; }
        const bytes = Buffer.byteLength(text, 'utf8');
        if (bytes > MAX_FILE_BYTES) { skippedBig++; continue; }
        fileSizes.push(bytes);
        const parsed = parseSymbols(text, kase.decl);
        covered += parsed.covered;
        nonEmpty += parsed.nonEmpty;
        if (!parsed.symbols.length) { noSymbols++; continue; }
        symbolsTotal += parsed.symbols.length;
        for (const s of parsed.symbols) symbolSizes.push(s.bytes);
      }

      langs.set(kase.id, {
        files: fileSizes.length, symbolSizes, fileSizes, symbolsTotal,
        covered, nonEmpty, skippedBig, noSymbols, knownFiles: kase.knownFiles,
      });

      const drift = kase.knownFiles ? fileSizes.length - kase.knownFiles : 0;
      ctx.log(
        `  ${kase.id}: ${fileSizes.length} файлов${drift ? ` (в workspace-reach было ${kase.knownFiles}, разница ${drift > 0 ? '+' : ''}${drift})` : ''}`
        + ` → ${symbolsTotal} символов за ${((Date.now() - startedAt) / 1000).toFixed(1)}с`
        + `${noSymbols ? ` · без объявлений ${noSymbols}` : ''}`
        + `${skippedBig ? ` · пропущено крупных ${skippedBig}` : ''}`,
      );
    }
    return { langs };
  },

  async run(kase, variant, ctx) {
    const lang = ctx.langs.get(kase.id);
    if (!lang || !lang.files) {
      return {
        ok: true,
        note: 'файлов языка не нашлось',
        metrics: { 'файлов': 0, 'узлов': '—', 'на файл': '—', 'медиана': '—', 'покрытие': '—' },
        keep: { median: null, perFile: null },
      };
    }
    const coverage = lang.nonEmpty ? (lang.covered / lang.nonEmpty) * 100 : 0;

    if (variant.mode === 'file') {
      return {
        ok: true,
        note: 'файл как один узел — то, что вышло бы при простом открытии текстом',
        metrics: {
          'файлов': lang.files,
          'узлов': lang.files,
          'на файл': '1.0',
          'медиана': `${kb(median(lang.fileSizes))} КБ`,
          'покрытие': '100%',
        },
        keep: { median: median(lang.fileSizes), perFile: 1, nodes: lang.files, coverage: 100 },
      };
    }

    const med = median(lang.symbolSizes);
    const perFile = lang.files ? lang.symbolsTotal / lang.files : 0;
    return {
      ok: true,
      note: `${lang.noSymbols} файлов не дали ни одного объявления`,
      metrics: {
        'файлов': lang.files,
        'узлов': lang.symbolsTotal,
        'на файл': perFile.toFixed(1),
        'медиана': `${kb(med)} КБ`,
        'покрытие': `${coverage.toFixed(0)}%`,
      },
      keep: {
        median: med, perFile: Number(perFile.toFixed(1)),
        nodes: lang.symbolsTotal, coverage: Number(coverage.toFixed(0)),
      },
    };
  },

  /**
   * Судится только носитель «символ», и условие двойное: медиана узла должна
   * попасть в диапазон, в котором уже работает Markdown-узел (0.1–2.0 КБ), И
   * разбор должен видеть не меньше 80% непустых строк. Второе условие обязательно:
   * медиана, снятая разбором, прошедшим мимо половины файла, описывает не код, а
   * промах регулярки, и без проверки покрытия замер уверенно врал бы.
   */
  async oracle(result, kase, variant, ctx) {
    if (result.keep.median === null) {
      return { matched: null, note: 'вердикта нет: файлов языка не нашлось' };
    }
    if (variant.mode !== 'symbol') {
      return { matched: null, note: 'носитель «файл» задаёт шкалу, вердикт выносится по «символу»' };
    }
    const sized = result.keep.median >= 100 && result.keep.median <= 2048;
    const trusted = result.keep.coverage >= 80;
    return {
      matched: sized && trusted ? 1 : 0,
      expected: 1,
      note: !trusted
        ? `разбор увидел лишь ${result.keep.coverage}% строк: медиане ${kb(result.keep.median)} КБ верить нельзя`
        : sized
          ? `медиана символа ${kb(result.keep.median)} КБ — та же гранулярность, что у узла Markdown`
          : `медиана символа ${kb(result.keep.median)} КБ вне рабочего диапазона узла холста`,
    };
  },

  /**
   * Итог — цена вопроса в узлах: сколько их появится на холсте, если пустить код
   * внутрь. Сравнивать это не с чем, кроме нынешней загрузки холста, поэтому она
   * названа прямо: 802 узла во всех книгах пользователя на 2026-08-24.
   */
  async teardown(ctx) {
    const CURRENT_NODES = 802;
    let symbols = 0;
    let files = 0;
    for (const kase of CASES) {
      const lang = ctx.langs.get(kase.id);
      if (!lang) continue;
      symbols += lang.symbolsTotal;
      files += lang.files;
    }
    ctx.log(
      `  весь код рабочего поля: ${files} файлов → ${symbols} узлов при разборе по символам `
      + `(файлами было бы ${files})`,
    );
    ctx.log(
      `  сейчас во всех книгах пользователя ${CURRENT_NODES} узлов — код превышает это `
      + `в ${(symbols / CURRENT_NODES).toFixed(0)} раз, и это вопрос не формата, а раскладки и рендера`,
    );
  },
};
