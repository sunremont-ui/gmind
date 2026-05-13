// Re-export auto-generated API types (source of truth)
export type {
  Workbook, Sheet, Topic, Position, Relationship,
  ErrorCode, ErrorResponse, TaskLogMessage,
  CreateWorkbookRequest, CreateSheetRequest, CreateTopicRequest, UpdateTopicRequest,
  MoveTopicRequest, CreateRelationshipRequest, CopyTopicToWorkbookRequest,
  SwitchAIProviderRequest, AIGenerateRequest, AIChatRequest, AIChatResponse, AISuggestion,
  AddCollaboratorRequest, AddCollaboratorResponse, ListCollaboratorsResponse,
} from './api'

// Used internally in this file (LayoutNode)
import type { Topic as _Topic } from './api'
type Topic = _Topic

export interface WSMessage {
  type: string
  payload: unknown
  user_id?: string
}

export interface CursorPosition {
  user_id: string
  x: number
  y: number
  user_name?: string
  user_color?: string
}

export interface PresenceUser {
  user_id: string
  user_name: string
  user_color: string
}

export interface LayoutNode {
  topic: Topic
  x: number
  y: number
  width: number
  height: number
  children: LayoutNode[]
  parent?: LayoutNode
}

export type StructureClass = 'mindmap' | 'org-chart' | 'fishbone' | 'tree' | 'tree-right' | 'tree-left' | 'tree-down' | 'tree-up' | 'radial'

export * from './theme'
