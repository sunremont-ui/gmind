export interface Theme {
  id: string
  name: string
  background: string
  canvasBackground: string
  topic: TopicStyle
  rootTopic: TopicStyle
  connection: ConnectionStyle
  gradients: GradientDef[]
}

export interface GradientDef {
  id: string
  x1?: string
  y1?: string
  x2?: string
  y2?: string
  stops: { offset: string; color: string; opacity?: number }[]
}

export interface TopicStyle {
  fill: string
  stroke: string
  textColor: string
  fontSize: number
  borderRadius: number
  fontFamily: string
  gradient?: string
  selectedFill?: string
  selectedGradient?: string
  selectedStroke?: string
  shadow?: string
}

export interface ConnectionStyle {
  stroke: string
  strokeWidth: number
  opacity: number
  style: 'solid' | 'dashed' | 'dotted'
  strokeGradient?: string
}

export const themes: Theme[] = [
  {
    id: 'lumen',
    name: 'Lumen',
    background: '#F7F7F8',
    canvasBackground: '#EEEEF1',
    gradients: [
      { id: 'g-topic-lumen', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#EEF0FF' }, { offset: '50%', color: '#F3E8FF' }, { offset: '100%', color: '#FCE7F3' }
      ]},
      { id: 'g-root-lumen', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#5B9DF0' }, { offset: '55%', color: '#6F6BE8' }, { offset: '100%', color: '#A78BFA' }
      ]},
      { id: 'g-topic-sel-lumen', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#DDE0FF' }, { offset: '50%', color: '#E9D5FF' }, { offset: '100%', color: '#FBCFE8' }
      ]},
      { id: 'g-edge-lumen', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#5B9DF0' }, { offset: '50%', color: '#6F6BE8' }, { offset: '100%', color: '#A78BFA' }
      ]},
    ],
    topic: {
      fill: '#EEF0FF', stroke: '#BBC2FF', textColor: '#1F2562', fontSize: 14, borderRadius: 14,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-topic-lumen)',
      selectedFill: '#DDE0FF', selectedGradient: 'url(#g-topic-sel-lumen)', selectedStroke: '#5B6CFF',
      shadow: '0 2px 16px rgba(91, 108, 255, 0.20)',
    },
    rootTopic: {
      fill: '#5B6CFF', stroke: '#4A56DB', textColor: '#FFFFFF', fontSize: 17, borderRadius: 14,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-root-lumen)',
      selectedFill: '#4A56DB', selectedStroke: '#3B45B0',
      shadow: '0 8px 24px rgba(91, 108, 255, 0.30)',
    },
    connection: { stroke: '#A78BFA', strokeWidth: 2, opacity: 0.65, style: 'solid', strokeGradient: 'url(#g-edge-lumen)' },
  },
  {
    id: 'vivid',
    name: 'Vivid',
    background: '#ffffff',
    canvasBackground: '#f1f5f9',
    gradients: [
      { id: 'g-topic-vivid', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#fdf2f8' }, { offset: '50%', color: '#ede9fe' }, { offset: '100%', color: '#dbeafe' }
      ]},
      { id: 'g-root-vivid', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#ec4899' }, { offset: '50%', color: '#8b5cf6' }, { offset: '100%', color: '#3b82f6' }
      ]},
      { id: 'g-topic-sel-vivid', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#fbcfe8' }, { offset: '50%', color: '#c4b5fd' }, { offset: '100%', color: '#bfdbfe' }
      ]},
      { id: 'g-edge-vivid', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#f472b6' }, { offset: '50%', color: '#a78bfa' }, { offset: '100%', color: '#60a5fa' }
      ]},
    ],
    topic: {
      fill: '#fdf2f8', stroke: '#c084fc', textColor: '#1e1b4b', fontSize: 14, borderRadius: 8,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-topic-vivid)',
      selectedFill: '#fbcfe8', selectedGradient: 'url(#g-topic-sel-vivid)', selectedStroke: '#8b5cf6',
      shadow: '0 2px 12px rgba(139,92,246,0.3)',
    },
    rootTopic: {
      fill: '#8b5cf6', stroke: '#6d28d9', textColor: '#ffffff', fontSize: 16, borderRadius: 10,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-root-vivid)',
      selectedFill: '#7c3aed', selectedStroke: '#4c1d95',
    },
    connection: { stroke: '#a78bfa', strokeWidth: 2, opacity: 0.7, style: 'solid', strokeGradient: 'url(#g-edge-vivid)' },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    background: '#fff7ed',
    canvasBackground: '#ffedd5',
    gradients: [
      { id: 'g-topic-sunset', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#fff7ed' }, { offset: '50%', color: '#ffedd5' }, { offset: '100%', color: '#fef2f2' }
      ]},
      { id: 'g-root-sunset', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#f97316' }, { offset: '50%', color: '#ef4444' }, { offset: '100%', color: '#ec4899' }
      ]},
      { id: 'g-topic-sel-sunset', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#fed7aa' }, { offset: '50%', color: '#fecaca' }, { offset: '100%', color: '#fbcfe8' }
      ]},
      { id: 'g-edge-sunset', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#fb923c' }, { offset: '50%', color: '#f87171' }, { offset: '100%', color: '#f472b6' }
      ]},
    ],
    topic: {
      fill: '#fff7ed', stroke: '#fb923c', textColor: '#7c2d12', fontSize: 14, borderRadius: 10,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-topic-sunset)',
      selectedFill: '#fed7aa', selectedGradient: 'url(#g-topic-sel-sunset)', selectedStroke: '#ea580c',
      shadow: '0 2px 12px rgba(234,88,12,0.25)',
    },
    rootTopic: {
      fill: '#f97316', stroke: '#ea580c', textColor: '#ffffff', fontSize: 16, borderRadius: 12,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-root-sunset)',
      selectedFill: '#ea580c', selectedStroke: '#c2410c',
    },
    connection: { stroke: '#fb923c', strokeWidth: 2, opacity: 0.6, style: 'solid', strokeGradient: 'url(#g-edge-sunset)' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    background: '#f0f9ff',
    canvasBackground: '#e0f2fe',
    gradients: [
      { id: 'g-topic-ocean', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#ecfeff' }, { offset: '50%', color: '#e0f2fe' }, { offset: '100%', color: '#f0fdfa' }
      ]},
      { id: 'g-root-ocean', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#06b6d4' }, { offset: '50%', color: '#3b82f6' }, { offset: '100%', color: '#14b8a6' }
      ]},
      { id: 'g-topic-sel-ocean', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#a5f3fc' }, { offset: '50%', color: '#bae6fd' }, { offset: '100%', color: '#a7f3d0' }
      ]},
      { id: 'g-edge-ocean', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#22d3ee' }, { offset: '50%', color: '#60a5fa' }, { offset: '100%', color: '#34d399' }
      ]},
    ],
    topic: {
      fill: '#ecfeff', stroke: '#22d3ee', textColor: '#0c4a6e', fontSize: 14, borderRadius: 8,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-topic-ocean)',
      selectedFill: '#a5f3fc', selectedGradient: 'url(#g-topic-sel-ocean)', selectedStroke: '#0891b2',
      shadow: '0 2px 12px rgba(6,182,212,0.25)',
    },
    rootTopic: {
      fill: '#06b6d4', stroke: '#0891b2', textColor: '#ffffff', fontSize: 16, borderRadius: 10,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-root-ocean)',
      selectedFill: '#0891b2', selectedStroke: '#0e7490',
    },
    connection: { stroke: '#22d3ee', strokeWidth: 1.5, opacity: 0.5, style: 'solid', strokeGradient: 'url(#g-edge-ocean)' },
  },
  {
    id: 'forest',
    name: 'Forest',
    background: '#f0fdf4',
    canvasBackground: '#dcfce7',
    gradients: [
      { id: 'g-topic-forest', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#f0fdf4' }, { offset: '50%', color: '#ecfdf5' }, { offset: '100%', color: '#fefce8' }
      ]},
      { id: 'g-root-forest', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#10b981' }, { offset: '50%', color: '#22c55e' }, { offset: '100%', color: '#84cc16' }
      ]},
      { id: 'g-topic-sel-forest', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#a7f3d0' }, { offset: '50%', color: '#bbf7d0' }, { offset: '100%', color: '#fef08a' }
      ]},
      { id: 'g-edge-forest', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#34d399' }, { offset: '50%', color: '#4ade80' }, { offset: '100%', color: '#a3e635' }
      ]},
    ],
    topic: {
      fill: '#f0fdf4', stroke: '#4ade80', textColor: '#14532d', fontSize: 14, borderRadius: 8,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-topic-forest)',
      selectedFill: '#bbf7d0', selectedGradient: 'url(#g-topic-sel-forest)', selectedStroke: '#16a34a',
      shadow: '0 2px 12px rgba(22,163,74,0.25)',
    },
    rootTopic: {
      fill: '#10b981', stroke: '#059669', textColor: '#ffffff', fontSize: 16, borderRadius: 10,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-root-forest)',
      selectedFill: '#059669', selectedStroke: '#047857',
    },
    connection: { stroke: '#4ade80', strokeWidth: 2, opacity: 0.5, style: 'solid', strokeGradient: 'url(#g-edge-forest)' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    background: '#0f172a',
    canvasBackground: '#1e293b',
    gradients: [
      { id: 'g-topic-midnight', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#1e293b' }, { offset: '50%', color: '#1e1b4b' }, { offset: '100%', color: '#0f172a' }
      ]},
      { id: 'g-root-midnight', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#5B6CFF' }, { offset: '50%', color: '#8b5cf6' }, { offset: '100%', color: '#ec4899' }
      ]},
      { id: 'g-topic-sel-midnight', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#312e81' }, { offset: '50%', color: '#4c1d95' }, { offset: '100%', color: '#831843' }
      ]},
      { id: 'g-edge-midnight', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#818cf8' }, { offset: '50%', color: '#a78bfa' }, { offset: '100%', color: '#f472b6' }
      ]},
    ],
    topic: {
      fill: '#1e293b', stroke: '#5B6CFF', textColor: '#e2e8f0', fontSize: 14, borderRadius: 8,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-topic-midnight)',
      selectedFill: '#312e81', selectedGradient: 'url(#g-topic-sel-midnight)', selectedStroke: '#818cf8',
      shadow: '0 2px 12px rgba(99,102,241,0.4)',
    },
    rootTopic: {
      fill: '#5B6CFF', stroke: '#4f46e5', textColor: '#ffffff', fontSize: 16, borderRadius: 10,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-root-midnight)',
      selectedFill: '#4f46e5', selectedStroke: '#4338ca',
    },
    connection: { stroke: '#5B6CFF', strokeWidth: 1.5, opacity: 0.7, style: 'solid', strokeGradient: 'url(#g-edge-midnight)' },
  },
  {
    id: 'silicon',
    name: 'Silicon',
    background: '#fafafa',
    canvasBackground: '#f5f5f7',
    gradients: [
      { id: 'g-topic-silicon', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#fafafa' }, { offset: '50%', color: '#f4f4f5' }, { offset: '100%', color: '#e4e4e7' }
      ]},
      { id: 'g-root-silicon', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#a1a1aa' }, { offset: '50%', color: '#71717a' }, { offset: '100%', color: '#52525b' }
      ]},
      { id: 'g-topic-sel-silicon', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#e4e4e7' }, { offset: '50%', color: '#d4d4d8' }, { offset: '100%', color: '#a1a1aa' }
      ]},
      { id: 'g-edge-silicon', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#d4d4d8' }, { offset: '50%', color: '#a1a1aa' }, { offset: '100%', color: '#71717a' }
      ]},
    ],
    topic: {
      fill: '#fafafa', stroke: '#d4d4d8', textColor: '#18181b', fontSize: 14, borderRadius: 8,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-topic-silicon)',
      selectedFill: '#e4e4e7', selectedGradient: 'url(#g-topic-sel-silicon)', selectedStroke: '#71717a',
      shadow: '0 2px 12px rgba(113,113,122,0.25)',
    },
    rootTopic: {
      fill: '#71717a', stroke: '#52525b', textColor: '#ffffff', fontSize: 16, borderRadius: 10,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-root-silicon)',
      selectedFill: '#52525b', selectedStroke: '#3f3f46',
    },
    connection: { stroke: '#a1a1aa', strokeWidth: 1.5, opacity: 0.6, style: 'solid', strokeGradient: 'url(#g-edge-silicon)' },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    background: '#faf5ff',
    canvasBackground: '#f3e8ff',
    gradients: [
      { id: 'g-topic-lavender', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#faf5ff' }, { offset: '50%', color: '#f3e8ff' }, { offset: '100%', color: '#ede9fe' }
      ]},
      { id: 'g-root-lavender', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#a855f7' }, { offset: '50%', color: '#8b5cf6' }, { offset: '100%', color: '#5B6CFF' }
      ]},
      { id: 'g-topic-sel-lavender', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#e9d5ff' }, { offset: '50%', color: '#ddd6fe' }, { offset: '100%', color: '#c7d2fe' }
      ]},
      { id: 'g-edge-lavender', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#d8b4fe' }, { offset: '50%', color: '#a78bfa' }, { offset: '100%', color: '#818cf8' }
      ]},
    ],
    topic: {
      fill: '#faf5ff', stroke: '#c084fc', textColor: '#3b0764', fontSize: 14, borderRadius: 8,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-topic-lavender)',
      selectedFill: '#e9d5ff', selectedGradient: 'url(#g-topic-sel-lavender)', selectedStroke: '#a855f7',
      shadow: '0 2px 12px rgba(168,85,247,0.25)',
    },
    rootTopic: {
      fill: '#a855f7', stroke: '#7e22ce', textColor: '#ffffff', fontSize: 16, borderRadius: 10,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-root-lavender)',
      selectedFill: '#7e22ce', selectedStroke: '#6b21a8',
    },
    connection: { stroke: '#c084fc', strokeWidth: 1.5, opacity: 0.6, style: 'solid', strokeGradient: 'url(#g-edge-lavender)' },
  },
  {
    id: 'peach',
    name: 'Peach',
    background: '#fffaf5',
    canvasBackground: '#fff1e6',
    gradients: [
      { id: 'g-topic-peach', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#fffaf5' }, { offset: '50%', color: '#fff1e6' }, { offset: '100%', color: '#ffedd5' }
      ]},
      { id: 'g-root-peach', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#fb923c' }, { offset: '50%', color: '#f97316' }, { offset: '100%', color: '#ef4444' }
      ]},
      { id: 'g-topic-sel-peach', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#fed7aa' }, { offset: '50%', color: '#fecaca' }, { offset: '100%', color: '#fde68a' }
      ]},
      { id: 'g-edge-peach', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#fdba74' }, { offset: '50%', color: '#fb923c' }, { offset: '100%', color: '#f87171' }
      ]},
    ],
    topic: {
      fill: '#fffaf5', stroke: '#fdba74', textColor: '#7c2d12', fontSize: 14, borderRadius: 8,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-topic-peach)',
      selectedFill: '#fed7aa', selectedGradient: 'url(#g-topic-sel-peach)', selectedStroke: '#f97316',
      shadow: '0 2px 12px rgba(249,115,22,0.25)',
    },
    rootTopic: {
      fill: '#fb923c', stroke: '#ea580c', textColor: '#ffffff', fontSize: 16, borderRadius: 10,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-root-peach)',
      selectedFill: '#ea580c', selectedStroke: '#c2410c',
    },
    connection: { stroke: '#fdba74', strokeWidth: 2, opacity: 0.6, style: 'solid', strokeGradient: 'url(#g-edge-peach)' },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    background: '#f0fdf4',
    canvasBackground: '#ecfeff',
    gradients: [
      { id: 'g-topic-aurora', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#ecfeff' }, { offset: '33%', color: '#f0fdf4' }, { offset: '66%', color: '#fdf4ff' }, { offset: '100%', color: '#faf5ff' }
      ]},
      { id: 'g-root-aurora', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#06b6d4' }, { offset: '33%', color: '#10b981' }, { offset: '66%', color: '#8b5cf6' }, { offset: '100%', color: '#ec4899' }
      ]},
      { id: 'g-topic-sel-aurora', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#a5f3fc' }, { offset: '33%', color: '#a7f3d0' }, { offset: '66%', color: '#ddd6fe' }, { offset: '100%', color: '#fbcfe8' }
      ]},
      { id: 'g-edge-aurora', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [
        { offset: '0%', color: '#22d3ee' }, { offset: '33%', color: '#34d399' }, { offset: '66%', color: '#a78bfa' }, { offset: '100%', color: '#f472b6' }
      ]},
    ],
    topic: {
      fill: '#ecfeff', stroke: '#2dd4bf', textColor: '#0f766e', fontSize: 14, borderRadius: 8,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-topic-aurora)',
      selectedFill: '#a5f3fc', selectedGradient: 'url(#g-topic-sel-aurora)', selectedStroke: '#14b8a6',
      shadow: '0 2px 12px rgba(45,212,191,0.25)',
    },
    rootTopic: {
      fill: '#06b6d4', stroke: '#0d9488', textColor: '#ffffff', fontSize: 16, borderRadius: 10,
      fontFamily: "'Inter', system-ui, sans-serif", gradient: 'url(#g-root-aurora)',
      selectedFill: '#0d9488', selectedStroke: '#0f766e',
    },
    connection: { stroke: '#2dd4bf', strokeWidth: 1.5, opacity: 0.6, style: 'solid', strokeGradient: 'url(#g-edge-aurora)' },
  },
]
