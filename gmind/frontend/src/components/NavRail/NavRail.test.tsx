// Рейка модулей растёт с каждым новым модулем, а высота окна — нет.
// Проверяем, что список прокручивается, а «Настройки» и переключатель списка
// остаются на местах: раньше нижние кнопки просто уезжали за край.
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AppModule } from '../../modules/types'
import { NavRail } from './NavRail'

function fakeModule(id: string, order: number): AppModule {
  return {
    id,
    name: id,
    order,
    tooltip: `модуль ${id}`,
    icon: () => <svg data-testid={`icon-${id}`} />,
    panel: () => <div />,
  }
}

const modules: AppModule[] = [
  { ...fakeModule('mindmap', 0) },
  ...Array.from({ length: 10 }, (_, i) => fakeModule(`mod${i}`, i + 1)),
]

describe('NavRail', () => {
  it('прокручивает список модулей, а не выталкивает их за край', () => {
    render(
      <NavRail
        modules={modules}
        activeModuleId={null}
        onToggleModule={() => {}}
        onOpenSettings={() => {}}
      />,
    )
    const list = screen.getByTestId('nav-rail-modules')
    expect(list.style.overflowY).toBe('auto')
    expect(list.style.minHeight).toBe('0px')
    expect(list.style.flex).toContain('1')
  })

  it('«Настройки» лежат вне прокручиваемого списка', () => {
    render(
      <NavRail
        modules={modules}
        activeModuleId={null}
        onToggleModule={() => {}}
        onOpenSettings={() => {}}
      />,
    )
    const settings = screen.getByTitle('Settings')
    expect(screen.getByTestId('nav-rail-modules').contains(settings)).toBe(false)
  })

  it('холст (mindmap) кнопкой не показывается, остальные модули — да', () => {
    render(
      <NavRail
        modules={modules}
        activeModuleId={null}
        onToggleModule={() => {}}
        onOpenSettings={() => {}}
      />,
    )
    expect(screen.queryByTitle('модуль mindmap')).not.toBeInTheDocument()
    expect(screen.getAllByTitle(/^модуль mod/)).toHaveLength(10)
  })

  it('щелчок по модулю переключает панель', () => {
    const onToggle = vi.fn()
    render(
      <NavRail
        modules={modules}
        activeModuleId={null}
        onToggleModule={onToggle}
        onOpenSettings={() => {}}
      />,
    )
    fireEvent.click(screen.getByTitle('модуль mod3'))
    expect(onToggle).toHaveBeenCalledWith('mod3')
  })

  it('статус модуля добавляется к подсказке', () => {
    render(
      <NavRail
        modules={modules}
        activeModuleId="mod1"
        onToggleModule={() => {}}
        onOpenSettings={() => {}}
        statusByModule={{ mod1: { ok: true, label: 'подключено' } }}
      />,
    )
    expect(screen.getByTitle('модуль mod1 — подключено')).toBeInTheDocument()
  })
})
