/**
 * Что из рабочего материала пользователя Gmind сегодня способен открыть.
 *
 * Повод — заявка на смену роли: Gmind перестал быть блокнотом для быстрых записок
 * и должен стать визуальным центром над всеми проектами, вплоть до собственных
 * форматов файлов под быструю память агентов. Прежде чем проектировать новые
 * форматы, замер устанавливает исходную величину: какая доля того, с чем человек
 * реально работает, вообще попадает на холст.
 *
 * ⚠️ Три уровня доступа — не оценка «хорошо/плохо», а три РАЗНЫХ ответа на вопрос
 * «что Gmind делает с этим файлом»:
 *   карта    — файл превращается в структуру узлов и правится на холсте
 *              (.md/.markdown через /md/open, .xmind через /workbooks/import);
 *   вложение — байты можно положить в /api/v1/files и показать (картинка, pdf,
 *              звук): видно, но не структура, редактировать нечего;
 *   слепое   — ни структуры, ни просмотра: файла для холста не существует.
 *
 * ⚠️ `/import-json` в список структурных входов НЕ входит намеренно. Он принимает
 * не .json-файл с диска, а строку `data` в теле запроса и кладёт её в
 * `Sheet.ImportedData` — это перенос произвольных данных, а не разбор формата.
 * Записать его в «карту» значило бы завысить охват на целый класс файлов.
 *
 * Две метрики, и расходятся они сильно: доля ФАЙЛОВ говорит, сколько предметов
 * работы недоступно, доля БАЙТ — сколько весит недоступное. Корпус с одним
 * дампом на гигабайт и сотней заметок по килобайту даст противоположные ответы,
 * и оба верные. Судится доля файлов: на холст кладут предметы, а не байты.
 *
 * Что замер НЕ говорит: нужен ли собственный формат и каким ему быть. Он называет
 * размер и состав слепого пятна — то есть цену вопроса, а не ответ на него.
 *
 * Запуск: node lab-run.mjs labs/workspace-reach.lab.mjs
 */
import { readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

/**
 * Корпуса — ДАННЫЕ: реальные рабочие каталоги на этой машине. Взяты те, где идёт
 * работа, а не всё содержимое дисков: замер о рабочем материале, а не о диске.
 */
const CASES = [
  { id: 'gmind', dir: 'D:/Gmind', purpose: 'сам холст: Go + React + Tauri, вики, лабы' },
  { id: 'masys', dir: 'E:/MASys', purpose: 'система агентов и память, к которой Gmind — холст' },
  { id: 'projectService', dir: 'D:/projectService', purpose: 'мост записей мастера в память' },
  { id: 'karp', dir: 'D:/karp', purpose: 'исследование видов памяти — источник онтологии' },
  { id: 'ai-platform', dir: 'D:/treiding', purpose: 'платформа модулей и .skills' },
  { id: 'newAiInstruments', dir: 'D:/newAiInstruments', purpose: 'мелкие инструменты' },
];

const VARIANTS = [
  { id: 'карта', level: 'map' },
  { id: 'вложение', level: 'blob' },
  { id: 'слепое', level: 'blind' },
];

/**
 * Расширения, которые Gmind разбирает в структуру холста. Список короткий не по
 * недосмотру автора замера — он вычитан из кода: `resolveMarkdownPath` пускает
 * только .md/.markdown, `ImportXMind` — только .xmind.
 */
const MAP_EXT = new Set(['.md', '.markdown', '.xmind']);

/** Что показывается как вложение: браузер отрисует, холст не разберёт. */
const BLOB_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif',
  '.pdf', '.mp3', '.wav', '.ogg', '.m4a', '.opus', '.flac', '.mp4', '.webm', '.mov',
]);

/**
 * Каталоги, куда замер не заходит. Это не «спрятать неудобное»: содержимое
 * node_modules и target — чужой и порождённый код, он не является предметом
 * работы человека, и включение раздуло бы слепое пятно фиктивно.
 */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'target', 'dist', 'build', '.next', 'venv', '.venv',
  '__pycache__', '.cache', 'vendor', 'coverage', '.turbo', 'out', 'bin', 'obj',
  '.gradle', '.idea', '.vs', '.svelte-kit', 'site-packages', '.pnpm-store',
]);

