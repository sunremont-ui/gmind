import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgentPanel } from './AgentPanel'

vi.mock('../../api/agent', () => ({
  agentApi: {
    listAgents: vi.fn(),
    createAgent: vi.fn(),
    deleteAgent: vi.fn(),
    listTasks: vi.fn(),
  },
}))

vi.mock('../../api/ws', () => ({
  wsClient: {
    on: vi.fn(() => vi.fn()),
    sendOperation: vi.fn(),
  },
}))

import { agentApi } from '../../api/agent'

const mockAgents = [
  { id: 'a1', role: 'researcher', status: 'idle' as const, provider: 'openai', model: 'gpt-4o' },
  { id: 'a2', role: 'critic', status: 'working' as const, provider: 'local', model: 'llama-3' },
]

describe('AgentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    vi.mocked(agentApi.listAgents).mockReturnValue(new Promise(() => {}))
    render(<AgentPanel workbookId="wb1" onClose={vi.fn()} />)
    expect(screen.getByText('Loading agents...')).toBeInTheDocument()
  })

  it('renders agents list after loading', async () => {
    vi.mocked(agentApi.listAgents).mockResolvedValue(mockAgents)
    vi.mocked(agentApi.listTasks).mockResolvedValue([])
    render(<AgentPanel workbookId="wb1" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Researcher')).toBeInTheDocument()
      expect(screen.getByText('Critic')).toBeInTheDocument()
    })
  })

  it('shows empty state when no agents', async () => {
    vi.mocked(agentApi.listAgents).mockResolvedValue([])
    render(<AgentPanel workbookId="wb1" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/No agents yet/)).toBeInTheDocument()
    })
  })

  it('shows Tags for agent provider, model, status', async () => {
    vi.mocked(agentApi.listAgents).mockResolvedValue(mockAgents)
    render(<AgentPanel workbookId="wb1" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('openai')).toBeInTheDocument()
      expect(screen.getByText('gpt-4o')).toBeInTheDocument()
      expect(screen.getByText('idle')).toBeInTheDocument()
    })
  })

  it('calls onClose when close button clicked', async () => {
    vi.mocked(agentApi.listAgents).mockResolvedValue([])
    const onClose = vi.fn()
    render(<AgentPanel workbookId="wb1" onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText(/No agents yet/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
