import { lazy } from 'react'
import type { AppModule } from '../types'
import { LumenFolder } from '../../components/UI/LumenIcon'

const ProjectsPanel = lazy(() =>
  import('../../components/ProjectsPanel/ProjectsPanel').then(m => ({ default: m.ProjectsPanel }))
)

export const ProjectsModule: AppModule = {
  id: 'projects',
  name: 'Проекты',
  icon: LumenFolder,
  order: 3,
  tooltip: 'Схема проекта: каталог на диске → карта (.md и .xmind внутри отмечаются)',
  panel: ProjectsPanel,

  commands: () => [
    {
      id: 'open-projects-panel',
      label: 'Проекты: схема каталога',
      icon: 'folder',
      section: 'Panels',
      action: () => {
        import('../../store/shell').then(({ useShellStore }) => {
          useShellStore.getState().toggleModule('projects')
        })
      },
    },
  ],
}
