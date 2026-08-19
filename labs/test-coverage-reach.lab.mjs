/**
 * Что зелёный `go test ./...` доказывает о коде бэкенда.
 *
 * Повод — открытый хвост трека GM: «21 тестовый файл на 100 файлов Go — величина,
 * которая показывает, насколько вердикт go test вообще что-то доказывает». Хвост
 * назвал соотношение ФАЙЛОВ, а вердикт даётся ОПЕРАТОРАМ: файл с одним тестом на
 * функцию-геттер и файл, прогоняющий половину пакета, в этом счёте равны. Замер
 * заменяет соотношение файлов на долю операторов, которые прогон действительно
 * исполнил.
 *
 * ⚠️ Оси здесь две, и разница между ними — главное, что этот замер добывает.
 * `go test -cover` по умолчанию считает покрытие ТОЛЬКО того пакета, чьи тесты
 * запущены: код, исполненный через чужой тест, в его собственном профиле не виден и
 * показывается нулём. `-coverpkg=./...` относит исполненный оператор туда, где он
 * написан, кем бы он ни был вызван. Пакет без своих тестов может при этом
 * оказаться прогнанным насквозь — или не оказаться, и это разные новости.
 *
 * Замер, а не гейт: провал ячейки здесь — находка («пакет не исполняется вовсе»), а
 * не поломка сборки. Гейт трека GM остаётся прежним — `go vet` и `go test` зелёные.
 *
 * Что замер НЕ говорит: хороши ли тесты. Исполненный оператор — не проверенный
 * оператор; покрытие ставит верхнюю границу тому, что вердикт может доказывать, и
 * ничего не говорит об утверждениях внутри тестов.
 *
 * Запуск: node lab-run.mjs labs/test-coverage-reach.lab.mjs
 */
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const BACKEND = 'gmind/backend';
const MODULE = 'github.com/gmind/backend/';

/**
 * Пакеты — ДАННЫЕ: путь, число файлов Go и число тестовых файлов на 2026-08-19.
 * Счёт файлов записан здесь намеренно, а не вычисляется: именно он стоит в хвосте
 * трека, и замер обязан показать его рядом с долей операторов, чтобы разница между
 * «есть тестовый файл» и «код исполняется» была видна в одной строке.
 */
const CASES = [
  { id: 'cmd/server', purpose: 'точка входа сервера', goFiles: 1, testFiles: 0 },
  { id: 'internal/agent', purpose: 'мультиагентная система, ReAct-цикл', goFiles: 12, testFiles: 1 },
  { id: 'internal/ai', purpose: 'провайдеры моделей', goFiles: 2, testFiles: 0 },
  { id: 'internal/api', purpose: 'HTTP-слой, самый крупный пакет', goFiles: 39, testFiles: 11 },
  { id: 'internal/config', purpose: 'конфигурация', goFiles: 1, testFiles: 0 },
  { id: 'internal/core', purpose: 'доменные типы', goFiles: 6, testFiles: 0 },
  { id: 'internal/llama', purpose: 'мост к llama-server', goFiles: 3, testFiles: 1 },
  { id: 'internal/markdown', purpose: 'разбор и рендер markdown', goFiles: 2, testFiles: 1 },
  { id: 'internal/mcp', purpose: 'MCP-клиент', goFiles: 3, testFiles: 1 },
  { id: 'internal/model', purpose: 'модели данных', goFiles: 4, testFiles: 0 },
  { id: 'internal/model_servers', purpose: 'реестр серверов моделей', goFiles: 1, testFiles: 0 },
  { id: 'internal/rag', purpose: 'семантический поиск', goFiles: 1, testFiles: 0 },
  { id: 'internal/store', purpose: 'хранилище', goFiles: 14, testFiles: 4 },
  { id: 'internal/webhook', purpose: 'вебхуки', goFiles: 1, testFiles: 0 },
  { id: 'internal/wiki', purpose: 'вики', goFiles: 3, testFiles: 1 },
  { id: 'internal/ws', purpose: 'WebSocket, коллаборация', goFiles: 2, testFiles: 1 },
  { id: 'internal/xmind', purpose: 'импорт и экспорт XMind', goFiles: 2, testFiles: 0 },
  { id: 'migrations', purpose: 'миграции схемы', goFiles: 1, testFiles: 0 },
  { id: 'tools/gen-migration', purpose: 'генератор миграций', goFiles: 1, testFiles: 0 },
  { id: 'tools/gen-ts-types', purpose: 'генератор типов TS', goFiles: 1, testFiles: 0 },
];

