import type { Topic } from '../types'

export interface NodeTemplateStyle {
  font_size?: number
  font_color?: string
  font_family?: string
  font_weight?: number
  text_align?: string
  node_width?: number
  node_height?: number
  border_width?: number
  padding?: number
  opacity?: number
  border_color?: string
  connection_color?: string
  shadow_type?: string
  node_style?: string
  show_child_count?: boolean
  shape?: string
  icon?: string
}

export interface NodeTemplate {
  name: string
  style: NodeTemplateStyle
}

const STORAGE_KEY = 'node_templates'

export function getTemplates(): NodeTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveTemplate(name: string, style: NodeTemplateStyle): void {
  const templates = getTemplates().filter(t => t.name !== name)
  templates.push({ name, style })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export function deleteTemplate(name: string): void {
  const templates = getTemplates().filter(t => t.name !== name)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export function collectStyle(topic: Topic): NodeTemplateStyle {
  return {
    font_size: topic.font_size,
    font_color: topic.font_color,
    font_family: topic.font_family,
    font_weight: topic.font_weight,
    text_align: topic.text_align,
    node_width: topic.node_width,
    node_height: topic.node_height,
    border_width: topic.border_width,
    padding: topic.padding,
    opacity: topic.opacity,
    border_color: topic.border_color,
    connection_color: topic.connection_color,
    shadow_type: topic.shadow_type,
    node_style: topic.node_style,
    show_child_count: topic.show_child_count,
    shape: topic.shape,
    icon: topic.icon,
  }
}

export function styleToUpdates(style: NodeTemplateStyle): Partial<Topic> {
  return { ...style }
}
