// Auto-generated from Go model types. DO NOT EDIT.
// Run: cd backend && go run tools/gen-ts-types/main.go

export type ErrorCode = string

export interface AIChatRequest {
  workbook_id: string
  sheet_id: string
  message: string
}

export interface AIChatResponse {
  message: string
  suggestions?: AISuggestion[]
}

export interface AIGenerateRequest {
  prompt: string
  workbook_id: string
  sheet_id: string
  parent_id?: string
}

export interface AISuggestion {
  action: string
  topic_id?: string
  title?: string
}

export interface CopyTopicToWorkbookRequest {
  target_workbook_id: string
  target_parent_id?: string
}

export interface CreateRelationshipRequest {
  title?: string
  end1_id: string
  end2_id: string
}

export interface CreateSheetRequest {
  title: string
  topic_id?: string
}

export interface CreateTopicRequest {
  title: string
  parent_id: string
  position?: Position
}

export interface CreateWorkbookRequest {
  title: string
}

export interface ErrorResponse {
  error: string
  code: ErrorCode
  status: number
}

export interface MoveTopicRequest {
  new_parent_id: string
  index: number
}

export interface Position {
  x: number
  y: number
}

export interface Relationship {
  id: string
  title?: string
  end1_id: string
  end2_id: string
}

export interface Sheet {
  id: string
  title: string
  root_topic: Topic
  relationships?: Relationship[]
  floating_topics?: Topic[]
  imported_data?: string
}

export interface SwitchAIProviderRequest {
  provider: string
  endpoint?: string
  model?: string
  api_key?: string
  folder_id?: string
}

export interface Topic {
  id: string
  title: string
  notes?: string
  markers?: string[]
  labels?: string[]
  hyperlink?: string
  image?: string
  folded: boolean
  children?: Topic[]
  position?: Position
  structure_class?: string
  branch_side?: string
  edge_style?: string
  edge_dash?: string
  font_size?: number
  font_color?: string
  font_family?: string
  font_weight?: number
  text_align?: string
  node_width?: number
  border_width?: number
  padding?: number
  opacity?: number
  shape?: string
  progress?: number
  priority?: number
  node_height?: number
  border_color?: string
  connection_color?: string
  shadow_type?: string
  node_style?: string
  fold_icon?: string
  show_child_count?: boolean
  icon?: string
  rich_text?: string
  level_gap?: number
  sibling_gap?: number
}

export interface UpdateTopicRequest {
  title?: string
  notes?: string
  markers?: string[]
  labels?: string[]
  hyperlink?: string
  image?: string
  folded?: boolean
  position?: Position
  structure_class?: string
  branch_side?: string
  edge_style?: string
  edge_dash?: string
  font_size?: number
  font_color?: string
  font_family?: string
  font_weight?: number
  text_align?: string
  node_width?: number
  border_width?: number
  padding?: number
  opacity?: number
  shape?: string
  progress?: number
  priority?: number
  node_height?: number
  border_color?: string
  connection_color?: string
  shadow_type?: string
  node_style?: string
  fold_icon?: string
  show_child_count?: boolean
  icon?: string
  rich_text?: string
  level_gap?: number
  sibling_gap?: number
}

export interface Workbook {
  id: string
  title: string
  sheets: Sheet[]
  private: boolean
  access_mode?: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface AddCollaboratorRequest {
  user_id: string
  role?: string
}

export interface AddCollaboratorResponse {
  status: string
}

export interface ListCollaboratorsResponse {
  users: string[]
}

export interface TaskLogMessage {
  task_id: string
  agent_id: string
  step?: number
  level: string
  message?: string
  content?: string
  tool_name?: string
  tool_args?: string
  result?: string
  time: string
}

