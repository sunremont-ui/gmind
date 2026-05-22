// Lumen Design System — Design Tokens
// Apple/Google-inspired: precision + expressive gradients

// ─── Fonts ───────────────────────────────────────────
export const fonts = {
  ui: `'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
  mono: `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace`,
}

export const fontSizes = {
  caption: 11,
  label: 12,
  body: 13,
  bodyLarge: 15,
  subhead: 15,
  title: 17,
  headline: 20,
  display: 28,
}

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
}

// ─── Colors (Light) — Lumen Design System ────────────
export const colors = {
  // Backgrounds
  white: '#FFFFFF',
  bg: '#F7F7F8',
  bgSecondary: '#FFFFFF',
  bgTertiary: '#EEEEF1',
  canvas: '#EEEEF1',

  // Text
  text: '#15151B',
  textSecondary: '#57575F',
  textTertiary: '#76767F',
  textQuaternary: '#9C9CA6',
  textInverse: '#FFFFFF',

  // Fill / Surface
  fill: 'rgba(0, 0, 0, 0.05)',
  fillSecondary: 'rgba(0, 0, 0, 0.08)',
  fillTertiary: 'rgba(0, 0, 0, 0.12)',
  fillHover: 'rgba(0, 0, 0, 0.03)',

  // Separators / Borders
  separator: 'rgba(0, 0, 0, 0.08)',
  separatorThick: 'rgba(0, 0, 0, 0.16)',
  separatorHeavy: 'rgba(0, 0, 0, 0.24)',

  // Accent — Lumen Indigo #5B6CFF
  accent: '#5B6CFF',
  accentHover: '#4A56DB',
  accentLight: 'rgba(91, 108, 255, 0.12)',
  accentDark: '#3B45B0',

  // Primary (alias for accent)
  primary: '#5B6CFF',
  primaryHover: '#4A56DB',
  primaryLight: 'rgba(91, 108, 255, 0.12)',

  // Surface (cards, panels)
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceBorder: 'rgba(0, 0, 0, 0.08)',

  // Scrim (modal backdrops)
  scrim: 'rgba(10, 10, 15, 0.45)',

  // Focus ring — primary glow
  focus: 'rgba(91, 108, 255, 0.15)',
  focusInset: '0 0 0 4px rgba(91, 108, 255, 0.15)',

  // Semantic
  green: '#10B981',
  greenLight: 'rgba(16, 185, 129, 0.12)',
  red: '#EF4444',
  redLight: 'rgba(239, 68, 68, 0.12)',
  orange: '#F59E0B',
  orangeLight: 'rgba(245, 158, 11, 0.12)',
  yellow: '#F59E0B',
  yellowLight: 'rgba(245, 158, 11, 0.12)',
  purple: '#8B5CF6',
  purpleLight: 'rgba(139, 92, 246, 0.12)',

  // Inbox
  inboxBg: '#fffbea',
  inboxBorder: '#ffe38f',
  inboxText: '#ad6200',

  // Tool Panel
  toolActive: '#EEF0FF',
  toolActiveText: '#5B6CFF',
  toolInactive: '#76767F',

  // Node presets
  nodeDefaultBg: '#EEF0FF',
  nodeDefaultBorder: '#BBC2FF',
  nodeSelectedBg: '#DDE0FF',
  nodeSelectedBorder: '#5B6CFF',
  nodeText: '#1F2562',
}

// ─── Colors (Dark) ───────────────────────────────────
export const colorsDark = {
  white: '#000000',
  bg: '#0A0A0F',
  bgSecondary: '#15151B',
  canvas: '#050509',

  text: '#F4F4F7',
  textSecondary: '#B4B4BD',
  textTertiary: '#8A8A93',
  textInverse: '#0A0A0F',

  fill: 'rgba(255, 255, 255, 0.06)',
  fillSecondary: 'rgba(255, 255, 255, 0.10)',
  fillTertiary: 'rgba(255, 255, 255, 0.14)',

  separator: 'rgba(255, 255, 255, 0.10)',
  separatorThick: 'rgba(255, 255, 255, 0.18)',

  accent: '#7782FF',
  accentHover: '#94A0FF',
  accentLight: 'rgba(91, 108, 255, 0.18)',
  accentDark: '#BBC2FF',

  green: '#10B981',
  red: '#EF4444',
  orange: '#F59E0B',
  yellow: '#F59E0B',
  purple: '#8B5CF6',

  inboxBg: '#3a2d00',
  inboxBorder: '#8a6a00',
  inboxText: '#F59E0B',
}

// ─── Gradients ────────────────────────────────────────
export const gradients = {
  aurora: 'linear-gradient(135deg, #5B6CFF 0%, #8B5CF6 50%, #EC4899 100%)',
  auroraSoft: 'linear-gradient(135deg, rgba(91,108,255,0.12) 0%, rgba(139,92,246,0.10) 50%, rgba(236,72,153,0.10) 100%)',
  tide: 'linear-gradient(135deg, #06B6D4 0%, #0EA5E9 100%)',
  ember: 'linear-gradient(135deg, #F59E0B 0%, #EC4899 100%)',
  forest: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
}

// ─── Spacing (4px grid) ───────────────────────────────
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
  section: 32,
  block: 48,
}

// ─── Border Radius ───────────────────────────────────
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
}

// ─── Shadows (Lumen neumorphic) ──────────────────────
export const shadows = {
  hairline: '0 0 0 1px rgba(15, 15, 25, 0.08)',
  sm: '0 1px 2px rgba(15, 15, 25, 0.05), 0 2px 6px rgba(15, 15, 25, 0.05)',
  md: '0 2px 4px rgba(15, 15, 25, 0.05), 0 8px 16px rgba(15, 15, 25, 0.08)',
  lg: '0 4px 8px rgba(15, 15, 25, 0.06), 0 16px 32px rgba(15, 15, 25, 0.10)',
  xl: '0 8px 16px rgba(15, 15, 25, 0.08), 0 32px 64px rgba(15, 15, 25, 0.14)',
  modal: '0 8px 16px rgba(15, 15, 25, 0.08), 0 32px 64px rgba(15, 15, 25, 0.14)',
  // Neumorphic raised — dark offset + light offset
  neuSm: '3px 3px 7px rgba(120,140,180,0.26), -3px -3px 7px #FFFFFF',
  neuMd: '5px 5px 12px rgba(120,140,180,0.30), -5px -5px 12px #FFFFFF',
  neuLg: '10px 10px 26px rgba(120,140,180,0.22), -10px -10px 26px #FFFFFF',
  // Neumorphic inset (recessed)
  neuInset: 'inset 2px 2px 6px rgba(120,140,180,0.26), inset -2px -2px 6px #FFFFFF',
  neuInsetSm: 'inset 1px 1px 2px rgba(120,140,180,0.30), inset -1px -1px 2px #FFFFFF',
}

export const shadowsDark = {
  hairline: '0 0 0 1px rgba(255, 255, 255, 0.10)',
  sm: '0 1px 2px rgba(0, 0, 0, 0.40), 0 2px 6px rgba(0, 0, 0, 0.40)',
  md: '0 2px 4px rgba(0, 0, 0, 0.40), 0 8px 16px rgba(0, 0, 0, 0.50)',
  lg: '0 4px 8px rgba(0, 0, 0, 0.45), 0 16px 32px rgba(0, 0, 0, 0.55)',
  xl: '0 8px 16px rgba(0, 0, 0, 0.50), 0 32px 64px rgba(0, 0, 0, 0.65)',
  modal: '0 8px 16px rgba(0, 0, 0, 0.50), 0 32px 64px rgba(0, 0, 0, 0.65)',
  // Neumorphic raised — dark offset + light offset
  neuSm: '3px 3px 7px rgba(0,0,0,0.60), -3px -3px 7px rgba(255,255,255,0.05)',
  neuMd: '5px 5px 12px rgba(0,0,0,0.65), -5px -5px 12px rgba(255,255,255,0.06)',
  neuLg: '10px 10px 26px rgba(0,0,0,0.60), -10px -10px 26px rgba(255,255,255,0.06)',
  // Neumorphic inset
  neuInset: 'inset 2px 2px 6px rgba(0,0,0,0.60), inset -2px -2px 6px rgba(255,255,255,0.04)',
  neuInsetSm: 'inset 1px 1px 2px rgba(0,0,0,0.60), inset -1px -1px 2px rgba(255,255,255,0.04)',
}

// ─── Z-index ─────────────────────────────────────────
export const z = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  overlay: 800,
  statusBar: 900,
  modalBackdrop: 1000,
  modal: 1100,
  commandPalette: 3000,
  banner: 9999,
}

// ─── Transitions (Lumen easing) ──────────────────────
export const transitions = {
  fast: '120ms cubic-bezier(0.32, 0.72, 0, 1)',
  normal: '200ms cubic-bezier(0.32, 0.72, 0, 1)',
  slow: '320ms cubic-bezier(0.16, 1, 0.3, 1)',
  spring: '320ms cubic-bezier(0.16, 1, 0.3, 1)',
}

// ─── Animation System — modular variables ─────────────
// Change these to tweak all animations globally
export const anim = {
  // Easing curves
  ease: {
    emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',   // enter: expand, panels slide in
    standard: 'cubic-bezier(0.32, 0.72, 0, 1)',     // default: hover, small transitions
    decelerated: 'cubic-bezier(0, 0, 0.2, 1)',      // element appears
    accelerated: 'cubic-bezier(0.4, 0, 1, 1)',       // element disappears
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',     // bouncy popup
  },
  // Durations in ms
  dur: {
    instant: 0,
    short: 120,
    normal: 200,
    long: 320,
    extra: 500,
  },
}

// ─── Sizes (layout) ──────────────────────────────────
export const sizes = {
  sidebar: 260,
  sidebarCollapsed: 0,
  propertiesPanel: 280,
  aiPanel: 320,
  toolPanel: 36,
  headerHeight: 48,
  tabBarHeight: 36,
}
