import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectsPanel } from './ProjectsPanel'
import { projectsApi, recentProjects, rememberProject, forgetProject } from '../../api/projects'
import { useMindMapStore } from '../../store/mindmap'

const scanResult = {
  path: 'D:\\проект',
  title: 'проект',
  stats: { dirs: 3, files: 12, markdown: 4, xmind: 1, nodes: 16, truncated: false },
  root: { id: 'r', title: 'проект', folded: false, children: [] },
}

const workbook = {
  id: 'wb-1',
  title: 'проект',
  source_path: 'D:\\проект',
  sheets: [{ id: 's1', title: 'Лист', root_topic: { id: 'r', title: 'проект', folded: false, children: [] } }],
}

beforeEach(() => {
  localStorage.removeItem('gmind_recent_projects')
  vi.restoreAllMocks()
  vi.spyOn(projectsApi, 'dirs').mockResolvedValue({
    path: 'D:\\',
    parent: '',
    dirs: [{ name: 'проект', path: 'D:\\проект', dir: true }],
  })
})

describe('панель проектов', () => {
  it('показывает сводку по каталогу до импорта', async () => {
    const scan = vi.spyOn(projectsApi, 'scan').mockResolvedValue(scanResult as never)
    render(<ProjectsPanel workbookId={null} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('Путь к каталогу проекта'), { target: { value: 'D:\\проект' } })
    fireEvent.click(screen.getByText('Обзор'))

    await waitFor(() => expect(scan).toHaveBeenCalledWith('D:\\проект', { docs_only: false, max_depth: 6 }))
    expect(await screen.findByText(/папок: 3/)).toBeInTheDocument()
    expect(screen.getByText(/\.md: 4/)).toBeInTheDocument()
    expect(screen.getByText(/\.xmind: 1/)).toBeInTheDocument()
  })

  it('передаёт выбранные настройки обхода', async () => {
    const scan = vi.spyOn(projectsApi, 'scan').mockResolvedValue(scanResult as never)
    render(<ProjectsPanel workbookId={null} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('Путь к каталогу проекта'), { target: { value: 'D:\\проект' } })
    fireEvent.click(screen.getByLabelText(/только \.md/i))
    fireEvent.change(screen.getByLabelText('Глубина обхода'), { target: { value: '3' } })
    fireEvent.click(screen.getByText('Обзор'))

    await waitFor(() => expect(scan).toHaveBeenCalledWith('D:\\проект', { docs_only: true, max_depth: 3 }))
  })

  it('строит карту, открывает её и запоминает проект', async () => {
    vi.spyOn(projectsApi, 'scan').mockResolvedValue(scanResult as never)
    const importer = vi.spyOn(projectsApi, 'import').mockResolvedValue({
      workbook: workbook as never,
      stats: scanResult.stats,
    })
    render(<ProjectsPanel workbookId={null} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('Путь к каталогу проекта'), { target: { value: 'D:\\проект' } })
    fireEvent.click(screen.getByText('Построить карту проекта'))

    await waitFor(() => expect(importer).toHaveBeenCalled())
    await waitFor(() => expect(useMindMapStore.getState().workbook?.id).toBe('wb-1'))
    expect(recentProjects()).toContain('D:\\проект')
    expect(await screen.findByText(/16 узлов/)).toBeInTheDocument()
  })

  it('предупреждает, когда схема усечена потолком узлов', async () => {
    vi.spyOn(projectsApi, 'import').mockResolvedValue({
      workbook: workbook as never,
      stats: { ...scanResult.stats, truncated: true },
    })
    render(<ProjectsPanel workbookId={null} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('Путь к каталогу проекта'), { target: { value: 'D:\\проект' } })
    fireEvent.click(screen.getByText('Построить карту проекта'))

    expect(await screen.findByText(/усечена/)).toBeInTheDocument()
  })

  it('показывает ошибку вместо сводки, если каталога нет', async () => {
    vi.spyOn(projectsApi, 'scan').mockRejectedValue(new Error('POST /projects/scan → 400: no such directory'))
    render(<ProjectsPanel workbookId={null} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('Путь к каталогу проекта'), { target: { value: 'D:\\нет' } })
    fireEvent.click(screen.getByText('Обзор'))

    expect(await screen.findByText(/no such directory/)).toBeInTheDocument()
    expect(screen.queryByText(/папок:/)).not.toBeInTheDocument()
  })

  it('ходит по каталогам и берёт выбранный', async () => {
    const scan = vi.spyOn(projectsApi, 'scan').mockResolvedValue(scanResult as never)
    render(<ProjectsPanel workbookId={null} onClose={() => {}} />)

    const folder = await screen.findByText('📁 проект')
    fireEvent.click(folder)
    await waitFor(() => expect(projectsApi.dirs).toHaveBeenCalledWith('D:\\проект'))

    fireEvent.click(screen.getByText('Взять этот каталог'))
    await waitFor(() => expect(scan).toHaveBeenCalled())
  })
})

describe('список недавних проектов', () => {
  beforeEach(() => localStorage.removeItem('gmind_recent_projects'))

  it('кладёт новый путь наверх и не плодит дублей', () => {
    rememberProject('D:\\a')
    rememberProject('D:\\b')
    expect(rememberProject('D:\\a')).toEqual(['D:\\a', 'D:\\b'])
  })

  it('держит не больше восьми записей', () => {
    for (let i = 0; i < 12; i++) rememberProject(`D:\\p${i}`)
    expect(recentProjects()).toHaveLength(8)
    expect(recentProjects()[0]).toBe('D:\\p11')
  })

  it('забывает путь по требованию', () => {
    rememberProject('D:\\a')
    rememberProject('D:\\b')
    expect(forgetProject('D:\\a')).toEqual(['D:\\b'])
  })

  it('переживает мусор в хранилище', () => {
    localStorage.setItem('gmind_recent_projects', '{сломано')
    expect(recentProjects()).toEqual([])
  })
})
