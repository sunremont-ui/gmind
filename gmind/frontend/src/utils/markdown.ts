interface MdTopic {
  title: string
  children: MdTopic[]
}

export function parseMarkdownToTopics(markdown: string): MdTopic[] {
  const lines = markdown.split('\n')
  const stack: { depth: number; topic: MdTopic }[] = []
  const roots: MdTopic[] = []

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) continue

    // Heading: # ## ### ####
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const depth = headingMatch[1].length
      const title = headingMatch[2].trim()
      const topic: MdTopic = { title, children: [] }
      attachToStack(stack, roots, depth, topic)
      continue
    }

    // List items: - * + or 1. 2.
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/)
    if (listMatch) {
      const indent = listMatch[1].length
      const depth = Math.floor(indent / 2) + 2 // indent-based depth, offset 2 for heading parity
      const title = listMatch[3].trim()
      const topic: MdTopic = { title, children: [] }
      attachToStack(stack, roots, depth, topic)
      continue
    }

    // Plain text — make a leaf at depth 1 (child of root)
    const title = line.trim()
    if (title) {
      const topic: MdTopic = { title, children: [] }
      attachToStack(stack, roots, 2, topic)
    }
  }

  return roots
}

function attachToStack(
  stack: { depth: number; topic: MdTopic }[],
  roots: MdTopic[],
  depth: number,
  topic: MdTopic,
) {
  // Pop stack until we find a parent at depth-1
  while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
    stack.pop()
  }
  if (stack.length === 0) {
    roots.push(topic)
  } else {
    stack[stack.length - 1].topic.children.push(topic)
  }
  stack.push({ depth, topic })
}
