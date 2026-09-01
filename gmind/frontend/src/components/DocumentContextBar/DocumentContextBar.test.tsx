import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DocumentContextBar } from './DocumentContextBar'
import type { ProjectRootContext } from '../../utils/documentNavigation'

const projectRoot: ProjectRootContext = {
  workbookId: 'root-wb',
  title: 'Wiki memory',
  path: 'D:\\wiki',
  root: { id: 'root', title: 'Wiki memory', folded: false, children: [] },
}

describe('DocumentContextBar', () => {
  it('показывает путь от корня и управляет общей историей', () => {
    const back = vi.fn()
    const forward = vi.fn()
    render(
      <DocumentContextBar
        title="shortest-path"
        sourcePath={'D:\\wiki\\concepts\\graph\\shortest-path.md'}
        projectRoot={projectRoot}
        canGoBack
        canGoForward={false}
        onGoBack={back}
        onGoForward={forward}
        onOpenRoot={() => {}}
        onRevealInTree={() => {}}
      />,
    )

    expect(screen.getByText('Wiki memory')).toBeInTheDocument()
    expect(screen.getByText('concepts')).toBeInTheDocument()
    expect(screen.getByText('shortest-path.md')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(back).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Вперёд' })).toBeDisabled()
  })
})
