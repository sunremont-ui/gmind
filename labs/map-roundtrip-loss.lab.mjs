/**
 * Что теряет карта, пройдя через Markdown и вернувшись обратно.
 *
 * Повод — третья возможность: собственный формат оправдан только тем, чего в
 * .md нет. Прежде чем проектировать формат, замер устанавливает, сколько именно
 * модели Gmind не доживает до диска сегодня — по каждой группе свойств, на
 * настоящих книгах пользователя, а не на придуманном примере.
 *
 * Цикл настоящий: `markdown.Render` → `markdown.Parse` из `internal/markdown`,
 * тот самый код, которым работают `/md/save` и `/md/reload`. Прогоняет его
 * измерительный инструмент `tools/md-roundtrip`, поля он перечисляет рефлексией
 * по `model.Topic` — список руками устарел бы молча, и новое поле модели
 * выпало бы из замера, не изменив ни одной цифры.
 *
 * ⚠️ Четыре группы свойств — не рубрикация ради красоты, а четыре РАЗНЫХ ответа
 * на вопрос «переживает ли это сохранение»:
 *   идентичность — ID, ссылка в память MASys, прогон: по чему узел вообще можно
 *                  адресовать снаружи;
 *   смысл        — заголовок, тело, заметки, вид памяти, метки: ради чего карта;
 *   форма        — цвета, шрифты, размеры: как выглядит;
 *   раскладка    — позиция, сторона ветви, стиль ребра, свёрнутость: как лежит.
 * Потеря в каждой из них стоит разного, и общая доля «сколько процентов дошло»
 * это различие как раз и скрыла бы.
 *
 * ⚠️ Связи (Relationship) в счёт полей НЕ входят и не могут: `Render` принимает
 * корневой Topic, а связи живут на уровне Sheet — в цикл они не попадают по
 * сигнатуре, а не по недосмотру. Их число снимается отдельно и печатается в
 * итоге: это цена, которую нельзя увидеть, глядя только на узлы.
 *
 * ⚠️ `fallbackTitle` при разборе пустой намеренно. Подстановка исходного
 * названия скрыла бы ровно ту потерю, которую замер ищет.
 *
 * Что замер НЕ говорит: каким быть формату. Он называет размер дыры.
 *
 * Запуск: node lab-run.mjs labs/map-roundtrip-loss.lab.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const BACKEND = 'gmind/backend';

/**
 * Запуск инструмента с подачей книг на stdin.
 *
 * ⚠️ Через `execFile` это не делается: опции `input` у него нет (она есть у
 * синхронного `execFileSync`), и переданная туда она молча игнорируется — процесс
 * получает пустой stdin и падает на разборе. Поэтому spawn и явная запись.
 */
function runTool(args, input, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('go', args, { cwd, shell: process.platform === 'win32' });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`go ${args.join(' ')} → код ${code}: ${stderr.slice(0, 400)}`));
    });
    child.stdin.end(input, 'utf8');
  });
}

/**
 * Корпуса — ДАННЫЕ: базы, в которых лежат настоящие карты этой машины. Три, а не
 * одна, намеренно: если потеря окажется свойством корпуса, а не кода, это будет
 * видно сразу — доли разойдутся.
 */
const CASES = [
  {
    id: 'desktop',
    db: 'C:/Users/PollStakana/AppData/Roaming/gmind/gmind.db',
    purpose: 'рабочая база настольного Gmind: 15 книг',
  },
  {
    id: 'tauri-app',
    db: 'C:/Users/PollStakana/AppData/Roaming/com.gmind.app/gmind.db',
    purpose: 'база сборки Tauri',
  },
  {
    id: 'dev',
    db: 'D:/Gmind/gmind/frontend/src-tauri/gmind.db',
    purpose: 'база отладочной сборки',
  },
];

/**
 * Группы свойств. Поля перечислены поимённо, и это осознанно: принадлежность
 * поля к «смыслу» или к «форме» — суждение, вывести его из типа нельзя.
 *
 * ⚠️ Поле модели, не попавшее ни в одну группу, замер не проглатывает молча:
 * `setup` сверяет объединение групп со списком, который вернул инструмент, и
 * пишет остаток в лог. Иначе новое поле выпало бы из замера незаметно — ровно
 * та ошибка, от которой рефлексия защищает на уровне инструмента.
 */
