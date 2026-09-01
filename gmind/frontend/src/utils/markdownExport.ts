import type { Topic } from '../types'
import { serializeTopicsToMarkdown, type MdTopic, type MdMeta } from './markdown'

/** Topic → узел Markdown-документа: голова, тело, заметка и визуальные свойства. */
export function topicToMdNode(topic: Topic): MdTopic {
  const meta: MdMeta = {
    shape: topic.shape,
    icon: topic.icon,
    node_style: topic.node_style,
    font_color: topic.font_color,
    border_color: topic.border_color,
    memory_kind: topic.memory_kind,
    masys_ref: topic.masys_ref,
    markers: topic.markers,
    labels: topic.labels,
    progress: topic.progress,
    priority: topic.priority,
    folded: topic.folded,
    image: topic.image,
    position: topic.position,
    child_dir: topic.child_dir,
    structure_class: topic.structure_class,
    rich_text: topic.rich_text,
  }
  return {
    title: topic.title,
    body: topic.body,
    notes: topic.notes,
    meta,
    md_form: topic.md_form,
    children: (topic.children ?? []).map(topicToMdNode),
  }
}

export function exportToMarkdown(root: Topic): string {
  return serializeTopicsToMarkdown(topicToMdNode(root))
}

export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
