import { createElement } from 'react'

export interface IconProps {
  size?: number
  strokeWidth?: number
  color?: string
  fill?: string
  className?: string
  style?: React.CSSProperties
}

function base({ size = 24, strokeWidth = 2, color = 'currentColor', fill: fillProp, className, style }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: fillProp || 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    style,
  }
}

export { base }

export const lumenIcons: Record<string, React.ComponentType<IconProps>> = {}

function reg(name: string, fn: React.ComponentType<IconProps>) {
  lumenIcons[name] = fn
}

export function LumenPlus(props: IconProps) { const s = <svg {...base(props)}><line x1={12} y1={5} x2={12} y2={19} /><line x1={5} y1={12} x2={19} y2={12} /></svg>; reg('Plus', LumenPlus); return s }
export function LumenX(props: IconProps) { const s = <svg {...base(props)}><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>; reg('X', LumenX); return s }
export function LumenSearch(props: IconProps) { const s = <svg {...base(props)}><circle cx={11} cy={11} r={7} /><line x1={16.5} y1={16.5} x2={21} y2={21} /></svg>; reg('Search', LumenSearch); return s }
export function LumenChevronRight(props: IconProps) { const s = <svg {...base(props)}><polyline points="9,6 15,12 9,18" /></svg>; reg('ChevronRight', LumenChevronRight); return s }
export function LumenChevronDown(props: IconProps) { const s = <svg {...base(props)}><polyline points="6,9 12,15 18,9" /></svg>; reg('ChevronDown', LumenChevronDown); return s }
export function LumenFileText(props: IconProps) { const s = <svg {...base(props)}><rect x={4} y={2} width={16} height={20} rx={2} /><line x1={8} y1={8} x2={16} y2={8} /><line x1={8} y1={12} x2={14} y2={12} /><line x1={8} y1={16} x2={12} y2={16} /></svg>; reg('FileText', LumenFileText); return s }
export function LumenStickyNote(props: IconProps) { const s = <svg {...base(props)}><path d="M16 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><polyline points="16,2 16,8 22,8" /></svg>; reg('StickyNote', LumenStickyNote); return s }
export function LumenPalette(props: IconProps) { const s = <svg {...base(props)}><circle cx={12} cy={12} r={10} /><circle cx={12} cy={12} r={3} /><circle cx={5} cy={8} r={1.5} fill="currentColor" /><circle cx={19} cy={10} r={1.5} fill="currentColor" /><circle cx={9} cy={19} r={1.5} fill="currentColor" /></svg>; reg('Palette', LumenPalette); return s }
export function LumenMoveHorizontal(props: IconProps) { const s = <svg {...base(props)}><polyline points="8,18 2,12 8,6" /><polyline points="16,6 22,12 16,18" /><line x1={2} y1={12} x2={22} y2={12} /></svg>; reg('MoveHorizontal', LumenMoveHorizontal); return s }
export function LumenDownload(props: IconProps) { const s = <svg {...base(props)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7,10 12,15 17,10" /><line x1={12} y1={15} x2={12} y2={3} /></svg>; reg('Download', LumenDownload); return s }
export function LumenUpload(props: IconProps) { const s = <svg {...base(props)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17,8 12,3 7,8" /><line x1={12} y1={3} x2={12} y2={15} /></svg>; reg('Upload', LumenUpload); return s }
export function LumenUsers(props: IconProps) { const s = <svg {...base(props)}><circle cx={9} cy={7} r={3} /><circle cx={17} cy={7} r={3} /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /><path d="M13 7a4 4 0 0 1 4 4v2" /></svg>; reg('Users', LumenUsers); return s }
export function LumenBot(props: IconProps) { const s = <svg {...base(props)}><rect x={4} y={6} width={16} height={14} rx={4} /><line x1={12} y1={2} x2={12} y2={6} /><circle cx={9} cy={12} r={1.5} fill="currentColor" /><circle cx={15} cy={12} r={1.5} fill="currentColor" /><line x1={9} y1={16} x2={15} y2={16} /></svg>; reg('Bot', LumenBot); return s }
export function LumenSparkles(props: IconProps) { const s = <svg {...base(props)}><path d="M12 3v2m0 14v2m-7-9H3m18 0h-2M5.6 5.6l1.4 1.4m10.4 10.4 1.4 1.4M5.6 18.4l1.4-1.4m10.4-10.4 1.4-1.4" /><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8" /></svg>; reg('Sparkles', LumenSparkles); return s }
export function LumenImageIcon(props: IconProps) { const s = <svg {...base(props)}><rect x={3} y={3} width={18} height={18} rx={2} /><circle cx={8.5} cy={8.5} r={1.5} fill="currentColor" /><path d="m3 16 4-4 3 3 4-4 5 5" /></svg>; reg('ImageIcon', LumenImageIcon); return s }
export function LumenMousePointer(props: IconProps) { const s = <svg {...base(props)}><path d="M5 3 19 13l-6 2-3 6Z" /></svg>; reg('MousePointer', LumenMousePointer); return s }
export function LumenTrash2(props: IconProps) { const s = <svg {...base(props)}><polyline points="4,7 20,7" /><line x1={10} y1={11} x2={10} y2={17} /><line x1={14} y1={11} x2={14} y2={17} /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></svg>; reg('Trash2', LumenTrash2); return s }
export function LumenMap(props: IconProps) { const s = <svg {...base(props)}><circle cx={12} cy={10} r={3} /><path d="M12 2a8 8 0 0 0-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 0 0-8-8" /></svg>; reg('Map', LumenMap); return s }
export function LumenInbox(props: IconProps) { const s = <svg {...base(props)}><polyline points="22,12 16,12 14,15 10,15 8,12 2,12" /><path d="M2 12v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5" /><line x1={12} y1={2} x2={12} y2={10} /><polyline points="9,7 12,10 15,7" /></svg>; reg('Inbox', LumenInbox); return s }
export function LumenZap(props: IconProps) { const s = <svg {...base(props)}><polygon points="13,2 4,14 11,14 10,22 20,10 13,10" /></svg>; reg('Zap', LumenZap); return s }
export function LumenPlay(props: IconProps) { const s = <svg {...base(props)}><polygon points="6,4 20,12 6,20" /></svg>; reg('Play', LumenPlay); return s }
export function LumenSquare(props: IconProps) { const s = <svg {...base(props)}><rect x={4} y={4} width={16} height={16} rx={2} /></svg>; reg('Square', LumenSquare); return s }
export function LumenStar(props: IconProps) { const s = <svg {...base(props)}><polygon points="12,2 15.5,9 23,10 17,15.5 18.5,23 12,19.5 5.5,23 7,15.5 1,10 8.5,9" /></svg>; reg('Star', LumenStar); return s }
export function LumenHeart(props: IconProps) { const s = <svg {...base(props)}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8" /></svg>; reg('Heart', LumenHeart); return s }
export function LumenFlag(props: IconProps) { const s = <svg {...base(props)}><line x1={4} y1={2} x2={4} y2={22} /><path d="M4 4h12l-1.5 4L16 12H4" /></svg>; reg('Flag', LumenFlag); return s }
export function LumenLightbulb(props: IconProps) { const s = <svg {...base(props)}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.1 3.1a7 7 0 0 0-6.2 12.1c.7.7 1.1 1.6 1.1 2.6V18h4v-.2c0-1 .4-1.9 1.1-2.6a7 7 0 0 0 0-12.1" /></svg>; reg('Lightbulb', LumenLightbulb); return s }
export function LumenTarget(props: IconProps) { const s = <svg {...base(props)}><circle cx={12} cy={12} r={10} /><circle cx={12} cy={12} r={6} /><circle cx={12} cy={12} r={2} fill="currentColor" /></svg>; reg('Target', LumenTarget); return s }
export function LumenCrown(props: IconProps) { const s = <svg {...base(props)}><path d="m2 5 2 11 8-3 8 3 2-11-5 4-5-6-5 6Z" /><path d="M4 19h16" /></svg>; reg('Crown', LumenCrown); return s }
export function LumenBrain(props: IconProps) { const s = <svg {...base(props)}><path d="M12 4a4 4 0 0 1 3.5 2 4 4 0 0 1 2.5 1.5 4 4 0 0 1-1 6.5 4 4 0 0 1-4 4.5H12" /><path d="M12 4a4 4 0 0 0-3.5 2A4 4 0 0 0 6 7.5a4 4 0 0 0 1 6.5 4 4 0 0 0 4 4.5" /><line x1={12} y1={2} x2={12} y2={6} /><line x1={12} y1={16} x2={12} y2={22} /></svg>; reg('Brain', LumenBrain); return s }
export function LumenRocket(props: IconProps) { const s = <svg {...base(props)}><path d="M4 14a8 8 0 0 1 8-8 8 8 0 0 1 8 8" /><path d="M4 14a8 8 0 0 0 8 8 8 8 0 0 0 8-8" /><circle cx={12} cy={10} r={2} fill="currentColor" /><path d="M12 18v-4" /><path d="M8 14a6 6 0 0 0 8 0" /><polyline points="12,22 9,22 8,20 16,20 15,22" /></svg>; reg('Rocket', LumenRocket); return s }
export function LumenCode(props: IconProps) { const s = <svg {...base(props)}><polyline points="16,18 22,12 16,6" /><polyline points="8,6 2,12 8,18" /></svg>; reg('Code', LumenCode); return s }
export function LumenBookmark(props: IconProps) { const s = <svg {...base(props)}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>; reg('Bookmark', LumenBookmark); return s }
export function LumenClock(props: IconProps) { const s = <svg {...base(props)}><circle cx={12} cy={12} r={10} /><polyline points="12,6 12,12 16,14" /></svg>; reg('Clock', LumenClock); return s }
export function LumenCheckCircle(props: IconProps) { const s = <svg {...base(props)}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22,4 12,14.01 9,11.01" /></svg>; reg('CheckCircle', LumenCheckCircle); return s }
export function LumenCloud(props: IconProps) { const s = <svg {...base(props)}><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></svg>; reg('Cloud', LumenCloud); return s }
export function LumenSun(props: IconProps) { const s = <svg {...base(props)}><circle cx={12} cy={12} r={4} /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>; reg('Sun', LumenSun); return s }
export function LumenGlobe(props: IconProps) { const s = <svg {...base(props)}><circle cx={12} cy={12} r={10} /><line x1={2} y1={12} x2={22} y2={12} /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>; reg('Globe', LumenGlobe); return s }
export function LumenLock(props: IconProps) { const s = <svg {...base(props)}><rect x={3} y={11} width={18} height={11} rx={2} /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>; reg('Lock', LumenLock); return s }
export function LumenKey(props: IconProps) { const s = <svg {...base(props)}><circle cx={7} cy={12} r={3} /><path d="M9 12h11" /><line x1={17} y1={9} x2={20} y2={12} /><line x1={17} y1={15} x2={20} y2={12} /></svg>; reg('Key', LumenKey); return s }
export function LumenMusic(props: IconProps) { const s = <svg {...base(props)}><path d="M9 18V5l12-2v13" /><circle cx={6} cy={18} r={3} /><circle cx={18} cy={16} r={3} /></svg>; reg('Music', LumenMusic); return s }
export function LumenCamera(props: IconProps) { const s = <svg {...base(props)}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx={12} cy={13} r={4} /></svg>; reg('Camera', LumenCamera); return s }
export function LumenImage(props: IconProps) { const s = <svg {...base(props)}><rect x={3} y={3} width={18} height={18} rx={2} /><circle cx={8.5} cy={8.5} r={1.5} fill="currentColor" /><polyline points="21,15 16,10 5,21" /></svg>; reg('Image', LumenImage); return s }
export function LumenUser(props: IconProps) { const s = <svg {...base(props)}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx={12} cy={7} r={4} /></svg>; reg('User', LumenUser); return s }
export function LumenHome(props: IconProps) { const s = <svg {...base(props)}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9,22 9,12 15,12 15,22" /></svg>; reg('Home', LumenHome); return s }
export function LumenFlame(props: IconProps) { const s = <svg {...base(props)}><path d="M12 2S5 8 5 14a7 7 0 0 0 14 0c0-6-7-12-7-12z" /><path d="M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M8 16c0 1.5 1.5 3 4 3s4-1.5 4-3" /></svg>; reg('Flame', LumenFlame); return s }
export function LumenCommand(props: IconProps) { const s = <svg {...base(props)}><path d="M15 6a3 3 0 1 1-3 3V3a3 3 0 1 1 3 3Z" /><path d="M6 15a3 3 0 1 1 3-3h-6a3 3 0 1 1 3 3Z" /></svg>; reg('Command', LumenCommand); return s }
export function LumenEdit2(props: IconProps) { const s = <svg {...base(props)}><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>; reg('Edit2', LumenEdit2); return s }
export function LumenChevronLeft(props: IconProps) { const s = <svg {...base(props)}><polyline points="15,6 9,12 15,18" /></svg>; reg('ChevronLeft', LumenChevronLeft); return s }
export function LumenUndo(props: IconProps) { const s = <svg {...base(props)}><polyline points="1,4 1,10 7,10" /><path d="M3.5 15.5a8 8 0 1 0 4-13" /></svg>; reg('Undo', LumenUndo); return s }
export function LumenRedo(props: IconProps) { const s = <svg {...base(props)}><polyline points="23,4 23,10 17,10" /><path d="M20.5 15.5a8 8 0 1 1-4-13" /></svg>; reg('Redo', LumenRedo); return s }
