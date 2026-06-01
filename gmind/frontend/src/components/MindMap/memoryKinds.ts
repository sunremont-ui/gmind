// V6.1 Memory Lab — registry of memory node kinds.
// Single source of truth for label/icon/colour of typed memory nodes. Colours
// align with the karp layer palette used in MemoryWorkbench (budgetEstimate).
// Kinds cover both the 6 karp layers and the finer MASys record types, which
// each map onto one layer's colour.

export type KarpLayer = 'working' | 'episodic' | 'semantic' | 'procedural' | 'artifact' | 'meta'

export interface MemoryKindDef {
  label: string
  icon: string
  color: string
  layer: KarpLayer
}

const LAYER_COLOR: Record<KarpLayer, string> = {
  working: '#5B6CFF',
  episodic: '#06b6d4',
  semantic: '#22c55e',
  procedural: '#f59e0b',
  artifact: '#a855f7',
  meta: '#ec4899',
}

// Registry keyed by kind string (as stored in Topic.memory_kind / MasysRef.kind).
export const MEMORY_KINDS: Record<string, MemoryKindDef> = {
  // karp layers
  working: { label: 'Working', icon: '💭', color: LAYER_COLOR.working, layer: 'working' },
  episodic: { label: 'Episodic', icon: '⏱', color: LAYER_COLOR.episodic, layer: 'episodic' },
  semantic: { label: 'Semantic', icon: '📚', color: LAYER_COLOR.semantic, layer: 'semantic' },
  procedural: { label: 'Procedural', icon: '⚡', color: LAYER_COLOR.procedural, layer: 'procedural' },
  artifact: { label: 'Artifact', icon: '📦', color: LAYER_COLOR.artifact, layer: 'artifact' },
  meta: { label: 'Meta', icon: '🧠', color: LAYER_COLOR.meta, layer: 'meta' },
  // finer MASys record types
  conversation: { label: 'Conversation', icon: '💬', color: LAYER_COLOR.working, layer: 'working' },
  episode: { label: 'Episode', icon: '⏱', color: LAYER_COLOR.episodic, layer: 'episodic' },
  entity: { label: 'Entity', icon: '👤', color: LAYER_COLOR.semantic, layer: 'semantic' },
  person: { label: 'Person', icon: '👤', color: LAYER_COLOR.semantic, layer: 'semantic' },
  place: { label: 'Place', icon: '📍', color: LAYER_COLOR.semantic, layer: 'semantic' },
  org: { label: 'Org', icon: '🏢', color: LAYER_COLOR.semantic, layer: 'semantic' },
  concept: { label: 'Concept', icon: '🔷', color: LAYER_COLOR.semantic, layer: 'semantic' },
  skill: { label: 'Skill', icon: '⚡', color: LAYER_COLOR.procedural, layer: 'procedural' },
  result: { label: 'Result', icon: '📦', color: LAYER_COLOR.artifact, layer: 'artifact' },
  decision: { label: 'Decision', icon: '🧠', color: LAYER_COLOR.meta, layer: 'meta' },
}

// The 6 karp layers, in canonical order — used for the Memory Lab template and pickers.
export const KARP_LAYERS: KarpLayer[] = ['working', 'episodic', 'semantic', 'procedural', 'artifact', 'meta']

// Normalise an arbitrary kind string (case-insensitive, tolerant of unknowns).
export function normalizeKind(kind?: string): string | null {
  if (!kind) return null
  const k = kind.toLowerCase().trim()
  return MEMORY_KINDS[k] ? k : (kind ? k : null)
}

export function kindDef(kind?: string): MemoryKindDef | null {
  const k = normalizeKind(kind)
  return k && MEMORY_KINDS[k] ? MEMORY_KINDS[k] : null
}

export function kindColor(kind?: string): string | null {
  return kindDef(kind)?.color ?? null
}
