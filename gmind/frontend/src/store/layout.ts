import { create } from 'zustand'
import { DEFAULT_LEVEL_GAP, DEFAULT_SIBLING_GAP, DEFAULT_CHILD_GAP } from '../renderer/layout'
import type { LayoutGaps } from '../renderer/layout'

const NODE_PADDING_DEFAULT = 10
const MAX_CHARS_DEFAULT = 30
const FONT_SIZE_DEFAULT = 14

interface LayoutStoreState {
  siblingGap: number
  levelGap: number
  childGap: number
  nodePadding: number
  maxChars: number
  fontSize: number
  setSiblingGap: (v: number) => void
  setLevelGap: (v: number) => void
  setChildGap: (v: number) => void
  setNodePadding: (v: number) => void
  setMaxChars: (v: number) => void
  setFontSize: (v: number) => void
  getGaps: () => LayoutGaps
  resetGaps: () => void
}

export const useLayoutStore = create<LayoutStoreState>((set, get) => {
  const saved = (() => {
    try {
      const raw = localStorage.getItem('gmind_layout_gaps')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })()
  const savedNode = (() => {
    try {
      const raw = localStorage.getItem('gmind_node_defaults')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })()

  return {
    siblingGap: saved?.siblingGap ?? DEFAULT_SIBLING_GAP,
    levelGap: saved?.levelGap ?? DEFAULT_LEVEL_GAP,
    childGap: saved?.childGap ?? DEFAULT_CHILD_GAP,
    nodePadding: savedNode?.nodePadding ?? NODE_PADDING_DEFAULT,
    maxChars: savedNode?.maxChars ?? MAX_CHARS_DEFAULT,
    fontSize: savedNode?.fontSize ?? FONT_SIZE_DEFAULT,

    setSiblingGap: (v) => { set({ siblingGap: v }); saveGaps(get()) },
    setLevelGap: (v) => { set({ levelGap: v }); saveGaps(get()) },
    setChildGap: (v) => { set({ childGap: v }); saveGaps(get()) },
    setNodePadding: (v) => { set({ nodePadding: v }); saveNodeDefaults(get()) },
    setMaxChars: (v) => { set({ maxChars: v }); saveNodeDefaults(get()) },
    setFontSize: (v) => { set({ fontSize: v }); saveNodeDefaults(get()) },
    getGaps: () => {
      const s = get()
      return { levelGap: s.levelGap, siblingGap: s.siblingGap, childGap: s.childGap }
    },
    resetGaps: () => {
      set({ siblingGap: DEFAULT_SIBLING_GAP, levelGap: DEFAULT_LEVEL_GAP, childGap: DEFAULT_CHILD_GAP, nodePadding: NODE_PADDING_DEFAULT, maxChars: MAX_CHARS_DEFAULT, fontSize: FONT_SIZE_DEFAULT })
      localStorage.removeItem('gmind_layout_gaps')
      localStorage.removeItem('gmind_node_defaults')
    },
  }
})

function saveGaps(s: { siblingGap: number; levelGap: number; childGap: number }) {
  try {
    localStorage.setItem('gmind_layout_gaps', JSON.stringify({ siblingGap: s.siblingGap, levelGap: s.levelGap, childGap: s.childGap }))
  } catch {}
}

function saveNodeDefaults(s: { nodePadding: number; maxChars: number; fontSize: number }) {
  try {
    localStorage.setItem('gmind_node_defaults', JSON.stringify({ nodePadding: s.nodePadding, maxChars: s.maxChars, fontSize: s.fontSize }))
  } catch {}
}
