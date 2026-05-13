import type { Topic } from '../types'

export function exportToMarkdown(root: Topic): string {
  const lines: string[] = []

  const walk = (topic: Topic, depth: number) => {
    const prefix = '#'.repeat(Math.min(depth + 1, 6))
    lines.push(`${prefix} ${topic.title}`)
    lines.push('')
    if (topic.notes) {
      lines.push(topic.notes)
      lines.push('')
    }
    if (topic.children) {
      for (const child of topic.children) {
        walk(child, depth + 1)
      }
    }
  }

  walk(root, 0)
  return lines.join('\n')
}

export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
