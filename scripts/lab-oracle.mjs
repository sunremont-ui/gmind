#!/usr/bin/env node
/**
 * Оракул проекта Gmind для слоя лабы MASys.
 *
 * Ничего из MASys не импортирует: проверяющий и проверяемый не должны делить
 * один дефект. Контракт — stdout: ОДИН JSON-объект `ключ → скаляр`, вся
 * диагностика в stderr.
 *
 * ⚠️ Префикс `file.` НЕ используется: у MASys он означает путь внутри ЕГО
 * репозитория и для чужого проекта дал бы уверенное «файла нет» про
 * существующий файл. Свои факты идут под `doctor.`/`audit.` — MASys их не
 * собирает и помечает уровнем `independent`.
 */
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = process.cwd();
const facts = {};

try {
  const { stdout } = await exec('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  facts['git.head'] = stdout.trim();
} catch (error) {
  console.error(`[lab-oracle] git.head: ${error.message}`);
}

/**
 * `go vet` — самая дешёвая проверка, которая смотрит на СМЫСЛ, а не на форму.
 * Холодный прогон ~19 с, тёплый ~0.8 с; оракул зовётся из `lab:verify` руками,
 * а не на старте сессии, поэтому холодная цена приемлема.
 *
 * ⚠️ Ненулевой код возврата здесь — РЕЗУЛЬТАТ («vet нашёл проблему»), а не сбой
 * раннера. Глотать его значило бы терять сигнал ровно тогда, когда он есть.
 */
const BACKEND = 'gmind/backend';
if (existsSync(join(root, BACKEND, 'go.mod'))) {
  facts['doctor.go-vet'] = await new Promise((resolvePromise) => {
    execFile('go', ['vet', './...'], {
      cwd: join(root, BACKEND),
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      timeout: 300_000,
    }, (error) => {
      if (!error) return resolvePromise('ok');
      // Различаем «vet отработал и нашёл» от «vet не запустился».
      resolvePromise(typeof error.code === 'number' ? 'findings' : 'unavailable');
    });
  });
  /**
   * Тесты — отдельный факт от `vet`: они ловят разное, и сводить их в один
   * «зелёный» значило бы терять, ЧТО именно сломано. ~3.5 с с кэшем.
   */
  facts['doctor.go-test'] = await new Promise((resolvePromise) => {
    execFile('go', ['test', './...'], {
      cwd: join(root, BACKEND),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 600_000,
    }, (error) => {
      if (!error) return resolvePromise('ok');
      resolvePromise(typeof error.code === 'number' ? 'failing' : 'unavailable');
    });
  });
} else {
  console.error(`[lab-oracle] ${BACKEND}/go.mod не найден`);
}

/** Рекурсивный счёт файлов по расширению, мимо служебных каталогов. */
function countFiles(dir, predicate) {
  let total = 0;
  const walk = (current) => {
    let entries;
    try { entries = readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'build' || entry.name.startsWith('.')) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (predicate(entry.name)) total += 1;
    }
  };
  if (existsSync(dir)) walk(dir);
  return total;
}

facts['audit.go-files'] = String(countFiles(join(root, 'gmind'), (n) => n.endsWith('.go')));
facts['audit.go-tests'] = String(countFiles(join(root, 'gmind'), (n) => n.endsWith('_test.go')));

/**
 * ⚠️ Экспорт книги лабы из счёта вики ИСКЛЮЧЁН: он сам кладёт страницу в вики,
 * и без исключения любой экспорт двигал бы счёт — то есть измерение менялось бы
 * от акта измерения, и drift сообщал бы о наблюдателе, а не о предмете.
 */
const LAB_EXPORT = /^lab-[A-Z0-9]+\.md$/;
facts['audit.wiki-pages'] = String(
  countFiles(join(root, 'wikiAlgoritm', 'wiki'), (n) => n.endsWith('.md') && !LAB_EXPORT.test(n)),
);

/** Живёт ли память сессии: PLANS.md — журнал активного плана проекта. */
const PLANS = join(root, 'gmind', 'PLANS.md');
facts['audit.plans-bytes'] = existsSync(PLANS) ? String(statSync(PLANS).size) : '0';

process.stdout.write(`${JSON.stringify(facts)}\n`);
