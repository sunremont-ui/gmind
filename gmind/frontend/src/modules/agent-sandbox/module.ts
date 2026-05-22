import { lazy } from 'react'
import type { AppModule } from '../types'
import { LumenUsers } from '../../components/UI/LumenIcon'

const AgentPanel = lazy(() =>
  import('../../components/AgentPanel/AgentPanel').then(m => ({ default: m.AgentPanel }))
)

export const AgentSandboxModule: AppModule = {
  id: 'agents',
  name: 'Agents',
  icon: LumenUsers,
  order: 2,
  tooltip: 'Agent Sandbox',
  panel: AgentPanel,

  commands: (_ctx) => [
    {
      id: 'open-agents',
      label: 'Toggle agents panel',
      icon: 'users',
      section: 'Panels',
      action: () => {
        import('../../store/shell').then(({ useShellStore }) => {
          useShellStore.getState().toggleModule('agents')
        })
      },
    },
  ],

  agentTools: [
    { name: 'create_topic', label: 'Create Topic', description: 'Create a new topic in the mindmap', category: 'mindmap' },
    { name: 'update_topic', label: 'Update Topic', description: 'Update an existing topic', category: 'mindmap' },
    { name: 'delete_topic', label: 'Delete Topic', description: 'Delete a topic from the mindmap', category: 'mindmap' },
    { name: 'get_workbook', label: 'Get Workbook', description: 'Get the current workbook structure', category: 'mindmap' },
    { name: 'delegate_to_agent', label: 'Delegate to Agent', description: 'Delegate a task to another agent', category: 'agent' },
  ],
}
