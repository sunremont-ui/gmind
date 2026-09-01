import type { ChildDirection } from '../components/MindMap/nodeDirections'

// Re-export auto-generated API types (source of truth)
export type {
  Workbook, Sheet, Topic, Position, Relationship,
  ErrorCode, ErrorResponse, TaskLogMessage,
  CreateWorkbookRequest, CreateSheetRequest, CreateTopicRequest, UpdateTopicRequest,
  MoveTopicRequest, CreateRelationshipRequest, UpdateRelationshipRequest,
  RelationshipType, RelationshipDirection, RelationshipStyle,
  CopyTopicToWorkbookRequest,
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
  /**
   * Направление группы, в которую раскладка фактически положила этот узел
   * относительно родителя. Проставляется в packDirectional и служит источником
   * правды для выбора порта ветки: определять сторону по геометрии нельзя —
   * далёкий нижний ребёнок правой колонки читается как «снизу», и линия уходит
   * в объезд вместо прямой ветки.
   */
  placedDir?: ChildDirection
}

export type StructureClass =
  | 'mindmap' | 'org-chart' | 'fishbone'
  | 'tree' | 'tree-right' | 'tree-left' | 'tree-down' | 'tree-up'
  // Радиальное семейство: несколько способов разделить 360° вокруг узла.
  // 'radial' — историческое имя, ведёт себя как 'radial-even'.
  | 'radial' | 'radial-even' | 'radial-packed' | 'radial-rings' | 'radial-clock' | 'radial-sector'

export * from './theme'
