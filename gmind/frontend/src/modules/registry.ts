import type { AppModule } from './types'
import { MindMapModule } from './mindmap/module'
import { NotesModule } from './notes/module'
import { MarkdownModule } from './markdown/module'
import { ProjectsModule } from './projects/module'
import { ComponentLibraryModule } from './components/module'
import { AgentSandboxModule } from './agent-sandbox/module'
import { MaSysModule } from './masys/module'
import { AIModule } from './ai/module'
import { MemoryWorkbenchModule } from './memory-workbench/module'

export const MODULE_REGISTRY: AppModule[] = [
  MindMapModule,
  NotesModule,
  MarkdownModule,
  ProjectsModule,
  ComponentLibraryModule,
  AgentSandboxModule,
  MaSysModule,
  AIModule,
  MemoryWorkbenchModule,
].sort((a, b) => a.order - b.order)

export function getModule(id: string): AppModule | undefined {
  return MODULE_REGISTRY.find(m => m.id === id)
}
