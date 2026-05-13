import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaskList } from './TaskList'

const mockApproveTask = vi.fn().mockResolvedValue(undefined)
const mockRejectTask = vi.fn().mockResolvedValue(undefined)
const mockFetchTasks = vi.fn()
const mockSubscribe = vi.fn(() => vi.fn())

const defaultAgents = [{ id: 'ag1', role: 'researcher', status: 'idle' as const, provider: 'openai', model: 'gpt-4o' }]

let mockTasks: any[] = []
let mockAgents = defaultAgents

vi.mock('../../store/agent', () => ({
  useAgentStore: (sel: any) => {
    const state = {
      tasks: mockTasks,
      agents: mockAgents,
      fetchTasks: mockFetchTasks,
      approveTask: mockApproveTask,
      rejectTask: mockRejectTask,
      subscribeToEvents: mockSubscribe,
    }
    return sel ? sel(state) : state
  },
}))

const sampleTasks = [
  {
    id: 't1', agent_id: 'ag1', action: 'web_search', params: { query: 'test' },
    workbook_id: 'wb1', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:01:00Z',
    status: 'done' as const, result: { found: 3 }, max_calls: 10,
  },
  {
    id: 't2', agent_id: 'ag1', action: 'analyze', params: {},
    workbook_id: 'wb1', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:01:00Z',
    status: 'pending_approval' as const, max_calls: 10,
  },
  {
    id: 't3', agent_id: 'ag1', action: 'failed_task', params: {},
    workbook_id: 'wb1', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:01:00Z',
    status: 'failed' as const, error: 'timeout', max_calls: 10,
  },
]

describe('TaskList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTasks = []
    mockAgents = defaultAgents
  })

  it('shows empty state when no tasks', () => {
    render(<TaskList workbookId="wb1" />)
    expect(screen.getByText(/No tasks yet/)).toBeInTheDocument()
  })

  it('renders task list', async () => {
    mockTasks = sampleTasks
    render(<TaskList workbookId="wb1" />)
    await waitFor(() => {
      expect(screen.getByText('web_search')).toBeInTheDocument()
      expect(screen.getByText('analyze')).toBeInTheDocument()
      expect(screen.getByText('failed_task')).toBeInTheDocument()
    })
  })

  it('shows pending approval actions', async () => {
    mockTasks = sampleTasks
    render(<TaskList workbookId="wb1" />)
    await waitFor(() => {
      expect(screen.getAllByText('✓').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('✕').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows done status with Done text', async () => {
    mockTasks = sampleTasks
    render(<TaskList workbookId="wb1" />)
    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument()
    })
  })

  it('shows failed status with Error text', async () => {
    mockTasks = sampleTasks
    render(<TaskList workbookId="wb1" />)
    await waitFor(() => {
      expect(screen.getAllByText('Error').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('expands task details on click', async () => {
    mockTasks = [sampleTasks[0]]
    render(<TaskList workbookId="wb1" />)
    await waitFor(() => {
      expect(screen.getByText('web_search')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('web_search'))
    await waitFor(() => {
      expect(screen.getByText(/ID:/)).toBeInTheDocument()
      expect(screen.getAllByText(/researcher/).length).toBe(2)
    })
  })

  it('calls approveTask when approve button clicked', async () => {
    mockTasks = sampleTasks
    render(<TaskList workbookId="wb1" />)
    await waitFor(() => {
      const btns = screen.getAllByText('✓')
      fireEvent.click(btns[0])
    })
    expect(mockApproveTask).toHaveBeenCalledWith('t2')
  })

  it('calls rejectTask when reject button clicked', async () => {
    mockTasks = sampleTasks
    render(<TaskList workbookId="wb1" />)
    await waitFor(() => {
      const btns = screen.getAllByText('✕')
      fireEvent.click(btns[0])
    })
    expect(mockRejectTask).toHaveBeenCalledWith('t2')
  })
})
