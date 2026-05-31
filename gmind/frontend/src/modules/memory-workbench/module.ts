// V6.0 — Memory Workbench module: visual UI over MASys memory engine.
import { lazy } from 'react'
import type { AppModule } from '../types'
import { LumenBrain } from '../../components/UI/LumenIcon'

const MemoryWorkbenchPanel = lazy(() =>
  import('../../components/MemoryWorkbench/MemoryWorkbenchPanel').then(m => ({ default: m.MemoryWorkbenchPanel }))
)

export const MemoryWorkbenchModule: AppModule = {
  id: 'memory-workbench',
  name: 'Memory',
  icon: LumenBrain,
  order: 5,
  tooltip: 'Memory Workbench — visual view over MASys agent memory',
  panel: MemoryWorkbenchPanel,

  commands: (_ctx) => [
    {
      id: 'open-memory-workbench',
      label: 'Open Memory Workbench',
      icon: 'brain',
      section: 'Panels',
      action: () => {
        import('../../store/shell').then(({ useShellStore }) => {
          useShellStore.getState().toggleModule('memory-workbench')
        })
      },
    },
    {
      id: 'refresh-memory',
      label: 'Refresh Memory layers',
      icon: 'brain',
      section: 'Memory',
      action: () => {
        import('../../store/masysMemory').then(({ useMASysMemoryStore }) => {
          const s = useMASysMemoryStore.getState()
          s.checkHealth()
          s.refreshAll()
        })
      },
    },
  ],
}
