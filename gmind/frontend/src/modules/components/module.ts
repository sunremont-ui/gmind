import { lazy } from 'react'
import type { AppModule } from '../types'
import { LumenSquare } from '../../components/UI/LumenIcon'

const ComponentLibraryPanel = lazy(() =>
  import('../../components/ComponentLibrary/ComponentLibraryPanel').then(m => ({ default: m.ComponentLibraryPanel }))
)

export const ComponentLibraryModule: AppModule = {
  id: 'components',
  name: 'Компоненты',
  icon: LumenSquare,
  order: 3,
  tooltip: 'Библиотека визуальных компонентов: заготовки для холста',
  panel: ComponentLibraryPanel,

  commands: (_ctx) => [
    {
      id: 'open-component-library',
      label: 'Компоненты: библиотека заготовок',
      icon: 'square',
      section: 'Panels',
      action: () => {
        import('../../store/shell').then(({ useShellStore }) => {
          useShellStore.getState().toggleModule('components')
        })
      },
    },
  ],
}
