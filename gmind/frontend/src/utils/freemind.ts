interface FmTopic {
  title: string
  children: FmTopic[]
}

export function parseFreeMind(xmlText: string): FmTopic[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  const mapEl = doc.documentElement
  if (mapEl.tagName !== 'map') {
    throw new Error('Not a valid FreeMind file: root element must be <map>')
  }
  const roots: FmTopic[] = []
  const nodes = mapEl.querySelectorAll(':scope > node')
  nodes.forEach(node => {
    const topic = parseNode(node)
    if (topic) roots.push(topic)
  })
  return roots
}

function parseNode(el: Element): FmTopic | null {
  const text = el.getAttribute('TEXT')
  if (!text) return null

  const topic: FmTopic = {
    title: text,
    children: [],
  }

  for (const child of el.children) {
    if (child.tagName === 'node') {
      const childTopic = parseNode(child)
      if (childTopic) topic.children.push(childTopic)
    }
  }

  return topic
}