/**
 * Варианты — два прочтения одного и того же зелёного прогона. Прогон каждого стоит
 * минуты, поэтому оба выполняются ОДИН раз в `setup`, а ячейки читают уже снятые
 * профили: сравнение идёт на буквально одних и тех же данных.
 */
const VARIANTS = [
  { id: 'по-пакету', flags: [], profile: 'cover-own.out' },
  { id: 'сквозной', flags: ['-coverpkg=./...'], profile: 'cover-cross.out' },
];

/**
 * Разбор профиля покрытия Go.
 *
 * Строка: `<файл>:<нач>.<кол>,<кон>.<кол> <операторов> <счётчик>`. Операторы
 * суммируются по каталогу пакета; исполненным считается блок со счётчиком больше нуля.
 */
function parseProfile(text) {
  const byPackage = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('mode:')) continue;
    const m = /^(.+):\d+\.\d+,\d+\.\d+ (\d+) (\d+)$/.exec(line);
    if (!m) continue;
    const file = m[1].startsWith(MODULE) ? m[1].slice(MODULE.length) : m[1];
    const pkg = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '.';
    const statements = Number(m[2]);
    const hit = Number(m[3]) > 0;
    const acc = byPackage.get(pkg) ?? { statements: 0, covered: 0 };
    acc.statements += statements;
    if (hit) acc.covered += statements;
    byPackage.set(pkg, acc);
  }
  return byPackage;
}