const GROUPS = {
  'идентичность': ['ID', 'MasysRef', 'MasysRunID'],
  'смысл': [
    'Title', 'Body', 'Notes', 'MemoryKind', 'Markers', 'Labels', 'Hyperlink',
    'Progress', 'Priority', 'RichText', 'Icon', 'Image', 'CommentCount',
  ],
  'форма': [
    'Shape', 'NodeStyle', 'FontColor', 'FontSize', 'FontFamily', 'FontWeight',
    'BorderColor', 'BorderWidth', 'Padding', 'Opacity', 'NodeWidth', 'NodeHeight',
    'TextAlign', 'ShadowType', 'ConnColor', 'FoldIcon', 'ShowChildCount', 'CommentIcon',
  ],
  'раскладка': [
    'Position', 'Structure', 'BranchSide', 'ChildDir', 'ParentAnchor', 'EdgeStyle',
    'EdgeDash', 'EdgeWeight', 'LevelGap', 'SiblingGap', 'Folded', 'FoldedSides', 'MdForm',
  ],
};

const VARIANTS = Object.keys(GROUPS).map((id) => ({ id, fields: GROUPS[id] }));

/** Книги корпуса в том виде, в каком их отдаёт API: JSON из колонки data. */
function readBooks(db) {
  if (!existsSync(db)) return null;
  const conn = new DatabaseSync(db, { readOnly: true });
  try {
    const rows = conn.prepare('select data from workbooks').all();
    return rows.map((r) => JSON.parse(r.data));
  } finally {
    conn.close();
  }
}

const pct = (part, whole) => (whole ? ((part / whole) * 100).toFixed(1) : '—');

