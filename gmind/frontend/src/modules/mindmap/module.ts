import type { AppModule, ModulePanelProps } from '../types'
import { LumenMap } from '../../components/UI/LumenIcon'

// Mindmap is the always-visible canvas — its "panel" is a no-op placeholder.
// Nav Rail click on this icon closes any open module panel.
function MindMapPlaceholderPanel(_props: ModulePanelProps) {
  return null
}

export const MindMapModule: AppModule = {
  id: 'mindmap',
  name: 'Mind Map',
  icon: LumenMap,
  order: 0,
  tooltip: 'Mind Map canvas',
  panel: MindMapPlaceholderPanel,
}
