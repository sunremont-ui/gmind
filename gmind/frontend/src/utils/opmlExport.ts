import type { Topic } from '../types'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function topicToOutline(topic: Topic, depth: number): string {
  const indent = '  '.repeat(depth)
  const escaped = escapeXml(topic.title)
  const children = topic.children
  const hasChildren = !!(children && children.length > 0)
  const attrs = `text="${escaped}"`
  const notesAttr = topic.notes ? ` _note="${escapeXml(topic.notes)}"` : ''

  if (!hasChildren) {
    return `${indent}<outline ${attrs}${notesAttr} />\n`
  }

  let xml = `${indent}<outline ${attrs}${notesAttr}>\n`
  for (const child of children) {
    xml += topicToOutline(child, depth + 1)
  }
  xml += `${indent}</outline>\n`
  return xml
}

export function exportToOPML(root: Topic, title: string): string {
  const escapedTitle = escapeXml(title)
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
<head>
<title>${escapedTitle}</title>
</head>
<body>
${topicToOutline(root, 1)}</body>
</opml>
`
}

export function downloadOPML(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/xml;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
