// V5.0 Relationships store — manages relationships state and graph-drawing UX.
import { create } from 'zustand'
import type {
  Relationship,
  CreateRelationshipRequest,
  UpdateRelationshipRequest,
  RelationshipType,
  RelationshipDirection,
} from '../types/api'
import { relationshipsApi } from '../api/relationships'

export type AnchorSide = 'top' | 'right' | 'bottom' | 'left'

export interface DragState {
  isDragging: boolean
  fromTopicId: string | null
  fromAnchor: AnchorSide | null
  startX: number
  startY: number
  currentX: number
  currentY: number
  hoverTopicId: string | null
}

interface RelationshipsState {
  // Data
  relationships: Relationship[]
  selectedRelId: string | null
  // Filters (Phase 5)
  visibleTypes: Set<string>
  highlightTopicId: string | null  // for hover-subgraph
  // Drag state for creating new edges
  drag: DragState
  // Pending popover after drop
  pendingConnection: {
    fromTopicId: string
    toTopicId: string
    screenX: number
    screenY: number
  } | null

  // Actions
  setRelationships: (rels: Relationship[]) => void
  fetch: (workbookID: string) => Promise<void>
  create: (workbookID: string, req: CreateRelationshipRequest) => Promise<Relationship>
  update: (relID: string, req: UpdateRelationshipRequest) => Promise<void>
  remove: (relID: string) => Promise<void>
  selectRel: (relID: string | null) => void

  // Drag handlers
  beginDrag: (topicId: string, anchor: AnchorSide, x: number, y: number) => void
  updateDrag: (x: number, y: number, hoverId: string | null) => void
  endDrag: () => { from: string; to: string } | null  // returns ids if valid drop
  cancelDrag: () => void

  // Popover (after drop)
  openPopover: (fromTopicId: string, toTopicId: string, x: number, y: number) => void
  closePopover: () => void

  // Filters
  toggleType: (type: string) => void
  setAllTypesVisible: () => void
  setHighlight: (topicId: string | null) => void
}

const initialDrag: DragState = {
  isDragging: false,
  fromTopicId: null,
  fromAnchor: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  hoverTopicId: null,
}

const ALL_TYPES: RelationshipType[] = [
  'relates_to', 'depends_on', 'supports', 'contradicts', 'references', 'blocks', 'custom'
]

export const useRelationshipsStore = create<RelationshipsState>((set, get) => ({
  relationships: [],
  selectedRelId: null,
  visibleTypes: new Set(ALL_TYPES),
  highlightTopicId: null,
  drag: initialDrag,
  pendingConnection: null,

  setRelationships: (rels) => set({ relationships: rels }),

  async fetch(workbookID) {
    const rels = await relationshipsApi.list(workbookID)
    set({ relationships: rels })
  },

  async create(workbookID, req) {
    const rel = await relationshipsApi.create(workbookID, req)
    set({ relationships: [...get().relationships, rel] })
    return rel
  },

  async update(relID, req) {
    const updated = await relationshipsApi.update(relID, req)
    set({
      relationships: get().relationships.map(r => r.id === relID ? updated : r),
    })
  },

  async remove(relID) {
    await relationshipsApi.remove(relID)
    set({
      relationships: get().relationships.filter(r => r.id !== relID),
      selectedRelId: get().selectedRelId === relID ? null : get().selectedRelId,
    })
  },

  selectRel: (relID) => set({ selectedRelId: relID }),

  beginDrag: (topicId, anchor, x, y) => set({
    drag: {
      isDragging: true,
      fromTopicId: topicId,
      fromAnchor: anchor,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      hoverTopicId: null,
    },
  }),

  updateDrag: (x, y, hoverId) => {
    const drag = get().drag
    if (!drag.isDragging) return
    set({ drag: { ...drag, currentX: x, currentY: y, hoverTopicId: hoverId } })
  },

  endDrag: () => {
    const drag = get().drag
    if (!drag.isDragging) return null
    const from = drag.fromTopicId
    const to = drag.hoverTopicId
    set({ drag: initialDrag })
    if (from && to) return { from, to }
    return null
  },

  cancelDrag: () => set({ drag: initialDrag }),

  openPopover: (fromTopicId, toTopicId, x, y) => set({
    pendingConnection: { fromTopicId, toTopicId, screenX: x, screenY: y },
  }),

  closePopover: () => set({ pendingConnection: null }),

  toggleType: (type) => {
    const visible = new Set(get().visibleTypes)
    if (visible.has(type)) visible.delete(type)
    else visible.add(type)
    set({ visibleTypes: visible })
  },

  setAllTypesVisible: () => set({ visibleTypes: new Set(ALL_TYPES) }),

  setHighlight: (topicId) => set({ highlightTopicId: topicId }),
}))

export function relationshipDirection(rel: Relationship): RelationshipDirection {
  return (rel.direction as RelationshipDirection) || 'forward'
}

export function relationshipType(rel: Relationship): string {
  return rel.type || 'relates_to'
}

export function relationshipFromId(rel: Relationship): string {
  return rel.from_topic_id || rel.end1_id
}

export function relationshipToId(rel: Relationship): string {
  return rel.to_topic_id || rel.end2_id
}