export default {
  id: 'map-roundtrip-loss',
  question:
    'Какая доля свойств карты доживает до диска и обратно, когда носителем служит '
    + 'Markdown, — отдельно по идентичности, смыслу, форме и раскладке. Ответ «да» — по '
    + 'каждой группе названо, сколько значений было в настоящих книгах и сколько из них '
    + 'дошло без изменения.',

  cases: CASES,
  variants: VARIANTS,
  // Цикл Render→Parse прогоняется для корпуса целиком один раз; четыре группы
  // читают один и тот же отчёт.
  order: 'case-major',
  columns: [
    { key: 'полей', title: 'полей', width: 6 },
    { key: 'было', title: 'значений', width: 9 },
    { key: 'дошло', title: 'дошло', width: 7 },
    { key: 'доля', title: 'доля', width: 7 },
    { key: 'потеряно', title: 'что теряется', width: 34 },
  ],
  needsBackend: false,
  gate: false,

  /** Прогон инструмента по каждому корпусу — здесь, по одному разу. */
  async setup(ctx) {
    const corpora = new Map();
    let fieldsChecked = false;

    for (const kase of CASES) {
      const books = readBooks(kase.db);
      if (!books) {
        ctx.log(`  ${kase.id}: базы ${kase.db} нет`);
        continue;
      }
      const stdout = await runTool(['run', './tools/md-roundtrip'], JSON.stringify(books), BACKEND);
      const reports = JSON.parse(stdout);

      // Свод по корпусу: поля складываются по книгам, книги — по корпусу.
      const fields = new Map();
      const totals = { nodesBefore: 0, nodesAfter: 0, matched: 0, idsKept: 0, rels: 0, md: 0, json: 0 };
      for (const rep of reports) {
        totals.nodesBefore += rep.nodes_before;
        totals.nodesAfter += rep.nodes_after;
        totals.matched += rep.matched;
        totals.idsKept += rep.ids_kept;
        totals.rels += rep.rels_before;
        totals.md += rep.md_bytes;
        totals.json += rep.json_bytes;
        for (const [name, stat] of Object.entries(rep.fields)) {
          const acc = fields.get(name) ?? { before: 0, after: 0, kept: 0 };
          acc.before += stat.before;
          acc.after += stat.after;
          acc.kept += stat.kept;
          fields.set(name, acc);
        }
      }
      corpora.set(kase.id, { fields, totals, books: books.length });

      if (!fieldsChecked && fields.size) {
        fieldsChecked = true;
        const grouped = new Set(Object.values(GROUPS).flat());
        const ungrouped = [...fields.keys()].filter((n) => !grouped.has(n));
        ctx.log(`  полей в model.Topic (без Children): ${fields.size}, разложено по группам: ${grouped.size}`);
        if (ungrouped.length) {
          ctx.log(`  ⚠ вне групп остались поля, в замер они не вошли: ${ungrouped.join(', ')}`);
        }
      }

      ctx.log(
        `  ${kase.id}: ${books.length} книг · узлов ${totals.nodesBefore} → ${totals.nodesAfter} · `
        + `id уцелело ${totals.idsKept} · связей на входе ${totals.rels} · `
        + `JSON ${(totals.json / 1024).toFixed(1)} КБ → Markdown ${(totals.md / 1024).toFixed(1)} КБ`,
      );
    }
    return { corpora };
  },

  async run(kase, variant, ctx) {
    const corpus = ctx.corpora.get(kase.id);
    if (!corpus) {
      return {
        ok: true,
        note: 'корпуса нет на этой машине',
        metrics: { 'полей': '—', 'было': '—', 'дошло': '—', 'доля': '—', 'потеряно': '—' },
        keep: { before: null, kept: null },
      };
    }
    let before = 0;
    let kept = 0;
    const lost = [];
    for (const name of variant.fields) {
      const stat = corpus.fields.get(name);
      if (!stat) continue;
      before += stat.before;
      kept += stat.kept;
      if (stat.before > stat.kept) lost.push([name, stat.before - stat.kept]);
    }
    lost.sort((a, b) => b[1] - a[1]);
    return {
      ok: true,
      note: `${corpus.books} книг, ${corpus.totals.nodesBefore} узлов`,
      metrics: {
        'полей': variant.fields.length,
        'было': before,
        'дошло': kept,
        'доля': before ? `${pct(kept, before)}%` : '—',
        'потеряно': lost.slice(0, 3).map(([n, c]) => `${n}:${c}`).join(' ') || '—',
      },
      keep: { before, kept, share: before ? Number(pct(kept, before)) : null },
    };
  },

  /**
   * Судится каждая группа, и порог один — 99%: сохранение не должно терять
   * свойства вовсе. Это не строгость ради строгости. Носитель, теряющий часть
   * значений, превращает «сохранить и перечитать» в операцию с необратимым
   * ущербом, а такую операцию нельзя делать автоматически — а Gmind делает её
   * именно так, по кнопке и при перезагрузке файла.
   *
   * ⚠️ Группа, в которой значений не было вовсе, вердикта не получает: нельзя
   * записать в успех сохранность того, чего в книгах нет.
   */
  async oracle(result, kase, variant, ctx) {
    if (result.keep.before === null) {
      return { matched: null, note: 'вердикта нет: корпус недоступен' };
    }
    if (result.keep.before === 0) {
      return { matched: null, note: 'вердикта нет: в книгах корпуса значений этой группы не встретилось' };
    }
    const intact = result.keep.share >= 99;
    return {
      matched: intact ? 1 : 0,
      expected: 1,
      note: intact
        ? `дошло ${result.keep.share}% значений группы`
        : `дошло ${result.keep.share}%: ${result.keep.before - result.keep.kept} значений не пережили цикл`,
    };
  },

  /**
   * Итог — то, чего не видно в таблице по группам: судьба идентичности и связей.
   * Оба ответа решают, годится ли Markdown носителем памяти агента, а в разбивку
   * по полям не помещаются.
   */
  async teardown(ctx) {
    for (const kase of CASES) {
      const corpus = ctx.corpora.get(kase.id);
      if (!corpus) continue;
      const t = corpus.totals;
      ctx.log(
        `  ${kase.id.padEnd(10)} дерево ${t.nodesBefore} → ${t.nodesAfter} узлов `
        + `(${t.nodesBefore === t.nodesAfter ? 'скелет цел' : 'СКЕЛЕТ ИЗМЕНИЛСЯ'}) · `
        + `идентификаторов уцелело ${t.idsKept} из ${t.matched} (${pct(t.idsKept, t.matched)}%) · `
        + `связей ${t.rels} → 0 (Render их не принимает)`,
      );
    }
    ctx.log('  дерево и текст переживают цикл; адрес узла — нет: после сохранения это другие узлы с тем же содержимым');
  },
};
