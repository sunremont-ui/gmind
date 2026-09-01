import { lazy } from 'react'
import type { AppModule } from '../types'
import { LumenTarget } from '../../components/UI/LumenIcon'

const LabPanel = lazy(() =>
  import('../../components/LabPanel/LabPanel').then(m => ({ default: m.LabPanel }))
)

export const LabModule: AppModule = {
  id: 'lab',
  name: 'Лаба',
  icon: LumenTarget,
  order: 6,
  tooltip: 'Как идёт работа: треки проектов, записи с вердиктами оракула, матрицы замеров',
  panel: LabPanel,

  commands: () => [
    {
      id: 'open-lab-panel',
      label: 'Лаба: треки проектов',
      icon: 'target',
      section: 'Panels',
      action: () => {
        import('../../store/shell').then(({ useShellStore }) => {
          useShellStore.getState().toggleModule('lab')
        })
      },
    },
  ],
}
