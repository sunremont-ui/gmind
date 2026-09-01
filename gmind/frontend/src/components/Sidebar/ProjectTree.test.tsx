import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ProjectTree } from './ProjectTree'
import type { ProjectRootContext } from '../../utils/documentNavigation'
import { projectsApi } from '../../api/projects'

const projectRoot: ProjectRootContext = {
  workbookId: 'root-wb',
  title: 'Wiki memory',
  path: 'D:\\wiki',
  root: {
    id: 'root',
    title: 'Wiki memory',
    folded: false,
    children: [{
      id: 'folder',
      title: 'concepts',
      notes: 'D:\\wiki\\concepts',
      folded: false,
      children: [
        {
          id: 'doc',
          title: 'graph.md',
          hyperlink: 'D:\\wiki\\concepts\\graph.md',
          folded: false,
          children: [],
        },
        {
          id: 'code',
          title: 'main.go',
          folded: false,
          children: [],
        },
      ],
    }],
  },
}

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
})

describe('ProjectTree', () => {
  it('оставляет документы и их папки, подсвечивает текущий файл', () => {
    const openDocument = vi.fn()
    render(
      <ProjectTree
        projectRoot={projectRoot}
        activeWorkbookId="doc-wb"
        activeSourcePath={'D:\\wiki\\concepts\\graph.md'}
        onOpenRoot={() => {}}
        onOpenDocument={openDocument}
        onProjectChanged={() => {}}
      />,
    )

    expect(screen.getByText('concepts')).toBeInTheDocument()
    expect(screen.queryByText('main.go')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Развернуть всё дерево' }))
    const document = screen.getByRole('treeitem', { name: /graph\.md/ })
    expect(document).toHaveAttribute('aria-current', 'page')
    fireEvent.click(document)
    expect(openDocument).toHaveBeenCalledWith('D:\\wiki\\concepts\\graph.md')
  })

  it('сворачивает и разворачивает все ветки дерева', () => {
    render(
      <ProjectTree
        projectRoot={projectRoot}
        activeWorkbookId="root-wb"
        onOpenRoot={() => {}}
        onOpenDocument={() => {}}
        onProjectChanged={() => {}}
      />,
    )

    expect(screen.queryByText('graph.md')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Развернуть всё дерево' }))
    expect(screen.getByText('graph.md')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Свернуть всё дерево' }))
    expect(screen.queryByText('graph.md')).not.toBeInTheDocument()
  })

  it('создаёт Markdown-файл в выбранной папке и открывает его', async () => {
    const refreshedWorkbook = {
      id: 'root-wb', title: 'Wiki memory', sheets: [{ id: 'sheet', title: 'Wiki', root_topic: projectRoot.root }],
      private: false, owner_id: '', created_at: '', updated_at: '', source_path: projectRoot.path,
    }
    const create = vi.spyOn(projectsApi, 'createFile').mockResolvedValue({
      path: 'D:\\wiki\\concepts\\new-note.md',
      workbook: refreshedWorkbook as never,
    })
    const openDocument = vi.fn()
    const projectChanged = vi.fn()
    render(
      <ProjectTree
        projectRoot={projectRoot}
        activeWorkbookId="root-wb"
        onOpenRoot={() => {}}
        onOpenDocument={openDocument}
        onProjectChanged={projectChanged}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Создать файл в папке concepts' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Название нового Markdown-файла' }), {
      target: { value: 'new-note' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Создать файл' }))

    await waitFor(() => expect(create).toHaveBeenCalledWith(
      projectRoot.path,
      projectRoot.workbookId,
      'D:\\wiki\\concepts',
      'new-note',
    ))
    expect(projectChanged).toHaveBeenCalledWith(refreshedWorkbook)
    expect(openDocument).toHaveBeenCalledWith('D:\\wiki\\concepts\\new-note.md')
  })

  it('удаляет документ после подтверждения и обновляет корневую карту', async () => {
    const refreshedWorkbook = {
      id: 'root-wb', title: 'Wiki memory', sheets: [{ id: 'sheet', title: 'Wiki', root_topic: projectRoot.root }],
      private: false, owner_id: '', created_at: '', updated_at: '', source_path: projectRoot.path,
    }
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const remove = vi.spyOn(projectsApi, 'deleteFile').mockResolvedValue({
      path: 'D:\\wiki\\concepts\\graph.md',
      workbook: refreshedWorkbook as never,
      deleted_workbook_ids: ['doc-wb'],
    })
    const projectChanged = vi.fn()
    render(
      <ProjectTree
        projectRoot={projectRoot}
        activeWorkbookId="doc-wb"
        activeSourcePath="D:\\wiki\\concepts\\graph.md"
        onOpenRoot={() => {}}
        onOpenDocument={() => {}}
        onProjectChanged={projectChanged}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Развернуть всё дерево' }))
    fireEvent.click(screen.getByRole('button', { name: 'Удалить файл graph.md' }))

    await waitFor(() => expect(remove).toHaveBeenCalledWith(
      projectRoot.path,
      projectRoot.workbookId,
      'D:\\wiki\\concepts\\graph.md',
    ))
    expect(projectChanged).toHaveBeenCalledWith(
      refreshedWorkbook,
      'D:\\wiki\\concepts\\graph.md',
      ['doc-wb'],
    )
  })
})
