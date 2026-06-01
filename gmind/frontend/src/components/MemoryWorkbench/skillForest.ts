// V6.0 Phase 6 — Skill Evolution Tree.
// Builds a derivation forest from MASys skills using their `derivedFrom`
// lineage (a skill may be distilled from one or more parent skills). The result
// drives an indented tree view annotated with success/usage health.
import type { MASysSkill } from '../../types/masys'

export interface SkillNode {
  skill: MASysSkill
  children: SkillNode[]
  depth: number
}

export interface SkillForestStats {
  total: number
  roots: number
  derived: number   // skills with at least one resolvable parent
  maxDepth: number
  orphanRefs: number // derivedFrom ids that point to unknown skills
}

export interface SkillForest {
  roots: SkillNode[]
  stats: SkillForestStats
}

// Resolve a derivedFrom reference (id first, then name) to a skill id.
function resolveRef(ref: string, byId: Map<string, MASysSkill>, byName: Map<string, MASysSkill>): string | null {
  if (byId.has(ref)) return ref
  const byNameHit = byName.get(ref)
  return byNameHit ? byNameHit.id : null
}

export function buildSkillForest(skills: MASysSkill[]): SkillForest {
  const byId = new Map<string, MASysSkill>()
  const byName = new Map<string, MASysSkill>()
  for (const s of skills) {
    byId.set(s.id, s)
    if (s.name && !byName.has(s.name)) byName.set(s.name, s)
  }

  // parentId -> child skill ids
  const childrenOf = new Map<string, string[]>()
  const hasParent = new Set<string>()
  let orphanRefs = 0

  for (const s of skills) {
    const refs = s.derivedFrom ?? []
    for (const ref of refs) {
      const parentId = resolveRef(ref, byId, byName)
      if (parentId == null || parentId === s.id) {
        if (parentId == null) orphanRefs++
        continue
      }
      if (!childrenOf.has(parentId)) childrenOf.set(parentId, [])
      childrenOf.get(parentId)!.push(s.id)
      hasParent.add(s.id)
    }
  }

  // Roots: skills with no resolvable parent.
  const rootIds = skills.filter(s => !hasParent.has(s.id)).map(s => s.id)

  let maxDepth = 0
  const build = (id: string, depth: number, path: Set<string>): SkillNode | null => {
    const skill = byId.get(id)
    if (!skill || path.has(id)) return null // cycle guard
    if (depth > maxDepth) maxDepth = depth
    const nextPath = new Set(path)
    nextPath.add(id)
    const childIds = childrenOf.get(id) ?? []
    const children: SkillNode[] = []
    for (const cid of childIds) {
      const node = build(cid, depth + 1, nextPath)
      if (node) children.push(node)
    }
    children.sort((a, b) => (a.skill.name || '').localeCompare(b.skill.name || ''))
    return { skill, children, depth }
  }

  const roots = rootIds
    .map(id => build(id, 0, new Set()))
    .filter((n): n is SkillNode => n !== null)
    .sort((a, b) => (a.skill.name || '').localeCompare(b.skill.name || ''))

  return {
    roots,
    stats: {
      total: skills.length,
      roots: roots.length,
      derived: hasParent.size,
      maxDepth,
      orphanRefs,
    },
  }
}

// Flatten the forest into rows for rendering (pre-order, depth preserved).
export function flattenForest(roots: SkillNode[]): SkillNode[] {
  const out: SkillNode[] = []
  const walk = (n: SkillNode) => {
    out.push(n)
    for (const c of n.children) walk(c)
  }
  for (const r of roots) walk(r)
  return out
}

// Health colour from success rate (undefined / never-run = neutral).
export function successColor(skill: MASysSkill): string {
  if ((skill.usageCount ?? 0) === 0) return '#94a3b8' // slate — unused
  const r = skill.successRate ?? 0
  if (r >= 0.7) return '#22c55e'
  if (r >= 0.4) return '#f59e0b'
  return '#ef4444'
}