function classify(ext) {
  if (MAP_EXT.has(ext)) return 'map';
  if (BLOB_EXT.has(ext)) return 'blob';
  return 'blind';
}

/**
 * Обход корпуса. Считает по расширениям сразу в разрезе уровня доступа: второй
 * проход по 26 тысячам файлов ради той же таблицы был бы платой ни за что.
 */
async function scan(dir) {
  const levels = {
    map: { files: 0, bytes: 0, ext: new Map() },
    blob: { files: 0, bytes: 0, ext: new Map() },
    blind: { files: 0, bytes: 0, ext: new Map() },
  };
  let skippedDirs = 0;
  let unreadable = 0;

  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      // Каталог без прав доступа — не провал замера, но и не пустой каталог.
      // Молча считать его пустым значило бы занизить корпус, поэтому он считается.
      unreadable++;
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) { skippedDirs++; continue; }
        await walk(join(current, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = extname(entry.name).toLowerCase() || '(без расширения)';
      const level = classify(ext);
      let size = 0;
      try { size = (await stat(join(current, entry.name))).size; } catch { /* исчез между чтениями */ }
      const bucket = levels[level];
      bucket.files++;
      bucket.bytes += size;
      const acc = bucket.ext.get(ext) ?? { files: 0, bytes: 0 };
      acc.files++;
      acc.bytes += size;
      bucket.ext.set(ext, acc);
    }
  }

  await walk(dir);
  const files = levels.map.files + levels.blob.files + levels.blind.files;
  const bytes = levels.map.bytes + levels.blob.bytes + levels.blind.bytes;
  return { levels, files, bytes, skippedDirs, unreadable };
}

/** Топ расширений уровня — «чем именно занято» в одну строку таблицы. */
function topExt(bucket, n = 3) {
  return [...bucket.ext.entries()]
    .sort((a, b) => b[1].files - a[1].files)
    .slice(0, n)
    .map(([ext, v]) => `${ext}x${v.files}`)
    .join(' ');
}

const mb = (bytes) => (bytes / 1048576).toFixed(1);
const pct = (part, whole) => (whole ? ((part / whole) * 100).toFixed(1) : '0.0');

