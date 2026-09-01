// Как читается запись лабы глазом: подпись вида, цвет вердикта, вес статуса.
//
// Вынесено из компонентов, потому что одно и то же соответствие нужно и списку
// трека, и карточке портфеля: две копии разошлись бы, и разошлись бы молча.
import { colors } from '../../styles/tokens'
import type { LabKind, LabStatus, LabVerdict, LabOracleLevel } from '../../types/lab'

export const KIND_LABEL: Record<LabKind, string> = {
  decision: 'Решение',
  gate: 'Гейт',
  fact: 'Факт',
  tail: 'Хвост',
  next: 'Шаг',
  lesson: 'Урок',
}

/** Глиф вида. Форма, а не цвет: цвет уже занят вердиктом. */
export const KIND_GLYPH: Record<LabKind, string> = {
  decision: '◆',
  gate: '▮',
  fact: '●',
  tail: '◗',
  next: '▶',
  lesson: '✦',
}

export const STATUS_LABEL: Record<LabStatus, string> = {
  proposed: 'предложено',
  accepted: 'принято',
  superseded: 'заменено',
  revoked: 'отменено',
}

export const VERDICT_LABEL: Record<LabVerdict, string> = {
  match: 'совпало',
  drift: 'разошлось',
  unverifiable: 'нечем проверить',
  self_declared: 'самоподтверждение',
}

/**
 * Цвет вердикта. `self_declared` намеренно НЕ зелёный: факт совпал, но сверка
 * прошла в том же прогоне, что и запись — это ещё не подтверждение.
 */
export function verdictColor(v: LabVerdict | null | undefined): string {
  switch (v) {
    case 'match': return colors.green
    case 'drift': return colors.red
    case 'self_declared': return colors.orange
    case 'unverifiable': return colors.textTertiary
    default: return colors.textQuaternary
  }
}

export const LEVEL_LABEL: Record<LabOracleLevel, string> = {
  independent: 'независимо',
  'out-of-process': 'вне процесса',
  self: 'собой',
}

/** Порядок видов на экране: от того, чем работа держится, к тому, что усвоено. */
export const KIND_ORDER: LabKind[] = ['next', 'gate', 'decision', 'tail', 'fact', 'lesson']

/** Короткая ссылка вида `git:c754e19:путь` → человекочитаемое «c754e19 · путь». */
export function formatSourceRef(ref: string | null | undefined): string {
  if (!ref) return ''
  const parts = ref.split(':')
  if (parts[0] === 'git' && parts.length >= 3) {
    return `${parts[1]} · ${parts.slice(2).join(':')}`
  }
  return ref
}
