import { lazy } from 'react'
import type { AppModule } from '../types'
import { LumenRocket } from '../../components/UI/LumenIcon'

const MaSysPanel = lazy(() =>
  import('../../components/MaSysPanel/MaSysPanel').then(m => ({ default: m.MaSysPanel }))
)

export const MaSysModule: AppModule = {
  id: 'masys',
  name: 'MASys',
  icon: LumenRocket,
  order: 3,
  tooltip: 'MASys Pipelines',
  panel: MaSysPanel,

  commands: (_ctx) => [
    {
      id: 'open-masys',
      label: 'Open MASys pipelines',
      icon: 'rocket',
      section: 'Panels',
      action: () => {
        import('../../store/shell').then(({ useShellStore }) => {
          useShellStore.getState().toggleModule('masys')
        })
      },
    },
  ],

  agentTools: [
    { name: 'run_masys_pipeline', label: 'Run Pipeline', description: 'Execute a MASys pipeline', category: 'masys' },
  ],
}
