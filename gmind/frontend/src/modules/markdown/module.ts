import { lazy } from 'react'
import type { AppModule } from '../types'
import { LumenFileText } from '../../components/UI/LumenIcon'

const MarkdownPanel = lazy(() =>
  import('../../components/MarkdownPanel/MarkdownPanel').then(m => ({ default: m.MarkdownPanel }))
)

export const MarkdownModule: AppModule = {
  id: 'markdown',
  name: 'Markdown',
  icon: LumenFileText,
  order: 2,
  tooltip: 'Markdown-файлы: открыть и сохранить карту как .md',
  panel: MarkdownPanel,

  commands: (ctx) => [
    {
      id: 'open-markdown-panel',
      label: 'Markdown: файлы',
      icon: 'file-text',
      section: 'Panels',
      action: () => {
        import('../../store/shell').then(({ useShellStore }) => {
          useShellStore.getState().toggleModule('markdown')
        })
      },
    },
    {
      id: 'save-markdown',
      label: 'Markdown: сохранить карту в .md',
      icon: 'download',
      section: 'Markdown',
      action: () => {
        if (!ctx.workbookId) return
        import('../../api/markdown').then(({ markdownApi }) => {
          markdownApi.save(ctx.workbookId!).catch(err => console.error('markdown save failed:', err))
        })
      },
    },
    {
      id: 'reload-markdown',
      label: 'Markdown: перечитать файл карты',
      icon: 'redo',
      section: 'Markdown',
      action: () => {
        if (!ctx.workbookId) return
        Promise.all([import('../../api/markdown'), import('../../store/mindmap')])
          .then(([{ markdownApi }, { useMindMapStore }]) =>
            markdownApi.reload(ctx.workbookId!).then(wb => useMindMapStore.getState().setWorkbook(wb)))
          .catch(err => console.error('markdown reload failed:', err))
      },
    },
  ],
}
