#!/usr/bin/env node
/**
 * Запуск замеров каркасом MASys: `node lab-run.mjs labs/<файл>.lab.mjs [опции]`.
 *
 * .mjs, а не .cmd/.sh: у проекта нет package.json, а `node …` одинаково работает
 * в bash, cmd и PowerShell. Путь к MASys абсолютный и машинно-локальный — контур
 * и так локален, `serverUrl` в lab.config.json указывает на localhost.
 */
import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['E:/MASys/tools/lab-kit/run.mjs', ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code ?? 1));