export default {
  id: 'test-coverage-reach',
  question:
    'Что доказывает зелёный `go test ./...` о коде бэкенда Gmind: какая доля операторов '
    + 'действительно исполняется, и меняется ли ответ, если считать исполнение не по '
    + 'собственным тестам пакета, а сквозным `-coverpkg`. Ответ «да» — по каждому пакету '
    + 'названа доля исполненных операторов в обоих прочтениях, а не число тестовых файлов.',

  cases: CASES,
  variants: VARIANTS,
  // Смена варианта = полный перекомпилированный прогон всего дерева, поэтому
  // чередовать их поячеечно нельзя; оба сняты заранее, порядок обхода на замер
  // уже не влияет.
  order: 'case-major',
  columns: [
    { key: 'файлов', title: 'файлов', width: 7 },
    { key: 'тестов', title: 'тестов', width: 7 },
    { key: 'операторов', title: 'оператор', width: 9 },
    { key: 'исполнено', title: 'исполн.', width: 8 },
    { key: 'доля', title: 'доля', width: 7 },
  ],
  needsBackend: false,
  gate: false,

  /** Оба прогона — здесь. Ячейка ничего не запускает, она читает снятые профили. */
  async setup(ctx) {
    const profiles = new Map();
    for (const variant of VARIANTS) {
      const out = join(ctx.outDir, variant.profile);
      const startedAt = Date.now();
      ctx.log(`  прогон go test ./... ${variant.flags.join(' ')} → ${variant.profile}`);
      let status = 'зелёный';
      try {
        await exec('go', ['test', './...', '-count=1', ...variant.flags, `-coverprofile=${out}`], {
          cwd: BACKEND,
          encoding: 'utf8',
          maxBuffer: 32 * 1024 * 1024,
          timeout: 15 * 60 * 1000,
        });
      } catch (error) {
        // ⚠️ Красный прогон НЕ отменяет замер: профиль всё равно записан, и доля
        // исполненного по нему считается. Но молчать об этом нельзя — вердикт
        // трека («go test зелёный») в этот момент не выполняется.
        status = 'КРАСНЫЙ';
        ctx.log(`  ⚠ go test ${variant.flags.join(' ')} вернул ненулевой код: ${String(error.message).split('\n')[0]}`);
      }
      const text = await readFile(out, 'utf8').catch(() => '');
      if (!text) throw new Error(`профиль ${out} пуст: прогон не дал покрытия, мерить нечего`);
      const parsed = parseProfile(text);
      const totals = [...parsed.values()].reduce(
        (acc, p) => ({ statements: acc.statements + p.statements, covered: acc.covered + p.covered }),
        { statements: 0, covered: 0 },
      );
      profiles.set(variant.id, parsed);
      const share = totals.statements ? ((totals.covered / totals.statements) * 100).toFixed(1) : '0.0';
      ctx.log(
        `  ${variant.id}: прогон ${status} за ${((Date.now() - startedAt) / 1000).toFixed(1)}с · `
        + `пакетов в профиле ${parsed.size} · операторов ${totals.statements} · исполнено ${totals.covered} (${share}%)`,
      );
    }
    return { profiles };
  },

  async run(kase, variant, ctx) {
    const own = ctx.profiles.get(variant.id)?.get(kase.id);
    // Сколько операторов у пакета ВООБЩЕ — знает только сквозной профиль: он
    // инструментирует всё дерево. Прочтение «по-пакету» о чужом коде не знает
    // ничего, и отсутствие пакета в нём означает ноль исполненного, а не ноль
    // операторов.
    const all = ctx.profiles.get('сквозной')?.get(kase.id);

    if (!all) {
      return {
        ok: true,
        note: 'пакета нет в сквозном профиле: исполняемых операторов у него не нашлось',
        metrics: {
          'файлов': kase.goFiles, 'тестов': kase.testFiles,
          'операторов': '—', 'исполнено': '—', 'доля': '—',
        },
        keep: { statements: null, covered: null },
      };
    }

    const covered = own?.covered ?? 0;
    const share = all.statements ? (covered / all.statements) * 100 : 0;
    return {
      ok: true,
      note: covered === 0
        ? (kase.testFiles > 0 ? 'тестовые файлы есть, операторы не исполнены' : 'своих тестов нет, код не исполнен')
        : (kase.testFiles === 0 ? 'своих тестов нет, но код исполняется чужими' : 'исполняется своими тестами'),
      metrics: {
        'файлов': kase.goFiles, 'тестов': kase.testFiles,
        'операторов': all.statements, 'исполнено': covered, 'доля': `${share.toFixed(1)}%`,
      },
      keep: { statements: all.statements, covered, share: Number(share.toFixed(1)) },
    };
  },

  /**
   * Судится ровно одно: исполняется ли код пакета при зелёном прогоне. Это и есть
   * верхняя граница того, что вердикт `go test` способен о нём доказать.
   *
   * ⚠️ Пакет без исполняемых операторов вердикта не получает (`matched: null`) —
   * приписать ему ноль значило бы записать в провал то, чего не существует.
   */
  async oracle(result, kase, variant, ctx) {
    if (result.keep.statements === null) {
      return { matched: null, note: 'вердикта нет: у пакета нет исполняемых операторов' };
    }
    const executed = result.keep.covered > 0;
    return {
      matched: executed ? 1 : 0,
      expected: 1,
      note: executed
        ? `исполнено ${result.keep.covered} из ${result.keep.statements} операторов (${result.keep.share}%)`
        : `ноль исполненных операторов из ${result.keep.statements}: вердикт об этом пакете не говорит ничего`,
    };
  },

  async teardown(ctx) {
    ctx.log('  исполненный оператор — не проверенный: покрытие ставит верхнюю границу, а не оценку тестам');
  },
};
