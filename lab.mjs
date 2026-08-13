#!/usr/bin/env node
/**
 * Обёртка над CLI слоя лабы MASys: `node lab.mjs <brief|verify|accept|export|apply>`.
 *
 * Написана как .mjs, а не как .cmd/.sh намеренно: у проекта нет package.json в
 * корне, а `node lab.mjs …` одинаково работает в bash, cmd и PowerShell — тогда
 * как shell-обёртка потребовала бы двух файлов и всё равно разошлась бы по
 * поведению кавычек.
 *
 * Путь к MASys абсолютный и машинно-локальный. Это не небрежность: контур и так
 * локален — `serverUrl` в lab.config.json указывает на localhost:5010.
 */
import { spawn } from 'node:child_process';

const MASYS = 'E:/MASys';
const TSX = `${MASYS}/apps/server/node_modules/.bin/tsx`;
const CLI = `${MASYS}/apps/server/scripts/lab-project.ts`;

const child = spawn(TSX, [CLI, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 1));
