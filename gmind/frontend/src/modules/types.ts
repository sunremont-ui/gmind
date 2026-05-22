import type { ReactNode, ComponentType } from 'react'

export interface ModulePanelProps {
  workbookId: string | null
  onClose: () => void
}

export interface ModuleContext {
  workbookId: string | null
  activeSheetId: string | null
  selectedTopicId: string | null
}

export interface ModuleCommand {
  id: string
  label: string
  shortcut?: string
  icon?: string
  section?: string
  action: () => void
}

export interface ModuleShortcut {
  key: string
  description: string
  action: () => void
}

export interface ModuleAgentTool {
  name: string
  label: string
  description: string
  category: string
}

export interface AppModule {
  id: string
  name: string
  icon: (props: { size?: number; color?: string; strokeWidth?: number }) => ReactNode
  order: number
  tooltip: string

  panel: ComponentType<ModulePanelProps>

  commands?: (ctx: ModuleContext) => ModuleCommand[]
  shortcuts?: ModuleShortcut[]
  agentTools?: ModuleAgentTool[]
}
