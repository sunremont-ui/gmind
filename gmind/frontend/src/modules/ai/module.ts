import { lazy } from 'react'
import type { AppModule } from '../types'
import { LumenSparkles } from '../../components/UI/LumenIcon'

const AIPanel = lazy(() =>
  import('../../components/AIPanel/AIPanel').then(m => ({ default: m.AIPanel }))
)

export const AIModule: AppModule = {
  id: 'ai',
  name: 'AI Assistant',
  icon: LumenSparkles,
  order: 4,
  tooltip: 'AI Assistant',
  panel: AIPanel,

  commands: (_ctx) => [
    {
      id: 'open-ai',
      label: 'Toggle AI assistant',
      icon: 'sparkles',
      section: 'Panels',
      action: () => {
        import('../../store/shell').then(({ useShellStore }) => {
          useShellStore.getState().toggleModule('ai')
        })
      },
    },
  ],
}