export default {
  id: 'workspace-reach',
  question:
    'Какая доля рабочего материала пользователя доступна Gmind как структура на холсте, '
    + 'какая — только как вложение, и какая не видна вовсе. Ответ «да» — по каждому корпусу '
    + 'названа доля файлов и байт в каждом из трёх уровней доступа и состав слепого пятна '
    + 'по расширениям.',

  cases: CASES,
  variants: VARIANTS,
  // Уровни считаются одним обходом корпуса, поэтому корпус — внешняя ось: три
  // ячейки подряд читают один и тот же снятый скан.
  order: 'case-major',
  columns: [
    { key: 'файлов', title: 'файлов', width: 7 },
    { key: 'доля-ф', title: 'доля ф.', width: 8 },
    { key: 'МБ', title: 'МБ', width: 9 },
    { key: 'доля-б', title: 'доля б.', width: 8 },
    { key: 'чем занято', title: 'чем занято', width: 34 },
  ],
  needsBackend: false,
  gate: false,

  /** Обход всех корпусов — здесь, по одному разу. Ячейка ничего не сканирует. */
  async setup(ctx) {
    const scans = new Map();
    for (const kase of CASES) {
      const startedAt = Date.now();
      const result = await scan(kase.dir);
      scans.set(kase.id, result);
      if (result.files === 0) {
        // Пустой корпус — находка, а не сбой: каталог есть, работы в нём нет.
        ctx.log(`  ${kase.id}: каталог ${kase.dir} пуст или недоступен целиком`);
        continue;
      }
      ctx.log(
        `  ${kase.id}: ${result.files} файлов · ${mb(result.bytes)} МБ за `
        + `${((Date.now() - startedAt) / 1000).toFixed(1)}с · пропущено служебных каталогов `
        + `${result.skippedDirs}${result.unreadable ? ` · без доступа ${result.unreadable}` : ''}`,
      );
    }
    return { scans };
  },

  async run(kase, variant, ctx) {
    const scanned = ctx.scans.get(kase.id);
    if (!scanned || scanned.files === 0) {
      return {
        ok: true,
        note: 'корпус пуст: делить нечего',
        metrics: { 'файлов': 0, 'доля-ф': '—', 'МБ': '—', 'доля-б': '—', 'чем занято': '—' },
        keep: { files: null, share: null },
      };
    }
    const bucket = scanned.levels[variant.level];
    const shareFiles = Number(pct(bucket.files, scanned.files));
    return {
      ok: true,
      note: `${bucket.ext.size} различных расширений на уровне`,
      metrics: {
        'файлов': bucket.files,
        'доля-ф': `${shareFiles.toFixed(1)}%`,
        'МБ': mb(bucket.bytes),
        'доля-б': `${pct(bucket.bytes, scanned.bytes)}%`,
        'чем занято': topExt(bucket) || '—',
      },
      keep: { files: bucket.files, share: shareFiles, level: variant.level },
    };
  },

  /**
   * Судится ровно одно и только на уровне «карта»: попадает ли на холст хотя бы
   * половина предметов работы корпуса. Порог — прямое следствие заявки «Gmind
   * должен стать визуальным центром»: центр, до которого не доходит большинство
   * материала, центром не является. Уровни «вложение» и «слепое» описывают, куда
   * делось остальное, и вердикта не получают — судить их было бы двойным счётом.
   */
  async oracle(result, kase, variant, ctx) {
    if (result.keep.files === null) {
      return { matched: null, note: 'вердикта нет: корпус пуст' };
    }
    if (variant.level !== 'map') {
      return { matched: null, note: 'уровень описательный, вердикт выносится только по «карте»' };
    }
    const reaches = result.keep.share >= 50;
    return {
      matched: reaches ? 1 : 0,
      expected: 1,
      note: reaches
        ? `на холст попадает ${result.keep.share}% файлов корпуса`
        : `на холст попадает ${result.keep.share}% файлов: остальное Gmind как структуру не открывает`,
    };
  },

  /**
   * Итог по всему рабочему полю — то, ради чего замер и ставился: не «в каком
   * проекте хуже», а чем именно занято слепое пятно целиком. Это и есть перечень
   * форматов, которые направление IDE обязано будет уметь.
   */
  async teardown(ctx) {
    const total = { map: 0, blob: 0, blind: 0 };
    const blindExt = new Map();
    for (const kase of CASES) {
      const scanned = ctx.scans.get(kase.id);
      if (!scanned) continue;
      for (const level of ['map', 'blob', 'blind']) total[level] += scanned.levels[level].files;
      for (const [ext, v] of scanned.levels.blind.ext) {
        const acc = blindExt.get(ext) ?? { files: 0, bytes: 0 };
        acc.files += v.files;
        acc.bytes += v.bytes;
        blindExt.set(ext, acc);
      }
    }
    const all = total.map + total.blob + total.blind;
    ctx.log(
      `  всё рабочее поле: ${all} файлов — карта ${total.map} (${pct(total.map, all)}%), `
      + `вложение ${total.blob} (${pct(total.blob, all)}%), слепое ${total.blind} (${pct(total.blind, all)}%)`,
    );
    const top = [...blindExt.entries()].sort((a, b) => b[1].files - a[1].files).slice(0, 15);
    ctx.log(`  слепое пятно — ${blindExt.size} различных расширений, крупнейшие:`);
    for (const [ext, v] of top) {
      ctx.log(`    ${ext.padEnd(16)} ${String(v.files).padStart(6)} файлов  ${mb(v.bytes).padStart(9)} МБ`);
    }
    ctx.log('  доля файлов и доля байт расходятся: судится первая — на холст кладут предметы, а не байты');
  },
};
