// V6.1 Memory Lab — create a memory-design workbook seeded with the 6 karp
// memory layers as typed top-level nodes. The workbook is flagged kind=memory_lab
// so the canvas shows memory-kind styling and the MASys affordance.
import { api } from '../api/client'
import type { Workbook } from '../types'
import { KARP_LAYERS, MEMORY_KINDS } from '../components/MindMap/memoryKinds'

export async function createMemoryLabWorkbook(title = '🧠 Memory Lab'): Promise<Workbook> {
  const wb = await api.createWorkbook(title)
  await api.updateWorkbook(wb.id, { kind: 'memory_lab' })

  const rootId = wb.sheets[0]?.root_topic?.id
  if (rootId) {
    // Seed the six karp layers in canonical order as typed children of the root.
    for (const layer of KARP_LAYERS) {
      const def = MEMORY_KINDS[layer]
      try {
        await api.createTopic(wb.id, rootId, `${def.icon} ${def.label}`, undefined, { memoryKind: layer })
      } catch (err) {
        console.error('seed memory layer failed:', layer, err)
      }
    }
  }

  // Re-fetch so the returned workbook carries kind + seeded topics.
  return api.getWorkbook(wb.id)
}
